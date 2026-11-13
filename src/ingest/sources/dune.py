"""Reads a public Dune dashboard's query results as dune.com's pages do (curl_cffi as a browser, HMAC-signed result requests), for sources/dune.ts.
Input (stdin JSON): baseUrl, dashboard {handle, slug}, queries, known {id: execution id}, signingKey, retries, browsers, budgetSeconds. Output (stdout
JSON): signingKey and results by id, each {unchanged}, {executionId, generatedAt, columns, rows} or {error}; exits 1 when the dashboard cannot be read."""

import base64
import hashlib
import hmac
import json
import re
import sys
import time

from curl_cffi import requests

TIMEOUT_S = 60
PAGE_ROWS = 32000
# Status codes worth another attempt; a Cloudflare challenge page answers 403 and can clear on a later attempt.
RETRYABLE_STATUS = {403, 408, 425, 429, 500, 502, 503, 504}
KEY_IN_CLIENT = re.compile(r'importKey\("raw",\s*[\w$]+\.encode\("(public-[0-9A-Za-z]+)"\)')
SCRIPT_SRC = re.compile(r'(?:src|href)="(/_next/static/[^"]+\.js)"')
CHUNK_PATH = re.compile(r'(static/immutable/chunks/[\w-]+\.js)')
# Most scripts read while looking for the signing key (the site loads about 80 up front and 175 in all, 2026-11-10).
MAX_KEY_SCRIPTS = 300


class DuneError(Exception):
    pass


class Client:
    def __init__(self, base_url, referer, retries, browsers, deadline):
        self.base = base_url
        self.retries = retries
        self.deadline = deadline
        self.browsers = browsers
        self.browser = 0
        self.session = requests.Session(impersonate=browsers[0])
        self.headers = {"origin": base_url, "referer": referer}

    def next_browser(self):
        """Moves to the next browser in `browsers`, after the last back to the first, on a new session, so no connection
        opened with the previous browser's TLS fingerprint is reused."""
        self.session.close()
        self.browser = (self.browser + 1) % len(self.browsers)
        self.session = requests.Session(impersonate=self.browsers[self.browser])

    def request(self, method, path, headers=None, **kwargs):
        """One request with up to `retries` further attempts, 2, 4, 8 s apart, on network errors and retryable statuses, none after
        the run's deadline; each further attempt presents the next browser, kept by later requests. A JSON 403 is Dune refusing
        the request itself (not a Cloudflare challenge page), so it is returned without retrying."""
        tried, last = [], None
        for attempt in range(self.retries + 1):
            if attempt > 0:
                time.sleep(2 ** attempt)
                self.next_browser()
            if time.monotonic() > self.deadline:
                raise DuneError("run budget reached; read on the next run")
            browser = self.browsers[self.browser]
            try:
                res = self.session.request(method, self.base + path, headers={**self.headers, **(headers or {})}, timeout=TIMEOUT_S, **kwargs)
            except Exception as error:  # curl_cffi raises its own errors for DNS, TLS and timeouts.
                tried.append(f"{browser} {type(error).__name__}")
                last = str(error)[:150]
                continue
            if res.status_code < 400 or res.status_code not in RETRYABLE_STATUS or (res.status_code == 403 and is_json(res)):
                return res
            tried.append(f"{browser} {res.status_code}")
            last = repr(res.text[:150])
        raise DuneError(f"{method} {path} failed as {', '.join(tried)}; last: {last}")

    def graphql(self, query, variables):
        res = self.request("POST", "/public/graphql", json={"query": query, "variables": variables})
        if res.status_code >= 400:
            raise DuneError(f"GraphQL answered {res.status_code}: {res.text[:200]!r}")
        body = res.json()
        if body.get("errors"):
            raise DuneError(f"GraphQL errors: {json.dumps(body['errors'])[:300]}")
        return body["data"]


def is_json(res):
    return "application/json" in res.headers.get("content-type", "")


def dashboard_queries(client, handle, slug):
    """Each query shown on the dashboard, by id, with the parameters its charts run it with."""
    data = client.graphql(
        """query($filters: DashboardFilterInput!, $pagination: PaginationInput!) {
          dashboards(filters: $filters, pagination: $pagination) { edges { node { id
            visualizationWidgets { visualization { query { id parameters } } } } } } }""",
        {"filters": {"handle": {"equals": handle}, "slug": {"equals": slug}}, "pagination": {"first": 1}},
    )
    edges = data["dashboards"]["edges"]
    if not edges:
        raise DuneError(f"dashboard {handle}/{slug} not found")
    queries = {}
    for widget in edges[0]["node"]["visualizationWidgets"]:
        query = widget["visualization"]["query"]
        queries[int(query["id"])] = query["parameters"] or []
    return queries


