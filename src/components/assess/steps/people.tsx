"use client";

import type { BandSetId } from "@/lib/intake/bands";
import { needsTxSale, type EntityDraft } from "@/lib/intake/draft";
import { sensitiveLabels, subjectLabels } from "@/lib/intake/options";
import { anchorId, type QuestionId } from "@/lib/intake/questions";

import { BandQuestion, CountrySection, FlagList, QuestionGroup, YesNoAnswer } from "../fields";
import { countryName, issueCollector, type StepDef, type StepProps } from "../types";

/** Per-country counts of individuals (Phase 3 addendum A5, plus the two California-driven questions). */
const peopleQuestions: { qid: QuestionId; field: keyof EntityDraft["people"]; set: BandSetId }[] = [
  { qid: "people-staff", field: "staff", set: "people" },
  { qid: "people-business", field: "business", set: "people" },
  { qid: "people-other", field: "other", set: "people" },
  { qid: "people-sensitive", field: "sensitive", set: "sensitiveHeld" },
  { qid: "people-sold-shared", field: "soldShared", set: "people" },
];

function PeopleStep({ draft, update, config, errors }: StepProps) {
  return (
    <div className="space-y-8">
      <QuestionGroup qid="data-subjects" error={errors["q-data-subjects"]} hint="Select all that apply, across the group.">
        <FlagList name="data-subjects" labels={subjectLabels} flags={draft.data.subjects} onChange={(k, on) => update((d) => void (d.data.subjects[k] = on))} />
      </QuestionGroup>

      <QuestionGroup qid="data-sensitive" hint="Select all that apply. Leave empty if none.">
        <FlagList name="data-sensitive" labels={sensitiveLabels} flags={draft.data.sensitive} onChange={(k, on) => update((d) => void (d.data.sensitive[k] = on))} />
      </QuestionGroup>

      {draft.footprint.entities.map((e, i) => {
        const country = countryName(config, e.jurisdiction);
        return (
          <CountrySection
            key={e.jurisdiction}
            name={country}
            note={`Roughly how many individuals located in ${country} do you hold personal data about per year? Bands are enough.`}
          >
            {peopleQuestions.map(({ qid, field, set }) => (
              <BandQuestion
                key={qid}
                qid={qid}
                jurisdiction={e.jurisdiction}
                vars={{ country }}
                set={set}
                value={e.people[field]}
                error={errors[anchorId(qid, e.jurisdiction)]}
                onChange={(a) => update((d) => void (d.footprint.entities[i]!.people[field] = a))}
              />
            ))}
            {needsTxSale(e) ? (
              <QuestionGroup qid="tx-sale" jurisdiction={e.jurisdiction} vars={{ country }} error={errors[anchorId("tx-sale", e.jurisdiction)]}>
                <YesNoAnswer
                  name={anchorId("tx-sale", e.jurisdiction)}
                  value={e.txSale}
                  onChange={(a) => update((d) => void (d.footprint.entities[i]!.txSale = a))}
                />
              </QuestionGroup>
            ) : null}
          </CountrySection>
        );
      })}
    </div>
  );
}

export const peopleStep: StepDef = {
  id: "people",
  title: "People and data",
  intro: "Whose personal data the group handles, which sensitive categories are involved, and roughly how many people in each country.",
  questionIds: ["data-subjects", "data-sensitive", ...peopleQuestions.map((q) => q.qid), "tx-sale"],
  validate: (draft, config) => {
    const v = issueCollector(config);
    v.require(Object.values(draft.data.subjects).some(Boolean), "data-subjects", undefined, "Select at least one group of people.");
    for (const e of draft.footprint.entities) {
      for (const { qid, field } of peopleQuestions) v.require(e.people[field], qid, e.jurisdiction);
      if (needsTxSale(e)) v.require(e.txSale, "tx-sale", e.jurisdiction);
    }
    return v.issues;
  },
  Component: PeopleStep,
};
