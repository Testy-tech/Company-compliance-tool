export const site = {
  name: "DataBorders",
  tagline: "Cross-border data protection compliance navigator",
  description:
    "Answer a structured questionnaire about your group's footprint and receive a jurisdiction-by-jurisdiction data protection checklist, measured against the GDPR programme you already run.",
} as const;

export const mainNav = [
  { href: "/assess", label: "Assessment" },
  { href: "/jurisdictions", label: "Jurisdictions" },
  { href: "/methodology", label: "Methodology" },
] as const;

export const footerNav = [
  { href: "/methodology", label: "Methodology" },
  { href: "/legal#disclaimer", label: "Disclaimer" },
  { href: "/legal#privacy", label: "Privacy policy" },
  { href: "/legal#imprint", label: "Imprint" },
] as const;
