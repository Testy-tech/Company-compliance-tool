"use client";

import { processingLabels } from "@/lib/intake/options";

import { FlagList, QuestionGroup } from "../fields";
import { issueCollector, type StepDef, type StepProps } from "../types";

function ProcessingStep({ draft, update, errors }: StepProps) {
  return (
    <QuestionGroup qid="processing" error={errors["q-processing"]} hint="Select all that apply, anywhere in the group.">
      <FlagList
        name="processing"
        labels={processingLabels}
        flags={draft.processing.processing}
        onChange={(k, on) => update((d) => void (d.processing.processing[k] = on))}
      />
    </QuestionGroup>
  );
}

export const processingStep: StepDef = {
  id: "processing",
  title: "Processing",
  intro: "What the group does with personal data.",
  questionIds: ["processing"],
  validate: (draft, config) => {
    const v = issueCollector(config);
    v.require(Object.values(draft.processing.processing).some(Boolean), "processing", undefined, "Select at least one activity.");
    return v.issues;
  },
  Component: ProcessingStep,
};
