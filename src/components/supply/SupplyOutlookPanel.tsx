import { io } from "next/cache";
import { burnNote, rampNote } from "@/components/projections/projection-notes";
import { ScenarioPicker, ScenarioPickerSkeleton } from "@/components/projections/ScenarioPicker";
import { HowCalculated, HowCalculatedSkeleton } from "@/components/ui/HowCalculated";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { formatMaxIssuance } from "@/lib/thesis/max-issuance";
import { describeProposalStatus, proposalFailed } from "@/lib/thesis/proposal-status";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { SUPPLY_OUTLOOK_MONTHS } from "@/config/projections";
import { HSP029 } from "@/config/protocol";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { formatChange, formatCompact, formatMonths, formatNear, formatPercent } from "@/lib/format";
import { dayTime } from "@/lib/metrics";
import { MONTH_SECONDS, project, seedInput } from "@/lib/projection";

const YEARS = SUPPLY_OUTLOOK_MONTHS / 12;
const HORIZON = formatMonths(SUPPLY_OUTLOOK_MONTHS);
const TITLE = `Total NEAR supply, next ${HORIZON}`;

/** Projected total supply at today's max issuance against HSP-029's lower rate, both net of the fee burn. */
export async function SupplyOutlookPanel() {
  await io();
  const { seed, hsp029 } = await getThesisMetrics();
  if (!seed) return <NoData title={TITLE} />;

  const base = seedInput(seed, SUPPLY_OUTLOOK_MONTHS);
  const outlooks = [
    { name: `${formatMaxIssuance(seed.maxInflationRate)} max issuance (today)`, rows: project(base), status: null },
    {
      name: `${formatPercent(HSP029.targetRate, 1)} max issuance (HSP-029)`,
      rows: project({ ...base, targetInflationRate: HSP029.targetRate }),
      status: hsp029 ? describeProposalStatus(hsp029) : null,
    },
  ];
  const start = dayTime(seed.through);

  return (
    <Panel
      title={TITLE}
      sources={["nearRpc", "nearArchive", "defillama", "coingecko"]}
      sqlId="projection-inputs"
    >
      <ScenarioPicker
        scenarios={outlooks.map((outlook) => {
          const end = outlook.rows.at(-1)?.supplyNear ?? seed.totalSupplyNear;
          return {
            name: outlook.name,
            assumption: outlook.status ?? undefined,
            metrics: [
              { label: `Supply in ${HORIZON}`, value: formatCompact(end, 2) },
              /** Signed: with a burn larger than issuance the supply falls. */
              { label: "Change in supply", value: `${end > seed.totalSupplyNear ? "+" : ""}${formatCompact(end - seed.totalSupplyNear)}` },
              { label: "Supply growth a year", value: formatChange((end / seed.totalSupplyNear) ** (1 / YEARS) - 1, 2) },
            ],
            points: [
              { time: start, value: seed.totalSupplyNear },
              ...outlook.rows.map((row) => ({ time: start + row.month * MONTH_SECONDS, value: row.supplyNear })),
            ],
          };
        })}
        initial={0}
        format="near"
        zeroBaseline={false}
        chartTitle={`Projected total NEAR supply over ${YEARS} years at today's max issuance and under HSP-029`}
      />
      <HowCalculated>
        <NoBreakTokens
          text={`Starts from today's total supply, ${formatNear(seed.totalSupplyNear, 2)}, and a fee burn of ${formatCompact(seed.feesNearPerMonth * seed.burnShareOfFees)} NEAR a month: the gas fees of the 30 days to ${seed.through} with ${burnNote(seed)}. Bought NEAR is held off the market in the three fee wallets; it is not burned, so it stays in total supply and in circulating supply. HSP-029 is modeled as ${rampNote(seed, hsp029 !== null && proposalFailed(hsp029))}.`}
        />
      </HowCalculated>
    </Panel>
  );
}

/** Loading placeholder of SupplyOutlookPanel: a pill per issuance outlook, its three numbers and the chart. */
export function SupplyOutlookPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Chart">
      <ScenarioPickerSkeleton pills={[25, 27]} metrics={[{ label: `Supply in ${HORIZON}`.length }, { label: "Change in supply".length }, { label: "Supply growth a year".length }]} />
      <HowCalculatedSkeleton />
    </PanelSkeleton>
  );
}
