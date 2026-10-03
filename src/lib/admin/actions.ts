import { z } from "zod";

import { obligationSchema } from "@/lib/kb/schema";

/* Review actions and their validation. No Node imports: the console's edit form uses the same schema in the browser. */

export const editFieldsSchema = obligationSchema.pick({ requirement: true, actionSteps: true, sources: true }).extend({
  deadlineOrTimeline: z.string().trim().max(300).optional(),
  penaltyNote: z.string().trim().max(600).optional(),
});
export type EditFields = z.infer<typeof editFieldsSchema>;

export const reviewActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), id: z.string() }),
  z.object({ action: z.literal("flag"), id: z.string(), note: z.string().trim().min(5, "Say what needs checking (at least 5 characters)").max(1000) }),
  z.object({ action: z.literal("edit"), id: z.string(), fields: editFieldsSchema }),
]);
export type ReviewAction = z.infer<typeof reviewActionSchema>;

export type ReviewLogEntry = {
  at: string;
  reviewer: string;
  action: ReviewAction["action"];
  id: string;
  title: string;
  note?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

export type ReviewResult = { ok: true; entry: ReviewLogEntry } | { ok: false; stage: "config" | "input" | "validator" | "tests"; errors: string[] };
