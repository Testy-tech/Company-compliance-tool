"use client";

import { consentBannerLabels, trackerLabels } from "@/lib/intake/options";
import type { Answer } from "@/lib/intake/schema";

import { AnswerRadio, CheckList, QuestionGroup, RadioList } from "../fields";
import { countryName, issueCollector, type StepDef, type StepProps } from "../types";

const NONE = "__none";
const UNKNOWN = "__unknown";
const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

const trackerOptions = [...toOptions(trackerLabels), { value: NONE, label: "None" }, { value: UNKNOWN, label: "Don't know" }];

/** "None" and "Don't know" are ordinary checkboxes that clear the other selections. */
function toggleTracker(current: Answer<string[]> | undefined, value: string, on: boolean): Answer<string[]> | undefined {
  if (value === NONE) return on ? { status: "known", value: [] } : undefined;
  if (value === UNKNOWN) return on ? { status: "unknown" } : undefined;
  const list = current?.status === "known" ? current.value : [];
  const next = on ? [...list, value] : list.filter((v) => v !== value);
  return next.length ? { status: "known", value: next } : undefined;
}

function WebsiteStep({ draft, update, config, errors }: StepProps) {
  const w = draft.website;
  const trackerValues = !w.trackers ? [] : w.trackers.status !== "known" ? [UNKNOWN] : w.trackers.value.length ? w.trackers.value : [NONE];

  return (
    <div className="space-y-8">
      <QuestionGroup qid="web-trackers" error={errors["q-web-trackers"]} hint="Select all that apply.">
        <CheckList
          name="web-trackers"
          options={trackerOptions}
          values={trackerValues}
          onToggle={(v, on) => update((d) => void (d.website.trackers = toggleTracker(d.website.trackers, v, on)))}
        />
      </QuestionGroup>

      <QuestionGroup qid="web-consent-banner" error={errors["q-web-consent-banner"]}>
        <AnswerRadio
          name="web-consent-banner"
          options={toOptions(consentBannerLabels)}
          value={w.consentBanner}
          onChange={(a) => update((d) => void (d.website.consentBanner = a))}
        />
      </QuestionGroup>

      <QuestionGroup qid="web-country-sites" error={errors["q-web-country-sites"]}>
        <RadioList
          name="web-country-sites"
          options={[
            { value: "yes", label: "Yes (select countries)" },
            { value: "no", label: "No" },
            { value: "unknown", label: "Don't know" },
          ]}
          value={w.countrySitesChoice}
          onChange={(v) => update((d) => void (d.website.countrySitesChoice = v as "yes" | "no" | "unknown"))}
        />
        {w.countrySitesChoice === "yes" ? (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">Which countries have their own version?</legend>
            <div className="mt-2">
              <CheckList
                name="web-country-sites-list"
                options={draft.footprint.entities.map((e) => ({ value: e.jurisdiction, label: countryName(config, e.jurisdiction) }))}
                values={w.countrySites}
                onToggle={(v, on) =>
                  update((d) => void (d.website.countrySites = on ? [...d.website.countrySites, v] : d.website.countrySites.filter((c) => c !== v)))
                }
              />
            </div>
          </fieldset>
        ) : null}
      </QuestionGroup>
    </div>
  );
}

export const websiteStep: StepDef = {
  id: "website",
  title: "Website and tracking",
  intro: "Trackers on the group's websites, including business-to-business sites.",
  questionIds: ["web-trackers", "web-consent-banner", "web-country-sites"],
  validate: (draft, config) => {
    const v = issueCollector(config);
    const w = draft.website;
    v.require(w.trackers, "web-trackers", undefined, "Select what applies, or “None” or “Don't know”.");
    v.require(w.consentBanner, "web-consent-banner");
    v.require(w.countrySitesChoice, "web-country-sites");
    if (w.countrySitesChoice === "yes") {
      const selected = draft.footprint.entities.map((e) => e.jurisdiction as string);
      v.require(w.countrySites.some((c) => selected.includes(c)), "web-country-sites", undefined, "Select at least one country, or choose “No”.");
    }
    return v.issues;
  },
  Component: WebsiteStep,
};
