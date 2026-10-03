import { z } from "zod";

/*
 * The /api/tailor request, shared by the browser (which builds it) and the
 * route (which validates it). No SDK import here, so it is safe in client code.
 */

/** One request tailors one jurisdiction; keep in step with aiConfig.tailor.maxObligations. */
export const MAX_OBLIGATIONS_PER_REQUEST = 20;

const short = (max: number) => z.string().trim().min(1).max(max);

/** What the browser sends: one jurisdiction's applicable obligations plus non-identifying facts. */
export const tailorRequestSchema = z
  .object({
    /** The user ticked the opt-in box. */
    consent: z.literal(true),
    jurisdiction: z.object({ id: short(8), name: short(80) }),
    company: z.object({
      /** Present only when the user marked the label as anonymised; a real company name is never sent. */
      anonymisedLabel: short(120).optional(),
      industry: short(60),
      hqCountry: z.string().regex(/^[A-Z]{2}$/),
      gdprBaseline: z.boolean(),
      governanceModel: short(40),
      localContacts: z.boolean(),
    }),
    entity: z.object({ role: short(60), entityType: short(60), status: short(60) }),
    facts: z.object({
      subjects: z.array(short(80)).max(12),
      sensitiveData: z.array(short(80)).max(12),
      processing: z.array(short(80)).max(12),
      gdprArtefactsInPlace: z.array(short(80)).max(16),
    }),
    obligations: z
      .array(
        z.object({
          id: z.string().regex(/^[A-Z]{2}(-[A-Z]{2})?-[A-Z_]+-\d{2}$/),
          title: short(200),
          requirement: short(1200),
          whyItApplies: short(400),
          actionSteps: z.array(short(600)).min(1).max(12),
          applicability: z.enum(["applies", "assumed"]),
          assumptions: z.array(short(400)).max(8),
          owner: short(40),
          gdprEquivalent: short(200).optional(),
        }),
      )
      .min(1)
      .max(MAX_OBLIGATIONS_PER_REQUEST),
  })
  .strict();

export type TailorRequest = z.infer<typeof tailorRequestSchema>;

export type TailoredItem = { id: string; tailoredExplanation: string; tailoredSteps: string[] };
