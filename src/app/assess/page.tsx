import type { Metadata } from "next";

import { Wizard } from "@/components/assess/wizard";
import { getWizardConfig } from "@/lib/kb/wizard-config";

export const metadata: Metadata = { title: "Assessment" };

export default async function Page() {
  const config = await getWizardConfig();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h1 className="text-3xl font-semibold text-primary sm:text-4xl">Assessment</h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        Eight short steps and a review. Every threshold question accepts “Don&apos;t know”; unanswered points become open questions in your report.
      </p>
      <div className="mt-8">
        <Wizard config={config} />
      </div>
    </div>
  );
}
