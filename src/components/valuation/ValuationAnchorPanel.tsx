import { io } from "next/cache";
import { PriceGrowthPicker, PriceGrowthPickerSkeleton, type PriceGrowth } from "@/components/valuation/PriceGrowthPicker";
import { HowCalculated, HowCalculatedSkeleton } from "@/components/ui/HowCalculated";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { REQUIREMENT_HORIZON_MONTHS, REQUIREMENT_PRICE_MULTIPLES } from "@/config/projections";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { digitsApart, formatChange, formatChangeFromZero, formatMonths, formatMultiple, formatPercent, formatUsd } from "@/lib/format";
import { coveringGrowth, growthTerms, seedInput } from "@/lib/projection";
import { formatMaxIssuance } from "@/lib/thesis/max-issuance";
import { windowName } from "@/lib/thesis/window-name";

const TITLE = "What the price assumes";

/** Today's valuation tiles: one column in a narrow box, two side by side from 448px. */
const VALUATION_CLASS = "m-0 grid gap-2 @min-[448px]:grid-cols-2";
/** The break-even tiles: one column in a narrow box, then two side by side from 448px with the last across both; three
    never fit "Minted ÷ (burned + bought)" on one line. */
const BREAK_EVEN_CLASS = "m-0 grid gap-2 @min-[448px]:grid-cols-2 @min-[448px]:[&>:last-child]:col-span-2";
const HEADING_CLASS = "mt-4 mb-2 text-[13.5px] font-bold";

/** Market cap against what burn plus buybacks return a year, break-even today, and the growth they need at each price and horizon. */
export async function ValuationAnchorPanel() {
  await io();
  const metrics = await getThesisMetrics();
  const { valuation: v, seed, breakEven, dataThrough } = metrics;
  if (!v || !seed) return <NoData title={TITLE} />;
  const today = breakEven?.d30 ?? null;
  const window = windowName(metrics, "30 days");
  const prices: PriceGrowth[] = REQUIREMENT_PRICE_MULTIPLES.map((multiple) => ({
    price: formatUsd(seed.priceUsd * multiple),
    tag: multiple === 1 ? "today" : `${multiple}×`,
    today: multiple === 1,
    periods: REQUIREMENT_HORIZON_MONTHS.map((months) => {
      const growth = coveringGrowth(seedInput(seed, months, multiple));
      return {
        label: formatMonths(months),
        /** Zero or less: already covered, and the value is how far NEAR bought could fall a month;
            −1 means burn alone covers it. */
        value: growth === null ? "—" : growth <= -1 ? "None" : `${formatChange(growth, digitsApart(growth * 100, 0, 1))}/mo`,
        detail:
          growth === null
            ? undefined
            : growth <= -1
              ? "Burn alone covers it"
              : growth <= 0
                ? "Already covered"
                : `${formatChangeFromZero(growthTerms(growth, 12).perYear)} a year`,
      };
    }),
  }));

  return (
    <Panel
      title={TITLE}
      sources={["coingecko", "nearArchive", "dune", "defillama", "nearRpc"]}
      through={`Data through ${dataThrough}`}
      sqlId="projection-inputs"
      viewLabel="Values"
    >
      <div className="@container flex min-w-0 flex-col">
        <h3 className="mb-2.5 text-[13.5px] font-medium">
          Monthly growth of NEAR bought needed for burn + buybacks to match monthly issuance by the end of each period shown, with burn held at the pace of the{" "}
          <NoBreakTokens text={window} />
        </h3>
        <PriceGrowthPicker prices={prices} initial={REQUIREMENT_PRICE_MULTIPLES.indexOf(1)} />
        <h3 className={HEADING_CLASS}>Today</h3>
        <dl className={VALUATION_CLASS}>
          <KpiCard icon="bars" label="Market cap" value={formatUsd(v.marketCapUsd)} />
          <KpiCard icon="flame" label="Burn + buybacks a year" value={formatUsd(v.tokenRevenueRunRateUsd)} detail="Run rate, at today's price" />
          <KpiCard icon="divide" label="Market cap multiple" value={v.multiple === null ? "—" : formatMultiple(v.multiple)} detail="÷ burn + buybacks a year" />
          <KpiCard icon="percent" label="Burn + buybacks yield" value={formatPercent(v.holderYield, 2)} detail={`Against ${formatMaxIssuance(seed.maxInflationRate)} max issuance`} />
        </dl>
        {today ? (
          <>
            <h3 className={HEADING_CLASS}>
              <NoBreakTokens text={`Break-even, ${window}`} />
            </h3>
            <dl className={BREAK_EVEN_CLASS}>
              <KpiCard
                icon="divide"
                label="Minted ÷ (burned + bought)"
                value={today.multiple === null ? "—" : formatMultiple(today.multiple, 2)}
                detail="NEAR bought at prices paid"
              />
              <KpiCard
                icon="target"
                label="Break-even volume a day"
                value={today.volumePerDayUsd === null ? "—" : formatUsd(today.volumePerDayUsd)}
                detail="At today's price"
              />
              <KpiCard icon="trend" label="Intents volume a day" value={formatUsd(today.currentVolumePerDayUsd)} detail="Average over the same days" />
            </dl>
          </>
        ) : null}
        <HowCalculated>
          At a higher price the same buyback dollars buy less NEAR, so more growth is needed; the burn does not depend on price, because gas is paid in NEAR.
          Where burn + buybacks already match issuance, the growth shown is how far NEAR bought could fall a month and still match it; &quot;None&quot; means the
          burn alone covers it. Run rate is the NEAR burned and bought over the <NoBreakTokens text={window} />, annualized and valued at today&apos;s price; the
          multiple is market cap ÷ run rate, and the yield is run rate ÷ market cap.
          {today ? (
            <NoBreakTokens
              text={` Break-even uses the NEAR minted, burned and bought over the ${window}. Break-even volume is the volume that would buy the NEAR minted minus the NEAR burned. It uses today's price and the share of volume that bought NEAR over those days. Minted ÷ (burned + bought) counts the NEAR actually bought, at the prices paid. Break-even volume buys at today's price, so the two differ when the price has moved.`}
            />
          ) : null}
        </HowCalculated>
      </div>
    </Panel>
  );
}

