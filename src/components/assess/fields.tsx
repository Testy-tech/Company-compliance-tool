"use client";

import { useId, useState } from "react";
import { CircleAlert, Info } from "lucide-react";

import { bandSets, type BandSetId } from "@/lib/intake/bands";
import { anchorId, copy, type QuestionId } from "@/lib/intake/questions";
import type { Answer } from "@/lib/intake/schema";
import { cn } from "@/lib/utils";

/* Form controls for the intake wizard. Native inputs throughout, so every
 * option (including "Don't know") is reachable by keyboard and screen reader. */

export type Option = { value: string; label: string };

const UNKNOWN = "__unknown";
const WITHHELD = "__withheld";

const optionClass =
  "flex min-h-11 items-center gap-2.5 rounded-lg border border-input bg-card px-3 py-2 text-sm has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:opacity-60";
const inputClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

/** "Why we ask": a disclosure button, not a hover tooltip, so it works with keyboard, touch and screen readers. */
export function WhyWeAsk({ why, help }: { why: string; help?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-6 items-center gap-1.5 rounded text-sm text-brass underline-offset-4 hover:underline"
      >
        <Info aria-hidden="true" className="size-3.5" />
        Why we ask
      </button>
      <div id={id} hidden={!open} className="marginal-note mt-2 max-w-prose">
        <p>{why}</p>
        {help ? <p className="mt-1.5">{linkify(help)}</p> : null}
      </div>
    </div>
  );
}

function linkify(text: string) {
  return text.split(/(https:\/\/\S+)/).map((part, i) =>
    part.startsWith("https://") ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
      <CircleAlert aria-hidden="true" className="size-4" />
      {error}
    </p>
  );
}

type QuestionProps = {
  /** Question id from the copy table; with `jurisdiction` it forms the DOM anchor used by "Resolve" links. */
  qid: QuestionId;
  jurisdiction?: string;
  vars?: Record<string, string>;
  error?: string;
  hint?: string;
};

/** A group of radios or checkboxes. */
export function QuestionGroup({ qid, jurisdiction, vars, error, hint, children }: QuestionProps & { children: React.ReactNode }) {
  const anchor = anchorId(qid, jurisdiction);
  const { label, why, help } = copy(qid, vars);
  return (
    <fieldset id={anchor} tabIndex={-1} aria-describedby={error ? `${anchor}-error` : undefined} className="min-w-0 outline-none">
      <legend className="font-medium text-foreground">{label}</legend>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <WhyWeAsk why={why} help={help} />
      <div className="mt-3">{children}</div>
      <ErrorText id={`${anchor}-error`} error={error} />
    </fieldset>
  );
}

