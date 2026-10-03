import { z } from "zod";

import raw from "../../../content/config/eu-transfers.json";

import { sourceSchema } from "./schema";

/*
 * EU/EEA outbound transfer data (content/config/eu-transfers.json): the EEA
 * member list, the Commission's adequacy list with a lastVerified date, and the
 * mechanism labels the engine attaches to flows whose exporter is in the EEA.
 * Checked at build time by scripts/validate-kb.ts.
 */

const mechanismSchema = z.object({ label: z.string().min(5), source: sourceSchema });

export const euTransfersSchema = z.object({
  lastVerified: z.iso.date(),
  verifiedBy: z.string().min(1),
  confidence: z.enum(["verified", "needs_review", "unverified"]),
  eea: z.array(z.string().regex(/^[A-Z]{2}$/)).min(27),
  adequacy: z.object({
    source: sourceSchema,
    countries: z
      .array(
        z.object({
          code: z.string().regex(/^[A-Z]{2}$/),
          name: z.string().min(2),
          /** Limitation of the decision's scope, in our own words. */
          scope: z.string().optional(),
          /** Adequacy only for recipients certified under a framework (the United States). */
          certifiedOnly: z.boolean().optional(),
        }),
      )
      .min(1),
  }),
  mechanisms: z.object({ none: mechanismSchema, adequacy: mechanismSchema, dpf: mechanismSchema, sccs: mechanismSchema }),
});

export type EuTransfers = z.infer<typeof euTransfersSchema>;

export const euTransfers: EuTransfers = euTransfersSchema.parse(raw);

export const isEEA = (countryCode: string, eu: EuTransfers = euTransfers) => eu.eea.includes(countryCode);
