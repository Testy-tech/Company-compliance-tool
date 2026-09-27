import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/site/placeholder-page";

export const metadata: Metadata = { title: "Report" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Report"
      phase="Phase 5"
      summary="Your jurisdiction-by-jurisdiction opinion: executive summary, GDPR delta heatmap, checklist, transfer map, governance recommendation and 30/60/90-day roadmap."
    />
  );
}
