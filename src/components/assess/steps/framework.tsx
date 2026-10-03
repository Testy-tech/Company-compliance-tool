"use client";

import { frameworkLabels } from "@/lib/intake/options";

import { FlagList, QuestionGroup } from "../fields";
import type { StepDef, StepProps } from "../types";

function FrameworkStep({ draft, update }: StepProps) {
  return (
    <QuestionGroup
      qid="framework"
      hint={
        draft.company.gdprBaseline === "no"
          ? "You said the group does not run a GDPR-based programme. Tick anything that exists anyway; leave empty if nothing does."
          : "Tick what exists today at group level. Leave empty if nothing does."
      }
    >
      <FlagList
        name="framework"
        labels={frameworkLabels}
        flags={draft.framework.framework}
        onChange={(k, on) => update((d) => void (d.framework.framework[k] = on))}
      />
    </QuestionGroup>
  );
}

export const frameworkStep: StepDef = {
  id: "framework",
  title: "Existing GDPR framework",
  intro: "What is already in place, so the report can mark obligations as covered, partly covered or new.",
  questionIds: ["framework"],
  validate: () => [],
  Component: FrameworkStep,
};