/** Loading placeholder of ValuationAnchorPanel: the growth needed at each price, today's valuation tiles and the break-even tiles. */
export function ValuationAnchorPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Values">
      <div className="@container flex min-w-0 flex-col">
        <h3 className="mb-2.5 text-[13.5px] font-medium">
          <SkeletonWords chars={162} />
        </h3>
        <PriceGrowthPickerSkeleton prices={REQUIREMENT_PRICE_MULTIPLES.length} labels={REQUIREMENT_HORIZON_MONTHS.map((months) => formatMonths(months).length)} />
        <h3 className={HEADING_CLASS}>
          <SkeletonWords chars={"Today".length} />
        </h3>
        <dl aria-hidden="true" className={VALUATION_CLASS}>
          <KpiCardSkeleton label={"Market cap".length} />
          <KpiCardSkeleton label={"Burn + buybacks a year".length} detail={"Run rate, at today's price".length} />
          <KpiCardSkeleton label={"Market cap multiple".length} detail={"÷ burn + buybacks a year".length} />
          <KpiCardSkeleton label={"Burn + buybacks yield".length} detail={"Against 2.5% max issuance".length} />
        </dl>
        <h3 className={HEADING_CLASS}>
          <SkeletonWords chars={"Break-even, last 30 days".length} />
        </h3>
        <dl aria-hidden="true" className={BREAK_EVEN_CLASS}>
          <KpiCardSkeleton label={"Minted ÷ (burned + bought)".length} detail={"NEAR bought at prices paid".length} />
          <KpiCardSkeleton label={"Break-even volume a day".length} detail={"At today's price".length} />
          <KpiCardSkeleton label={"Intents volume a day".length} detail={"Average over the same days".length} />
        </dl>
        <HowCalculatedSkeleton />
      </div>
    </PanelSkeleton>
  );
}
