import type {
  consentBannerValues, employeeRepValues, entityTypes, frameworkKeys, hostingValues, hrOnlyValues, industries,
  processingKeys, providerRegions, sensitiveKeys, subjectKeys, trackerValues, vendorValues,
} from "./schema";

/* Display labels for option values. Never use the word "consumers" here. */

type Labels<T extends readonly string[]> = Record<T[number], string>;

export const industryLabels: Labels<typeof industries> = {
  engineering_construction: "Engineering & construction",
  manufacturing: "Manufacturing",
  energy_utilities: "Energy & utilities",
  professional_services: "Professional services",
  technology: "Technology",
  other: "Other",
};

export const entityTypeLabels: Labels<typeof entityTypes> = {
  subsidiary: "Subsidiary (local company)",
  branch: "Branch",
  rep_office: "Representative office",
  none: "No local entity (activity only)",
};

export const employeeRepLabels: Labels<typeof employeeRepValues> = {
  works_council: "Works council",
  union: "Union",
  both: "Both",
  none: "None",
};

export const hrOnlyLabels: Labels<typeof hrOnlyValues> = {
  only_hr: "Yes, only HR data",
  mixed: "Mixed",
  no: "No",
};

export const providerRegionLabels: Labels<typeof providerRegions> = {
  EEA: "EU / EEA",
  GB: "United Kingdom",
  US: "United States",
  CH: "Switzerland",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  IN: "India",
  CN: "China",
  OTHER: "Another country",
};

export const trackerLabels: Labels<typeof trackerValues> = {
  analytics: "Analytics (e.g. Google Analytics)",
  ad_pixels: "Advertising/retargeting pixels (e.g. LinkedIn Insight Tag, Meta Pixel)",
  session_replay: "Session recording/heatmaps",
  chat: "Chat widget",
  embeds: "Embedded videos/maps",
};

export const consentBannerLabels: Labels<typeof consentBannerValues> = {
  blocking: "Yes, blocks trackers until consent",
  informational: "Yes, informational only",
  none: "No",
};

export const hostingLabels: Labels<typeof hostingValues> = {
  hq_eu: "At headquarters (own servers)",
  local: "In each local country",
  cloud_eu: "Cloud, EU region",
  cloud_us: "Cloud, US region",
  cloud_other: "Cloud, other region",
};

export const vendorLabels: Labels<typeof vendorValues> = {
  cloud_it: "Cloud & IT services",
  payroll_hr: "Payroll & HR systems",
  recruiting: "Recruiting platforms",
  security_cctv: "Security & CCTV providers",
  marketing: "Marketing & CRM tools",
  travel: "Travel & expenses",
  other: "Other",
};

export const subjectLabels: Labels<typeof subjectKeys> = {
  employees: "Employees",
  contractors: "Contractors",
  applicants: "Job applicants",
  b2bContacts: "Business contacts (clients, suppliers, partners)",
  endUsers: "End users or members of the public (acting privately)",
  siteVisitors: "Visitors to sites and offices",
};

export const sensitiveLabels: Labels<typeof sensitiveKeys> = {
  health: "Health data",
  biometrics: "Biometrics (fingerprint, face)",
  criminal: "Criminal records",
  union: "Union membership",
  children: "Data of minors",
  preciseLocation: "Precise location",
  financialAccounts: "Financial account details",
  nationalId: "National ID numbers",
};

export const processingLabels: Labels<typeof processingKeys> = {
  hrPayroll: "HR & payroll",
  recruiting: "Recruiting",
  siteAccess: "Site safety & access control",
  cctv: "CCTV",
  marketing: "Marketing",
  crm: "CRM",
  rnd: "R&D / engineering data",
  employeeMonitoring: "Employee monitoring (IT, vehicles, productivity)",
  automatedDecisions: "AI or automated decision-making",
};

export const frameworkLabels: Labels<typeof frameworkKeys> = {
  ropa: "Record of processing activities (RoPA)",
  dpia: "DPIA process and template",
  sccs: "Standard contractual clauses for transfers",
  tia: "Transfer impact assessments",
  dpo: "Data protection officer",
  breachProcedure: "Breach response procedure",
  dsarProcedure: "Procedure for individuals' rights requests",
  vendorDpas: "Processor agreements with vendors",
  privacyNotices: "Privacy notices (staff, website)",
  training: "Staff privacy training",
  retentionSchedule: "Retention schedule",
};

export const governanceLabels = {
  centralized: "Centralised — HQ decides and runs privacy for the group",
  hub_and_spoke: "Hub and spoke — HQ sets policy, local contacts implement",
  decentralized: "Decentralised — each entity runs its own programme",
} as const;
