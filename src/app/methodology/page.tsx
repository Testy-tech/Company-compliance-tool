import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/site/placeholder-page";

export const metadata: Metadata = { title: "Methodology" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Methodology"
      phase="Phase 8"
      summary="How the knowledge base is sourced, verified and reviewed, how applicability rules work, where AI is used and where it is not, and the tool's limitations."
    />
  );
}
