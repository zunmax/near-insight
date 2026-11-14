import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";
import { THESIS_STATEMENT } from "@/content/thesis";

export const alt = `${SITE.name}: ${THESIS_STATEMENT}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share image for every page: the site name, the thesis statement and the data it uses, on black with a green glow. */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(900px 500px at 10% -10%, rgba(30,211,155,0.24), transparent 60%), #000000",
          color: "#e7e9ea",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#1ed39b" }}>{SITE.name}</div>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, lineHeight: 1.2, maxWidth: 1000 }}>{THESIS_STATEMENT}</div>
        <div style={{ display: "flex", fontSize: 26, color: "#71767b" }}>On-chain, market and NEAR Intents revenue data. Every query can be re-run.</div>
      </div>
    ),
    size,
  );
}
