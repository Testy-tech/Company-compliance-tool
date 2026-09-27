/* Checks that every URL cited in /content/jurisdictions resolves. Network-dependent: run manually
 * (npm run check:links), not in the build. Some official sites block bots (403, e.g. sso.agc.gov.sg) and some
 * US state sites fail Node TLS verification (TypeError) while working in browsers/curl — re-check those manually. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "content", "jurisdictions");
const urls = new Set<string>();
const collect = (v: unknown): void => {
  if (typeof v === "string" && v.startsWith("https://")) urls.add(v);
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === "object") Object.values(v).forEach(collect);
};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")))
  collect(JSON.parse(readFileSync(path.join(dir, f), "utf8")));

const results = await Promise.all(
  [...urls].map(async (url) => {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
        headers: { "user-agent": "Mozilla/5.0 (DataBorders link check)" },
      });
      return { url, status: res.status };
    } catch (e) {
      return { url, status: `ERR ${(e as Error).name}` };
    }
  }),
);
for (const r of results.sort((a, b) => String(a.status).localeCompare(String(b.status))))
  if (r.status !== 200) console.log(`${r.status}\t${r.url}`);
console.log(`\n${results.filter((r) => r.status === 200).length}/${results.length} URLs returned 200`);
