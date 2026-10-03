"use client";

import { governanceLabels } from "@/lib/intake/options";

import { QuestionGroup, RadioList, YesNoRadio } from "../fields";
import { issueCollector, type StepDef, type StepProps } from "../types";

function GovernanceStep({ draft, update, errors }: StepProps) {
  const g = draft.governance;
  return (
    <div className="space-y-8">
      <QuestionGroup qid="governance-model" error={errors["q-governance-model"]}>
        <div className="grid gap-2">
          <RadioList
            name="governance-model"
            columns
            options={Object.entries(governanceLabels).map(([value, label]) => ({ value, label }))}
            value={g.model}
            onChange={(v) => update((d) => void (d.governance.model = v))}
          />
        </div>
      </QuestionGroup>

      <QuestionGroup qid="governance-local-contacts" error={errors["q-governance-local-contacts"]}>
        <YesNoRadio name="governance-local-contacts" value={g.localContacts} onChange={(v) => update((d) => void (d.governance.localContacts = v))} />
      </QuestionGroup>
    </div>
  );
}

export const governanceStep: StepDef = {
  id: "governance",
  title: "Governance",
  intro: "How privacy decisions are made across the group.",
  questionIds: ["governance-model", "governance-local-contacts"],
  validate: (draft, config) => {
    const v = issueCollector(config);
    v.require(draft.governance.model, "governance-model", undefined, "Please choose one.");
    v.require(draft.governance.localContacts === undefined ? undefined : true, "governance-local-contacts", undefined, "Please choose Yes or No.");
    return v.issues;
  },
  Component: GovernanceStep,
};
