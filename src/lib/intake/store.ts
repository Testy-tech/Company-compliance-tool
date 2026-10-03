/*
 * Storage boundary for intake drafts. MVP: browser sessionStorage only — nothing
 * is sent to or stored on the server. A database-backed store can implement the
 * same interface later.
 */

export type IntakeDraft = {
  version: 1;
  /** ISO date the assessment is made as of; set when the draft is started and kept on every save. */
  assessmentDate: string;
  step: number;
  values: unknown;
  updatedAt: string;
};

/** What the user did on the report: ticked checklist items and the reviewer-mode switch. */
export type ReportState = {
  version: 1;
  /** Obligation id → done. */
  checklist: Record<string, boolean>;
  reviewerMode: boolean;
  /** The user allowed this report to send data to Anthropic (off by default). */
  aiConsent: boolean;
  /** Tailored wording per obligation id, valid only for the assessment it was made for. */
  tailored?: { signature: string; model: string; items: Record<string, { explanation: string; steps: string[] }> };
  /** Obligation id → the user switched this item back to the standard text. */
  showStandard: Record<string, boolean>;
};

export const emptyReportState = (): ReportState => ({ version: 1, checklist: {}, reviewerMode: false, aiConsent: false, showStandard: {} });

export interface IntakeStore {
  load(): IntakeDraft | null;
  save(draft: IntakeDraft): void;
  clear(): void;
  loadReportState(): ReportState;
  saveReportState(state: ReportState): void;
}

const KEY = "databorders.intake.v1";
const REPORT_KEY = "databorders.report.v1";

export class SessionIntakeStore implements IntakeStore {
  load(): IntakeDraft | null {
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as IntakeDraft;
      return parsed?.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }
  save(draft: IntakeDraft): void {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // Storage unavailable (private mode, quota): the wizard still works in memory.
    }
  }
  clear(): void {
    try {
      window.sessionStorage.removeItem(KEY);
      window.sessionStorage.removeItem(REPORT_KEY);
    } catch {
      /* ignore */
    }
  }
  loadReportState(): ReportState {
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(REPORT_KEY) ?? "null") as ReportState | null;
      return parsed?.version === 1 ? { ...emptyReportState(), ...parsed } : emptyReportState();
    } catch {
      return emptyReportState();
    }
  }
  saveReportState(state: ReportState): void {
    try {
      window.sessionStorage.setItem(REPORT_KEY, JSON.stringify(state));
    } catch {
      /* ignore: the report still works in memory */
    }
  }
}