/** A single text input or select; `children` receives the ids to wire up. */
export function QuestionField({
  qid, jurisdiction, vars, error, hint, children,
}: QuestionProps & { children: (ids: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode }) {
  const anchor = anchorId(qid, jurisdiction);
  const { label, why, help } = copy(qid, vars);
  return (
    <div id={anchor}>
      <label htmlFor={`${anchor}-input`} className="font-medium text-foreground">
        {label}
      </label>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <WhyWeAsk why={why} help={help} />
      <div className="mt-3 max-w-md">
        {children({ id: `${anchor}-input`, "aria-describedby": error ? `${anchor}-error` : undefined, "aria-invalid": error ? true : undefined })}
      </div>
      <ErrorText id={`${anchor}-error`} error={error} />
    </div>
  );
}

export function TextInput(props: React.ComponentProps<"input">) {
  return <input type="text" {...props} className={cn(inputClass, props.className)} />;
}

export function Select({ options, placeholder, ...props }: React.ComponentProps<"select"> & { options: Option[]; placeholder: string }) {
  return (
    <select {...props} className={cn(inputClass, props.className)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function RadioList({
  name, options, value, onChange, columns = false,
}: { name: string; options: Option[]; value: string | undefined; onChange: (v: string) => void; columns?: boolean }) {
  return (
    <div className={cn("grid gap-2", columns ? "sm:grid-cols-2" : "sm:flex sm:flex-wrap")}>
      {options.map((o) => (
        <label key={o.value} className={optionClass}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="size-4 shrink-0 accent-primary" />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function CheckList({
  name, options, values, onToggle, disabled = [],
}: { name: string; options: Option[]; values: readonly string[]; onToggle: (v: string, checked: boolean) => void; disabled?: readonly string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.value} className={optionClass}>
          <input
            type="checkbox"
            name={name}
            value={o.value}
            checked={values.includes(o.value)}
            disabled={disabled.includes(o.value)}
            onChange={(e) => onToggle(o.value, e.target.checked)}
            className="size-4 shrink-0 accent-primary"
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/** Checklist bound to a {key: boolean} record. */
export function FlagList({
  name, labels, flags, onChange,
}: { name: string; labels: Record<string, string>; flags: Record<string, boolean>; onChange: (key: string, checked: boolean) => void }) {
  return (
    <CheckList
      name={name}
      options={Object.entries(labels).map(([value, label]) => ({ value, label }))}
      values={Object.keys(flags).filter((k) => flags[k])}
      onToggle={onChange}
    />
  );
}

export const yesNo: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** Radios for a plain yes/no answer (no "Don't know"). */
export function YesNoRadio({ name, value, onChange }: { name: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return <RadioList name={name} options={yesNo} value={value === undefined ? undefined : value ? "yes" : "no"} onChange={(v) => onChange(v === "yes")} />;
}

/** Radios for an Answer<string>: the options, then "Don't know" (and "Prefer not to say") as ordinary radios. */
export function AnswerRadio({
  name, options, value, onChange, withheld = false, columns,
}: {
  name: string;
  options: Option[];
  value: Answer<string> | undefined;
  onChange: (a: Answer<string>) => void;
  withheld?: boolean;
  columns?: boolean;
}) {
  const all = [...options, { value: UNKNOWN, label: "Don't know" }, ...(withheld ? [{ value: WITHHELD, label: "Prefer not to say" }] : [])];
  const current = !value ? undefined : value.status === "known" ? value.value : value.status === "unknown" ? UNKNOWN : WITHHELD;
  return (
    <RadioList
      name={name}
      options={all}
      value={current}
      columns={columns}
      onChange={(v) => onChange(v === UNKNOWN ? { status: "unknown" } : v === WITHHELD ? { status: "withheld" } : { status: "known", value: v })}
    />
  );
}

/** Yes | No | Don't know. */
export function YesNoAnswer({ name, value, onChange }: { name: string; value: Answer<boolean> | undefined; onChange: (a: Answer<boolean>) => void }) {
  return (
    <AnswerRadio
      name={name}
      options={yesNo}
      value={value?.status === "known" ? { status: "known", value: value.value ? "yes" : "no" } : value}
      onChange={(a) => onChange(a.status === "known" ? { status: "known", value: a.value === "yes" } : a)}
    />
  );
}

/** A banded numeric question: one radio per band from bands.json, plus "Don't know". */
export function BandQuestion({
  set, value, onChange, withheld, ...q
}: QuestionProps & { set: BandSetId; value: Answer<string> | undefined; onChange: (a: Answer<string>) => void; withheld?: boolean }) {
  return (
    <QuestionGroup {...q}>
      <AnswerRadio
        name={anchorId(q.qid, q.jurisdiction)}
        options={bandSets[set].bands.map((b) => ({ value: b.id, label: b.label }))}
        value={value}
        onChange={onChange}
        withheld={withheld}
      />
    </QuestionGroup>
  );
}

/** Card wrapping the questions for one country. */
export function CountrySection({ name, note, children }: { name: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 sm:p-6">
      <h3 className="text-xl font-semibold text-primary">{name}</h3>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
      <div className="mt-5 space-y-8">{children}</div>
    </section>
  );
}
