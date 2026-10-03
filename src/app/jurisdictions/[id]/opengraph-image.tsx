import { coveredJurisdictions } from "@/lib/intake/schema";
import { knowledgeBase } from "@/lib/kb/repository";
import type { JurisdictionId } from "@/lib/kb/schema";
import { ogCard, ogContentType, ogSize } from "@/lib/og";
import { formatDate } from "@/lib/report/labels";

export const alt = "Data protection obligations by jurisdiction";
export const size = ogSize;
export const contentType = ogContentType;
export const generateStaticParams = () => coveredJurisdictions.map((id) => ({ id }));

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const j = (coveredJurisdictions as readonly string[]).includes(id) ? await knowledgeBase.get(id as JurisdictionId) : null;
  return ogCard({
    eyebrow: "Data protection in",
    title: j?.name ?? "Jurisdictions",
    footer: j ? `${j.obligations.length} obligations · ${j.laws.map((l) => l.shortName).slice(0, 3).join(" · ")} · reviewed ${formatDate(j.lastReviewed)}` : "DataBorders jurisdiction library",
  });
}
