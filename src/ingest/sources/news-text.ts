/** The ticker in capitals, so the word "near" ("near-term", "near the end") does not count. */
const NEAR_TICKER = /\bNEAR\b/;

/** The project's name in any case: "Near Protocol", "NEAR Intents". */
const NEAR_NAME = /\bnear (?:protocol|intents)\b/i;

/** True when any of the texts names NEAR, so news only tagged NEAR among many coins is left out. */
export const mentionsNear = (...texts: Array<string | null>) => texts.some((text) => text !== null && (NEAR_TICKER.test(text) || NEAR_NAME.test(text)));

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Plain text from a feed's HTML snippet: tags removed, named and numeric entities decoded, spaces collapsed,
    and decimals rejoined where a feed put a space after the point ("2. 5%" → "2.5%"). */
export function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (!code.startsWith("#")) return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
      const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      /** Above U+10FFFF is not a character, and String.fromCodePoint would throw on it. */
      return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    })
    .replace(/\s+/g, " ")
    .replace(/(\d)\. (\d)/g, "$1.$2")
    .trim();
}

/** Display name from a publisher's self-registered feed title: drops a "Feed - " prefix and a language prefix that matches the
    site's language subdomain ("En Cryptonomist" on en.cryptonomist.ch), lower-cases a ".Com", ".Net", ".Org" or ".Io" ending,
    and capitalizes an all-lowercase name ("coinpedia" → "Coinpedia"). */
export function toPublisherName(title: string, domain: string): string {
  const language = domain.match(/^([a-z]{2})\./)?.[1];
  let name = title.trim().replace(/^Feed - /, "");
  if (language && name.toLowerCase().startsWith(`${language} `)) name = name.slice(language.length + 1);
  name = name.replace(/\.(Com|Net|Org|Io)$/, (suffix) => suffix.toLowerCase());
  return name === name.toLowerCase() ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}
