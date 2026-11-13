import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { TRIGGERS } from "../src/config/thesis-triggers.ts";
import { SECTION_ORDER, type SectionId } from "../src/content/thesis.ts";
import type { ThesisMetrics } from "../src/data/thesis-metrics.ts";
import { alreadyAbsorbed, growthCheck, growthNeededValue, SECTION_TRIGGERS } from "../src/lib/thesis/triggers.ts";
import { absorbed, assertWellFormed, holdingMetrics } from "./thesis-metrics-fixture.ts";

/** The breaking point of `id` on the holding metrics with `change` applied. */
function trigger(id: SectionId, change: (m: ThesisMetrics) => void = () => {}) {
  const m = holdingMetrics();
  change(m);
  return SECTION_TRIGGERS[id](m);
}

describe("SECTION_TRIGGERS", () => {
  test("every breaking point holds on the holding metrics, with well-formed text", () => {
    for (const id of SECTION_ORDER) {
      const t = trigger(id);
      assert.equal(t.status, "not-happened", id);
      for (const text of [t.rule, t.ruleShort, t.detail, t.detailShort]) assertWellFormed(text);
    }
  });

  test("a breaking point without its data is not measured yet", () => {
    const missing: Record<SectionId, (m: ThesisMetrics) => void> = {
      demand: (m) => (m.intents = null),
      capture: (m) => (m.feeWallets = null),
      supply: (m) => (m.supply = null),
      valuation: (m) => (m.buybacks = null),
      technology: (m) => (m.technology = null),
      network: (m) => (m.staking = null),
      peers: (m) => (m.peers = null),
    };
    for (const id of SECTION_ORDER) assert.equal(trigger(id, missing[id]).status, "no-data", id);
  });
});

describe("demand breaking point", () => {
  test("breaks when volume falls against a year earlier or against the 90 days before", () => {
    assert.equal(trigger("demand", (m) => (m.intents!.changeYoY30d = -0.01)).status, "happened");
    assert.equal(trigger("demand", (m) => (m.intents!.change90d = -0.01)).status, "happened");
  });

  test("a missing half is not a pass, unless the other half already broke", () => {
    assert.equal(trigger("demand", (m) => (m.intents!.change90d = null)).status, "no-data");
    const broke = trigger("demand", (m) => {
      m.intents!.change90d = null;
      m.intents!.changeYoY30d = -0.2;
    });
    assert.equal(broke.status, "happened");
  });

  test("no change at all still holds", () => {
    const t = trigger("demand", (m) => {
      m.intents!.changeYoY30d = 0;
      m.intents!.change90d = 0;
    });
    assert.equal(t.status, "not-happened");
    assert.match(t.detail, /did not shrink on either check/);
  });
});

describe("capture breaking point", () => {
  const limit = TRIGGERS.walletShortfallShare;

  test("breaks when fees buy no NEAR or the wallets lose NEAR", () => {
    const stopped = trigger("capture", (m) => (m.feeWallets!.bought30dNear = 0));
    assert.equal(stopped.status, "happened");
    assert.match(stopped.detail, /The buying stopped\./);
    const lost = trigger("capture", (m) => (m.feeWallets!.gain30dNear = -1_000));
    assert.equal(lost.status, "happened");
    assert.match(lost.detail, /NEAR left the wallets\./);
  });

  test("breaks only when the largest daily gap is above the limit, not at it", () => {
    const at = trigger("capture", (m) => (m.feeWallets!.shortfall30dNear = m.feeWallets!.bought30dNear! * limit));
    assert.equal(at.status, "not-happened");
    const above = trigger("capture", (m) => (m.feeWallets!.shortfall30dNear = m.feeWallets!.bought30dNear! * limit * 1.01));
    assert.equal(above.status, "happened");
    assert.match(above.detail, /sold or moved out/);
  });

  test("a window with no gap says so", () => {
    assert.match(trigger("capture", (m) => (m.feeWallets!.shortfall30dNear = 0)).detail, /On no day did the wallets fall behind/);
  });
});

describe("supply breaking point", () => {
  test("breaks when max issuance rises above the ceiling, but not at it", () => {
    assert.equal(trigger("supply", (m) => (m.supply!.maxInflationRate = TRIGGERS.maxIssuanceCeiling)).status, "not-happened");
    const raised = trigger("supply", (m) => (m.supply!.maxInflationRate = 0.02504));
    assert.equal(raised.status, "happened");
    assert.match(raised.detail, /2\.504% a year, above 2\.500%/);
  });

  test("breaks when HSP-029 can no longer take effect", () => {
    for (const status of ["Defeated", "Vetoed", "Rejected", "Expired", "Failed"]) {
      assert.equal(trigger("supply", (m) => (m.hsp029!.status = status)).status, "happened", status);
    }
  });

  test("breaks when burn plus buybacks absorb a smaller share than in the 90 days before", () => {
    assert.equal(trigger("supply", (m) => (m.absorption!.d90 = absorbed(90, 0.1))).status, "happened");
    assert.equal(trigger("supply", (m) => (m.absorption!.d90 = absorbed(90, 0.116))).status, "not-happened");
  });

  test("an unread vote is not a pass, unless another part already broke", () => {
    assert.equal(trigger("supply", (m) => (m.hsp029 = null)).status, "no-data");
    const raised = trigger("supply", (m) => {
      m.hsp029 = null;
      m.supply!.maxInflationRate = 0.05;
    });
    assert.equal(raised.status, "happened");
  });
});

