import type { Obligation, ObligationCategory } from "@/lib/kb/schema";

/* Display labels for report values. */

export const categoryLabels: Record<ObligationCategory, string> = {
  governance: "Governance",
  dpo_representative: "Officer / representative",
  registration_filing: "Registration & filing",
  legal_basis_consent: "Legal basis & consent",
  notice: "Notices",
  data_subject_rights: "Individuals' rights",
  security: "Security",
  breach_notification: "Breach notification",
  cross_border_transfer: "Cross-border transfers",
  localization: "Localisation",
  impact_assessment: "Impact assessments",
  vendors_processors: "Vendors & processors",
  employee_data: "Employee data",
  marketing: "Marketing & tracking",
  sensitive_data: "Sensitive data",
  children: "Children",
  automated_decisions_ai: "Automated decisions & AI",
  records: "Records",
};

export const priorityLabels: Record<Obligation["priority"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};
export const priorityRank: Record<Obligation["priority"], number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const ownerLabels: Record<Obligation["owner"], string> = {
  HQ: "Headquarters",
  local_entity: "Local entity",
  both: "Headquarters + local entity",
};

export const confidenceLabels: Record<Obligation["confidence"], string> = {
  verified: "Verified by counsel",
  needs_review: "Needs counsel review",
  unverified: "Unverified — do not rely on it",
};

export const governanceModelLabels = {
  centralized: "Centralised",
  hub_and_spoke: "Hub and spoke",
  decentralized: "Decentralised",
} as const;

/** DOM anchor of an obligation in the report. */
export const obligationAnchor = (id: string) => `o-${id}`;
export const jurisdictionAnchor = (id: string) => `j-${id}`;
export const questionAnchor = (id: string) => `oq-${id.replace(/[^A-Za-z0-9_-]/g, "-")}`;

/** "2026-10-03" → "3 October 2026" (fixed locale and UTC, so server and client agree). */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}
