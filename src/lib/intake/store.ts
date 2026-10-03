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

export interface IntakeStore {
  load(): IntakeDraft | null;
  save(draft: IntakeDraft): void;
  clear(): void;
}

const KEY = "databorders.intake.v1";

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
    } catch {
      /* ignore */
    }
  }
}
