import type { MetadataRoute } from "next";

import { libraryIsPublic, libraryPaths } from "@/lib/kb/publication";
import { knowledgeBase } from "@/lib/kb/repository";
import { site } from "@/lib/site";

/* Public pages only. The report and the research logs are session- or reviewer-facing and are left out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const kb = await knowledgeBase.list();
  const latest = kb.map((j) => j.lastReviewed).sort().at(-1);
  const page = (path: string, lastModified: string | undefined, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${site.url}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority,
  });
  return [
    page("/", latest, 1),
    page("/assess", undefined, 0.8),
    // The library is listed only once the publication gate is open.
    ...libraryPaths(kb, libraryIsPublic()).map((path) => page(path, kb.find((j) => path.endsWith(`/${j.id}`))?.lastReviewed ?? latest, path === "/jurisdictions" ? 0.9 : 0.7)),
    page("/methodology", undefined, 0.6),
    page("/legal", undefined, 0.3),
  ];
}
