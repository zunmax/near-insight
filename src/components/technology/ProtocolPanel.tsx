import { io } from "next/cache";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";
import { NoData } from "@/components/ui/NoData";
import { Panel } from "@/components/ui/Panel";
import { PanelSkeleton, SkeletonWords } from "@/components/ui/PanelSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FULL_BURN_PROTOCOL } from "@/config/protocol";
import { getProtocolVersions, getReleases } from "@/data/network";

const TITLE = "Protocol upgrades";
/** nearcore releases listed. */
const RELEASES = 8;
/** The network tiles: one column in a narrow box, two side by side from 448px. */
const NETWORKS_CLASS = "m-0 grid gap-2 @min-[448px]:grid-cols-2";

/** Which protocol each network runs, and recent nearcore releases. Tracks the 100% gas burn (FULL_BURN_PROTOCOL). */
export async function ProtocolPanel() {
  await io();
  const [versions, releases] = await Promise.all([getProtocolVersions(), getReleases(RELEASES)]);
  if (!versions) return <NoData title={TITLE} />;
  const burnLive = versions.mainnet >= FULL_BURN_PROTOCOL;

  return (
    <Panel
      title={TITLE}
      sources={["nearRpc", "github"]}
      sqlId="protocol-releases"
      viewLabel="Table"
    >
      <div className="@container">
        <dl className={NETWORKS_CLASS}>
          <KpiCard icon="tag" label="Mainnet" value={`Protocol ${versions.mainnet}`} detail={`nearcore ${versions.mainnetNode}`} />
          <KpiCard icon="tag" label="Testnet" value={`Protocol ${versions.testnet}`} detail={`nearcore ${versions.testnetNode}`} />
        </dl>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-dashed border-line-strong p-3">
        <p className="text-[13px]">
          <span className="font-semibold">100% gas burn</span> <span className="text-ink-2">(protocol {FULL_BURN_PROTOCOL}, HSP-027)</span>
        </p>
        {burnLive ? (
          <StatusBadge label="Live on mainnet" />
        ) : (
          <span className="text-[12px] font-semibold text-ink-2">{versions.testnet >= FULL_BURN_PROTOCOL ? "Testnet only" : "Not live yet"}</span>
        )}
      </div>
      <ul className="mt-4 m-0 list-none p-0">
        {releases.map((r) => (
          <li key={r.tag} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[13px]">
            <a href={r.url} target="_blank" rel="noreferrer" className="min-w-0 py-1 font-medium hover:underline">
              nearcore {r.tag}
            </a>
            <span className="flex shrink-0 items-center gap-2 text-[12px] whitespace-nowrap text-muted">
              {r.prerelease ? <span className="chip max-sm:hidden">Release candidate</span> : null}
              {r.publishedAt.slice(0, 10)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Loading placeholder of ProtocolPanel: the two network tiles, the gas burn line and the release list. */
export function ProtocolPanelSkeleton() {
  return (
    <PanelSkeleton title={TITLE.length} tabs="Table">
      <div className="@container">
        <dl className={NETWORKS_CLASS}>
          {["Mainnet", "Testnet"].map((network) => (
            <KpiCardSkeleton key={network} label={network.length} detail={"nearcore 2.9.0".length} />
          ))}
        </dl>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-dashed border-line-strong p-3">
        <p className="text-[13px]">
          <SkeletonWords chars={36} />
        </p>
        <span className="skeleton h-5 w-24 shrink-0 rounded-full" />
      </div>
      <ul className="m-0 mt-4 list-none p-0">
        {Array.from({ length: RELEASES }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[13px]">
            <span className="min-w-0 py-1 font-medium">
              <SkeletonWords chars={20} />
            </span>
            <span className="shrink-0 text-[12px]">
              <SkeletonWords chars={10} />
            </span>
          </li>
        ))}
      </ul>
    </PanelSkeleton>
  );
}
