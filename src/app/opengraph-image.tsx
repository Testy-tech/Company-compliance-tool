import { ogCard, ogContentType, ogSize } from "@/lib/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogCard({
    eyebrow: "Cross-border data protection",
    title: "What every jurisdiction asks of you, measured against GDPR",
    footer: "Informational tool · every obligation cited to an official source",
  });
}
