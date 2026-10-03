"use client";

import { useMemo } from "react";

import { countryOptions } from "@/lib/intake/countries";
import { syncHqEntity } from "@/lib/intake/draft";
import { industryLabels } from "@/lib/intake/options";
import type { Answer } from "@/lib/intake/schema";

import { BandQuestion, QuestionField, QuestionGroup, RadioList, Select, TextInput } from "../fields";
import { issueCollector, type StepDef, type StepProps } from "../types";

const usStates = [
  { value: "CA", label: "California" },
  { value: "TX", label: "Texas" },
  { value: "other", label: "Another state" },
];

function CompanyStep({ draft, update, config, errors }: StepProps) {
  const c = draft.company;
  const countries = useMemo(() => countryOptions().map((o) => ({ value: o.code, label: o.name })), []);
  const covered = config.jurisdictions.map((j) => j.id);

  return (
    <div className="space-y-8">
      <QuestionField qid="company-label" error={errors["q-company-label"]}>
        {(ids) => (
          <>
            <TextInput
              {...ids}
              value={c.label}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => update((d) => void (d.company.label = e.target.value))}
            />
            <label className="mt-3 flex min-h-11 items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={c.anonymized}
                onChange={(e) => update((d) => void (d.company.anonymized = e.target.checked))}
                className="size-4 accent-primary"
              />
              This is an anonymised label, not the real company name
            </label>
          </>
        )}
      </QuestionField>

      <QuestionField qid="hq-country" error={errors["q-hq-country"]}>
        {(ids) => (
          <Select
            {...ids}
            options={countries}
            placeholder="Select a country"
            value={c.hqCountry}
            onChange={(e) =>
              update((d) => {
                d.company.hqCountry = e.target.value;
                if (e.target.value !== "US") d.company.hqUsState = undefined;
                syncHqEntity(d, covered);
              })
            }
          />
        )}
      </QuestionField>

      {c.hqCountry === "US" ? (
        <QuestionGroup qid="hq-us-state" error={errors["q-hq-us-state"]}>
          <RadioList
            name="hq-us-state"
            options={usStates}
            value={c.hqUsState}
            onChange={(v) =>
              update((d) => {
                d.company.hqUsState = v as "CA" | "TX" | "other";
                syncHqEntity(d, covered);
              })
            }
          />
        </QuestionGroup>
      ) : null}

      <QuestionGroup qid="gdpr-baseline" error={errors["q-gdpr-baseline"]}>
        <RadioList
          name="gdpr-baseline"
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          value={c.gdprBaseline}
          onChange={(v) => update((d) => void (d.company.gdprBaseline = v as "yes" | "no"))}
        />
      </QuestionGroup>

      <QuestionGroup qid="industry" error={errors["q-industry"]}>
        <RadioList
          name="industry"
          columns
          options={Object.entries(industryLabels).map(([value, label]) => ({ value, label }))}
          value={c.industry}
          onChange={(v) => update((d) => void (d.company.industry = v))}
        />
      </QuestionGroup>

      <BandQuestion
        qid="group-headcount"
        set="headcount"
        value={c.groupHeadcount}
        onChange={(a: Answer<string>) => update((d) => void (d.company.groupHeadcount = a))}
        error={errors["q-group-headcount"]}
      />

      <BandQuestion
        qid="group-revenue"
        set="revenueEUR"
        withheld
        value={c.groupRevenue}
        onChange={(a: Answer<string>) => update((d) => void (d.company.groupRevenue = a))}
        error={errors["q-group-revenue"]}
      />
    </div>
  );
}

export const companyStep: StepDef = {
  id: "company",
  title: "Company",
  intro: "Who the assessment is for. Bands are enough — no exact figures are needed.",
  questionIds: ["company-label", "hq-country", "hq-us-state", "gdpr-baseline", "industry", "group-headcount", "group-revenue"],
  validate: ({ company: c }, config) => {
    const v = issueCollector(config);
    v.require(c.label.trim(), "company-label", undefined, "Enter a name or an anonymised label.");
    v.require(c.hqCountry, "hq-country", undefined, "Select the headquarters country.");
    if (c.hqCountry === "US") v.require(c.hqUsState, "hq-us-state");
    v.require(c.gdprBaseline, "gdpr-baseline", undefined, "Please choose Yes or No.");
    v.require(c.industry, "industry", undefined, "Please choose an industry.");
    v.require(c.groupHeadcount, "group-headcount");
    v.require(c.groupRevenue, "group-revenue");
    return v.issues;
  },
  Component: CompanyStep,
};
