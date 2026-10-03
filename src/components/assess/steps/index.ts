import type { StepDef } from "../types";
import { companyStep } from "./company";
import { footprintStep } from "./footprint";
import { peopleStep } from "./people";

/** Wizard steps in order. The review step is always last. */
export const steps: readonly StepDef[] = [companyStep, footprintStep, peopleStep];
