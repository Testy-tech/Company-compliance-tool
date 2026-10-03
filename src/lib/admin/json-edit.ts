/*
 * Text-level edits to the hand-formatted knowledge-base JSON files. The review
 * console changes one obligation at a time; rewriting a whole file with
 * JSON.stringify would reflow every rule and bury the real change in the diff.
 * These helpers locate one obligation and replace, insert or remove single
 * properties in place, leaving every other byte of the file untouched.
 */

/** Index just past the JSON value that starts at `start` (string, array, object, or scalar). */
function endOfValue(text: string, start: number): number {
  const first = text[start];
  if (first === '"') {
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === "\\") i++;
      else if (text[i] === '"') return i + 1;
    }
    throw new Error("Unterminated string");
  }
  if (first === "{" || first === "[") {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') i = endOfValue(text, i) - 1;
      else if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    throw new Error("Unterminated object or array");
  }
  let i = start;
  while (i < text.length && !/[,\s}\]]/.test(text[i]!)) i++;
  return i;
}

/** Start and end (exclusive) of the obligation object with this id. */
export function obligationSpan(text: string, id: string): { start: number; end: number } {
  const marker = text.indexOf(`"id": ${JSON.stringify(id)}`);
  if (marker < 0) throw new Error(`Obligation ${id} not found`);
  const start = text.lastIndexOf("{", marker);
  return { start, end: endOfValue(text, start) };
}

type Property = { key: string; keyStart: number; valueStart: number; valueEnd: number };

/** Top-level properties of an object's text, in order. */
function properties(object: string): Property[] {
  const out: Property[] = [];
  let i = 1;
  while (i < object.length) {
    while (i < object.length && /[\s,]/.test(object[i]!)) i++;
    if (object[i] !== '"') break;
    const keyStart = i;
    const keyEnd = endOfValue(object, i);
    const key = JSON.parse(object.slice(keyStart, keyEnd)) as string;
    i = keyEnd;
    while (/[\s:]/.test(object[i]!)) i++;
    const valueStart = i;
    const valueEnd = endOfValue(object, valueStart);
    out.push({ key, keyStart, valueStart, valueEnd });
    i = valueEnd;
  }
  return out;
}

/** Indentation of the object's properties (taken from its first property). */
function indentOf(object: string): string {
  const m = /^\{\n?([ \t]*)"/.exec(object);
  return m?.[1] ?? "  ";
}

const inlineObject = (o: Record<string, unknown>) => `{ ${Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;

/** A value in the files' own style: strings inline, lists one item per line, source objects inline. */
export function formatValue(value: unknown, indent: string): string {
  if (!Array.isArray(value)) return JSON.stringify(value);
  const items = value.map((v) => (v && typeof v === "object" ? inlineObject(v as Record<string, unknown>) : JSON.stringify(v)));
  if (items.length <= 1) return `[${items.join("")}]`;
  return `[\n${items.map((x) => `${indent}  ${x}`).join(",\n")}\n${indent}]`;
}

/**
 * Set properties on an object's text. `undefined` removes a property. New
 * properties are inserted after `after` (or at the end). Returns the new text.
 */
export function setFields(object: string, fields: Record<string, unknown>, after?: string): string {
  const indent = indentOf(object);
  let text = object;
  for (const [key, value] of Object.entries(fields)) {
    const props = properties(text);
    const existing = props.find((p) => p.key === key);
    if (value === undefined) {
      if (!existing) continue;
      const index = props.indexOf(existing);
      const next = props[index + 1];
      const previous = props[index - 1];
      // Remove the property together with the comma that separated it from a neighbour.
      text = next ? text.slice(0, existing.keyStart) + text.slice(next.keyStart) : previous ? text.slice(0, previous.valueEnd) + text.slice(existing.valueEnd) : text;
    } else if (existing) {
      text = text.slice(0, existing.valueStart) + formatValue(value, indent) + text.slice(existing.valueEnd);
    } else {
      const anchor = props.find((p) => p.key === after) ?? props.at(-1);
      if (!anchor) throw new Error("Cannot insert into an empty object");
      text = `${text.slice(0, anchor.valueEnd)},\n${indent}${JSON.stringify(key)}: ${formatValue(value, indent)}${text.slice(anchor.valueEnd)}`;
    }
  }
  return text;
}

/** Apply field changes to one obligation in a jurisdiction file's text. */
export function editObligation(fileText: string, id: string, fields: Record<string, unknown>, after?: string): string {
  const { start, end } = obligationSpan(fileText, id);
  return fileText.slice(0, start) + setFields(fileText.slice(start, end), fields, after) + fileText.slice(end);
}
