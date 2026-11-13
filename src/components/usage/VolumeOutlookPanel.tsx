import { io } from "next/cache";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton } from "@/components/ui/PanelSkeleton";
import { VolumeOutlook, VolumeOutlookSkeleton, type VolumePace } from "@/components/usage/VolumeOutlook";
import { getThesisMetrics } from "@/data/thesis-metrics";
import { DAYS_PER_MONTH, monthlyRate } from "@/lib/metrics";

const TITLE = "Projected NEAR Intents volume";

/** Seeds the volume projection with live values and the monthly paces measured from the stored volume. */
export async function VolumeOutlookPanel() {
  await io();
  const { seed, intents } = await getThesisMetrics();
  if (!seed || seed.volumeUsdPerMonth <= 0) return <NoData title={TITLE} />;
  const paces: VolumePace[] = [
    { label: "90-day pace", growth: intents?.change90d == null ? null : monthlyRate(intents.change90d, 90 / DAYS_PER_MONTH) },
    { label: "Year on year", growth: intents?.changeYoY30d == null ? null : monthlyRate(intents.changeYoY30d, 365 / DAYS_PER_MONTH) },
  ].flatMap(({ label, growth }) => (growth === null ? [] : [{ label, growth }]));

  return (
    <Panel
      title={TITLE}
      sources={["dune", "defillama", "coingecko", "nearRpc", "nearArchive"]}
      sqlId="projection-inputs"
      viewLabel="Model"
    >
      <VolumeOutlook seed={seed} paces={paces} />
    </Panel>
  );
}

/** Loading placeholder of VolumeOutlookPanel. */
export function VolumeOutlookPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Model">
      <VolumeOutlookSkeleton />
    </PanelSkeleton>
  );
}
