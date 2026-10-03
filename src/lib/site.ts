export const site = {
  name: "DataBorders",
  /** Public origin, used for canonical URLs, the sitemap and social cards. Set NEXT_PUBLIC_SITE_URL at deployment. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
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
