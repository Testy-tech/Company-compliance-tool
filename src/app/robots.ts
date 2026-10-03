import type { MetadataRoute } from "next";

import { libraryIsPublic } from "@/lib/kb/publication";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/report", "/research-log/", "/admin/", ...(libraryIsPublic() ? [] : ["/jurisdictions"])] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
