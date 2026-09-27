import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/site/placeholder-page";

export const metadata: Metadata = { title: "Jurisdictions" };

export default function Page() {
  return (
    <PlaceholderPage
      title="Jurisdictions"
      phase="Phase 8"
      summary="A public library of the jurisdictions covered: applicable laws, regulators, key obligations and the date each was last reviewed."
    />
  );
}
