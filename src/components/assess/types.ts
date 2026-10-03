import type { ComponentType } from "react";

import type { Draft } from "@/lib/intake/draft";
import { anchorId, copy, type QuestionId } from "@/lib/intake/questions";
import type { WizardConfig } from "@/lib/kb/wizard-config";

/** A validation problem, tied to the DOM anchor of the question it belongs to. */
export type StepIssue = { anchor: string; label: string; message: string };

export type StepProps = {
  draft: Draft;
  /** Apply a change to a copy of the draft; the result is saved to the session. */
  update: (change: (draft: Draft) => void) => void;
  config: WizardConfig;
  /** Error message per question anchor, set after a failed "Next". */
  errors: Record<string, string>;
  /** Jump to another step (used by the review step's "Edit" links). */
  goTo: (stepIndex: number) => void;
};

export type StepDef = {
  id: string;
  title: string;
  intro: string;
  /** Question ids shown on this step, so "Resolve" links (#q-<id>-<jurisdiction>) can find it. */
  questionIds: readonly QuestionId[];
  validate: (draft: Draft, config: WizardConfig) => StepIssue[];
  Component: ComponentType<StepProps>;
};

export const countryName = (config: WizardConfig, id: string) => config.jurisdictions.find((j) => j.id === id)?.name ?? id;

/** Collects "please answer" issues for a step's validate function. */
export function issueCollector(config: WizardConfig) {
  const issues: StepIssue[] = [];
  return {
    issues,
    require(
      answered: unknown,
      qid: QuestionId,
      jurisdiction?: string,
      message = "Please choose an answer (“Don't know” is fine).",
      vars: Record<string, string> = {},
    ) {
      if (answered !== undefined && answered !== "" && answered !== false) return;
      const country = config.jurisdictions.find((j) => j.id === jurisdiction)?.name;
      const { label } = copy(qid, { ...(country ? { country } : {}), ...vars });
      issues.push({ anchor: anchorId(qid, jurisdiction), label: country ? `${country}: ${label}` : label, message });
    },
  };
}
