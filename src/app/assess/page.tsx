import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/site/placeholder-page";

export const metadata: Metadata = { title: "Assessment" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Assessment"
      phase="Phase 3"
      summary="A seven-step questionnaire covering your company, footprint, data, processing, infrastructure, existing GDPR artefacts and governance model. Answers stay in this browser session."
    />
  );
}
