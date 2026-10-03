import type { StepDef } from "../types";
import { companyStep } from "./company";
import { footprintStep } from "./footprint";

/** Wizard steps in order. The review step is always last. */
export const steps: readonly StepDef[] = [companyStep, footprintStep];
