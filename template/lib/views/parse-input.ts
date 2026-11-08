// Parse what a person typed into a typed cell value. Normalise once, where data enters.

import type { FieldDef } from "../schema/types.ts";
import { isEditable } from "../schema/types.ts";

export type Parsed = { ok: true; value: unknown } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim();
}

function parseNumber(f: FieldDef, s: string): Parsed {
  const cleaned = s.replace(/[\s,$€£%]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, error: `${f.label} must be a number` };
  // People type 25 for 25%; Airtable stores percent as a fraction.
  return { ok: true, value: f.type === "percent" ? (s.includes("%") || Math.abs(n) > 1 ? n / 100 : n) : n };
}

function parseChoice(f: FieldDef, s: string): Parsed {
  if (f.options?.some((o) => o.value === s)) return { ok: true, value: s };
  return { ok: false, error: `"${s}" is not an option for ${f.label}` };
}

export function parseInput(f: FieldDef, raw: unknown): Parsed {
  if (!isEditable(f)) return { ok: false, error: `${f.label} is computed and can't be edited` };
  if (f.type === "checkbox") return { ok: true, value: raw === true || raw === "true" || raw === "on" };
  if (f.type === "multiSelect" || (f.type === "link" && f.link?.multiple)) {
    const list = (Array.isArray(raw) ? raw : str(raw) ? str(raw).split(",") : []).map(str).filter(Boolean);
    if (f.type === "multiSelect") {
      const bad = list.find((v) => !f.options?.some((o) => o.value === v));
      if (bad) return { ok: false, error: `"${bad}" is not an option for ${f.label}` };
    }
    return { ok: true, value: [...new Set(list)] };
  }
  const s = str(raw);
  if (s === "") return f.required ? { ok: false, error: `${f.label} is required` } : { ok: true, value: null };
  switch (f.type) {
    case "number": case "currency": case "percent": return parseNumber(f, s);
    case "rating": {
      const n = Number(s);
      const max = f.max ?? 5;
      return Number.isInteger(n) && n >= 1 && n <= max ? { ok: true, value: n } : { ok: false, error: `${f.label} must be 1 to ${max}` };
    }
    case "select": return parseChoice(f, s);
    case "email": return EMAIL.test(s) ? { ok: true, value: s.toLowerCase() } : { ok: false, error: `${s} is not an email address` };
    case "url": return { ok: true, value: /^https?:\/\//i.test(s) ? s : `https://${s}` };
    case "date": return /^\d{4}-\d{2}-\d{2}$/.test(s) ? { ok: true, value: s } : { ok: false, error: `${f.label} must be a date (YYYY-MM-DD)` };
    case "dateTime": {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? { ok: false, error: `${f.label} must be a date and time` } : { ok: true, value: d.toISOString() };
    }
    default: return { ok: true, value: s };
  }
}