def latest_execution(client, query_id, parameters):
    data = client.graphql(
        """query($queryId: Int!, $parameters: [ExecutionParameterInput!]) {
          resultSetForQuery(queryId: $queryId, parameters: $parameters) { completedExecutionId } }""",
        {"queryId": query_id, "parameters": parameters},
    )
    return (data.get("resultSetForQuery") or {}).get("completedExecutionId")


def signature(key, ts, execution_id, query_id, limit, offset):
    message = f"{ts}{execution_id}{query_id}{limit}{offset}".encode()
    return base64.urlsafe_b64encode(hmac.new(key.encode(), message, hashlib.sha256).digest()).decode().rstrip("=")


def find_signing_key(client, query_id):
    """The signing key in dune.com's web client: the scripts of a query page, then the chunks they load."""
    page = client.request("GET", f"/queries/{query_id}").text
    scripts = list(dict.fromkeys(SCRIPT_SRC.findall(page)))
    seen = set()
    while scripts and len(seen) < MAX_KEY_SCRIPTS:
        path = scripts.pop(0)
        if path in seen:
            continue
        seen.add(path)
        source = client.request("GET", path).text
        match = KEY_IN_CLIENT.search(source)
        if match:
            return match.group(1)
        scripts += [f"/_next/{chunk}" for chunk in CHUNK_PATH.findall(source) if f"/_next/{chunk}" not in seen]
    raise DuneError(f"signing key not found in {len(seen)} scripts of the query page")


def refresh_signing_key(client, state, query_id):
    """Looks the signing key up again, at most once per run so a refusal on every query costs one search; True when it changed."""
    if state["looked_up"]:
        return False
    state["looked_up"] = True
    key = find_signing_key(client, query_id)
    if key == state["key"]:
        return False
    state["key"] = key
    return True


def fetch_rows(client, state, query_id, execution_id, parameters):
    """Every row of one execution, page by page; signs again with a refreshed key once if the site refuses the signature."""
    rows, offset, first, refreshed = [], 0, None, False
    while True:
        ts = int(time.time() * 1000)
        body = {
            "execution_id": execution_id,
            "query_id": query_id,
            "parameters": parameters,
            "pagination": {"limit": PAGE_ROWS, "offset": offset},
            "ts": ts,
            "s": signature(state["key"], ts, execution_id, query_id, PAGE_ROWS, offset),
        }
        res = client.request("POST", "/public/execution", data=json.dumps(body), headers={"content-type": "application/json"})
        if res.status_code in (400, 401, 403) and is_json(res) and not refreshed:
            refreshed = True
            if refresh_signing_key(client, state, query_id):
                continue
        if res.status_code >= 400:
            raise DuneError(f"execution {execution_id} answered {res.status_code}: {res.text[:200]!r}")
        page = res.json().get("execution_succeeded")
        if not page:
            raise DuneError(f"execution {execution_id} has no finished result")
        first = first or page
        rows += page.get("data") or []
        offset += PAGE_ROWS
        total = page.get("total_row_count") or 0
        if offset >= total or not page.get("data"):
            break
    if len(rows) != (first.get("total_row_count") or 0):
        raise DuneError(f"execution {execution_id}: read {len(rows)} rows of {first.get('total_row_count')}")
    return {"executionId": execution_id, "generatedAt": first.get("generated_at"), "columns": first.get("columns"), "rows": rows}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    request = json.load(sys.stdin)
    handle, slug = request["dashboard"]["handle"], request["dashboard"]["slug"]
    # Past this time no new query or request starts, so the queries already read are returned before the caller's hard timeout.
    deadline = time.monotonic() + float(request["budgetSeconds"])
    client = Client(request["baseUrl"], f"{request['baseUrl']}/{handle}/{slug}", int(request["retries"]), request["browsers"], deadline)
    state = {"key": request["signingKey"], "looked_up": False}
    try:
        on_dashboard = dashboard_queries(client, handle, slug)
    except Exception as error:
        print(f"dashboard {handle}/{slug}: {error}", file=sys.stderr)
        sys.exit(1)
    results = {}
    for query_id in request["queries"]:
        if time.monotonic() > deadline:
            results[str(query_id)] = {"error": "run budget reached; read on the next run"}
            continue
        try:
            if query_id not in on_dashboard:
                raise DuneError(f"query {query_id} is not on the dashboard")
            parameters = on_dashboard[query_id]
            execution_id = latest_execution(client, query_id, parameters)
            if not execution_id:
                raise DuneError(f"query {query_id} has no finished run")
            if request["known"].get(str(query_id)) == execution_id:
                results[str(query_id)] = {"unchanged": True}
            else:
                results[str(query_id)] = fetch_rows(client, state, query_id, execution_id, parameters)
        except Exception as error:
            results[str(query_id)] = {"error": f"{type(error).__name__}: {str(error)[:300]}"}
    json.dump({"signingKey": state["key"], "results": results}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