describe("valuation breaking point", () => {
  test("follows the 95% range of NEAR bought's growth against the growth needed", () => {
    const at = (low: number, high: number, required: number) =>
      trigger("valuation", (m) => {
        m.buybacks!.monthlyGrowthRange = { low, high };
        m.buybacks!.monthlyGrowth = (low + high) / 2;
        m.valuation!.requiredMonthlyGrowth = required;
      }).status;
    assert.equal(at(0.05, 0.1, 0.05), "not-happened");
    assert.equal(at(0.02, 0.1, 0.05), "too-close");
    assert.equal(at(0.01, 0.04, 0.05), "happened");
  });

  test("with nothing bought, holds only while burn alone covers issuance", () => {
    const covered = trigger("valuation", (m) => {
      m.buybacks!.bought30dNear = 0;
      m.valuation!.requiredMonthlyGrowth = -1;
    });
    assert.equal(covered.status, "not-happened");
    assert.match(covered.detail, /burn alone already matches monthly issuance/);
    const notCovered = trigger("valuation", (m) => {
      m.buybacks!.bought30dNear = 0;
      m.valuation!.requiredMonthlyGrowth = null;
    });
    assert.equal(notCovered.status, "happened");
    assert.equal(trigger("valuation", (m) => {
      m.buybacks!.bought30dNear = 0;
      m.seed = null;
    }).status, "no-data");
  });

  test("a growth needed of zero or less that still breaks says why", () => {
    const t = trigger("valuation", (m) => {
      m.buybacks!.monthlyGrowth = -0.05;
      m.buybacks!.monthlyGrowthRange = { low: -0.08, high: -0.03 };
      m.valuation!.requiredMonthlyGrowth = -0.02;
    });
    assert.equal(t.status, "happened");
    assert.match(t.detailShort, /Even the top of its 95% range is below a rate of −2\.0% a month/);
  });
});

describe("technology, network and peers breaking points", () => {
  test("a transfer breaks the check only above the limit", () => {
    const at = trigger("technology", (m) => (m.technology!.transferCostUsd = TRIGGERS.transferCostLimitUsd));
    assert.equal(at.status, "not-happened");
    assert.match(at.detail, /exactly at the \$0\.01 limit/);
    assert.equal(trigger("technology", (m) => (m.technology!.transferCostUsd = 0.0101)).status, "happened");
  });

  test("fewer validators than the floor holding a third of stake breaks the check", () => {
    const at = trigger("network", (m) => (m.staking!.nakamoto = TRIGGERS.nakamotoFloor));
    assert.equal(at.status, "not-happened");
    assert.match(at.detail, /at the floor of 8/);
    assert.equal(trigger("network", (m) => (m.staking!.nakamoto = TRIGGERS.nakamotoFloor - 1)).status, "happened");
    assert.match(trigger("network", (m) => Object.assign(m.staking!, { nakamoto: 1, validators: 1 })).detail, /the largest of 1 validator alone holds/);
  });

  test("NEAR's supply growth breaks the check only above the median", () => {
    assert.equal(trigger("peers", (m) => (m.peers!.nearGrowth1y = 0.021)).status, "not-happened");
    assert.equal(trigger("peers", (m) => (m.peers!.nearGrowth1y = 0.025)).status, "happened");
    assert.equal(trigger("peers", (m) => (m.peers!.medianGrowth1y = null)).status, "no-data");
  });
});

describe("growthCheck", () => {
  test("holds at the bottom of the range, breaks below its top, and is too close inside it", () => {
    assert.equal(growthCheck({ low: 0.05, high: 0.1 }, 0.05), "not-happened");
    assert.equal(growthCheck({ low: 0.04, high: 0.1 }, 0.05), "too-close");
    assert.equal(growthCheck({ low: 0.04, high: 0.1 }, 0.1), "too-close");
    assert.equal(growthCheck({ low: 0.04, high: 0.09 }, 0.1), "happened");
  });
});

describe("growth needed wording", () => {
  test("−1 means burn alone covers issuance, never a growth of −100%", () => {
    assert.equal(growthNeededValue(-1, 1), "None: burn alone matches issuance");
    assert.equal(growthNeededValue(0.0506, 1), "+5.1%");
    assert.match(alreadyAbsorbed(-1, "3 years", 1), /^burn alone already matches/);
    assert.match(alreadyAbsorbed(-0.02, "3 years", 1), /could fall 2\.0% a month/);
    assert.match(alreadyAbsorbed(0, "3 years", 1), /so no growth is needed$/);
  });
});
