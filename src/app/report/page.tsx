import type { Metadata } from "next";

import { ReportView } from "@/components/report/report-view";
import { demoNoticeOn } from "@/lib/demo";
import { loadKnowledge } from "@/lib/kb/load";

export const metadata: Metadata = { title: "Report" };

export default async function Page() {
  const { kb, fx } = await loadKnowledge();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <ReportView kb={kb} fx={fx} demo={demoNoticeOn()} />
    </div>
  );
}
