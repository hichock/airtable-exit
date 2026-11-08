// Evaluate a parsed formula against one record in TypeScript.
// Used for "app" formulas (TODAY(), cross-type logic) and for every formula in DEMO mode.
// Blank follows Airtable: 0 in arithmetic, "" in text.

import { FormulaError, parseFormula, type Node } from "./parse.ts";

type Val = number | string | boolean | null | Date;
type Row = Record<string, unknown>;

const DAY_MS = 86_400_000;

function asNum(v: Val): number {
  if (v === null || v === "") return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asText(v: Val): string {
  if (v === null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function truthy(v: Val): boolean {
  if (typeof v === "string") return v !== "";
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

function asDate(v: Val): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string" && v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function cell(v: unknown): Val {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  return String(v);
}

function compare(op: string, l: Val, r: Val): boolean {
  const bothNum = typeof l === "number" || typeof r === "number";
  const a = bothNum ? asNum(l) : asText(l);
  const b = bothNum ? asNum(r) : asText(r);
  switch (op) {
    case "=": return a === b;
    case "!=": return a !== b;
    case "<": return a < b;
    case ">": return a > b;
    case "<=": return a <= b;
    default: return a >= b;
  }
}

function dateDiff(a: Val, b: Val, unit: string): Val {
  const da = asDate(a), db = asDate(b);
  if (!da || !db) return null;
  const ms = da.getTime() - db.getTime();
  const per: Record<string, number> = { days: DAY_MS, hours: 3_600_000, minutes: 60_000, weeks: 7 * DAY_MS };
  const d = per[unit.toLowerCase()];
  if (!d) throw new FormulaError(`DATETIME_DIFF unit "${unit}" is not supported`);
  return Math.trunc(ms / d);
}

type Ctx = { row: Row; now: Date };

function call(fn: string, args: Node[], ctx: Ctx): Val {
  const v = (i: number): Val => (args[i] ? ev(args[i] as Node, ctx) : null);
  const all = () => args.map((a) => ev(a, ctx));
  switch (fn) {
    case "IF": return truthy(v(0)) ? v(1) : v(2);
    case "AND": return all().every(truthy);
    case "OR": return all().some(truthy);
    case "NOT": return !truthy(v(0));
    case "ROUND": { const p = 10 ** asNum(v(1)); return Math.round(asNum(v(0)) * p) / p; }
    case "ABS": return Math.abs(asNum(v(0)));
    case "FLOOR": return Math.floor(asNum(v(0)));
    case "CEILING": return Math.ceil(asNum(v(0)));
    case "MIN": return Math.min(...all().map(asNum));
    case "MAX": return Math.max(...all().map(asNum));
    case "UPPER": return asText(v(0)).toUpperCase();
    case "LOWER": return asText(v(0)).toLowerCase();
    case "TRIM": return asText(v(0)).trim();
    case "LEN": return asText(v(0)).length;
    case "LEFT": return asText(v(0)).slice(0, asNum(v(1)));
    case "RIGHT": { const s = asText(v(0)); return s.slice(Math.max(0, s.length - asNum(v(1)))); }
    case "CONCATENATE": return all().map(asText).join("");
    case "BLANK": return null;
    case "TRUE": return true;
    case "FALSE": return false;
    case "TODAY": return new Date(ctx.now.toISOString().slice(0, 10));
    case "NOW": return ctx.now;
    case "DATETIME_DIFF": return dateDiff(v(0), v(1), asText(v(2)) || "seconds");
    default: throw new FormulaError(`${fn}() is not supported in the app yet`);
  }
}

function ev(n: Node, ctx: Ctx): Val {
  switch (n.t) {
    case "num": return n.v;
    case "str": return n.v;
    case "ref": return cell(ctx.row[n.key]);
    case "neg": return -asNum(ev(n.arg, ctx));
    case "call": return call(n.fn, n.args, ctx);
    case "bin": {
      const l = ev(n.l, ctx), r = ev(n.r, ctx);
      switch (n.op) {
        case "+": return asNum(l) + asNum(r);
        case "-": return asNum(l) - asNum(r);
        case "*": return asNum(l) * asNum(r);
        case "/": return asNum(r) === 0 ? null : asNum(l) / asNum(r);
        case "&": return asText(l) + asText(r);
        default: return compare(n.op, l, r);
      }
    }
  }
}

/** Returns the value, or throws FormulaError when the formula uses something we don't support. */
export function evaluateFormula(src: string | Node, row: Row, now: Date = new Date()): number | string | boolean | null {
  const node = typeof src === "string" ? parseFormula(src) : src;
  const out = ev(node, { row, now });
  return out instanceof Date ? out.toISOString().slice(0, 10) : out;
}
