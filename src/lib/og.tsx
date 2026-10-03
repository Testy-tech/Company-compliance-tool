import { ImageResponse } from "next/og";

/* Shared OpenGraph card: ink navy sheet, brass rule, serif-style title. Flex layout only (an ImageResponse constraint). */

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export function ogCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer: string }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1B2A4A", color: "#FBF9F4", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, letterSpacing: 1 }}>
          <span style={{ color: "#D2B06A", marginRight: 14 }}>§</span>
          <span>DataBorders</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#D2B06A" }}>{eyebrow}</div>
          <div style={{ display: "flex", width: 120, height: 3, background: "#A8874A", marginTop: 22, marginBottom: 26 }} />
          <div style={{ display: "flex", fontSize: title.length > 40 ? 62 : 76, lineHeight: 1.1, fontWeight: 600 }}>{title}</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#C9D2E6" }}>{footer}</div>
      </div>
    ),
    ogSize,
  );
}
