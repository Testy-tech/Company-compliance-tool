import type { Metadata } from "next";

import { SectionHeading } from "@/components/legal/section-heading";

export const metadata: Metadata = { title: "Legal" };

// Draft placeholders. Final wording is written in Phase 8 and must be
// reviewed by the operator before launch.
const sections = [
  {
    id: "disclaimer",
    title: "Disclaimer",
    body: "DataBorders is an informational tool. It does not provide legal advice and does not create a lawyer–client relationship. Laws change and their application depends on facts this tool cannot assess. Verify every finding with qualified counsel in each jurisdiction before acting on it.",
  },
  {
    id: "privacy",
    title: "Privacy policy",
    body: "Full policy to follow. In summary: questionnaire answers are kept in your browser session and are not stored on our servers. They are sent to an AI model for tailored explanations only if you opt in. No third-party analytics or trackers are used.",
  },
  {
    id: "imprint",
    title: "Imprint",
    body: "Operator details to be added before launch.",
  },
];

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <p className="eyebrow">Draft · completed in Phase 8</p>
      <h1 className="mt-3 text-3xl font-semibold text-primary sm:text-4xl">
        Legal
      </h1>
      <div className="mt-12 space-y-14">
        {sections.map((s, i) => (
          <section key={s.id} aria-labelledby={s.id}>
            <SectionHeading id={s.id} number={i + 1}>
              {s.title}
            </SectionHeading>
            <p className="mt-6 max-w-prose text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
