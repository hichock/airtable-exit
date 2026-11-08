// Airtable formula → Postgres expression for a GENERATED ALWAYS AS (...) STORED column.
// Postgres allows only immutable functions on the current row there: no NOW(), no other rows,
// no text casts of dates. Anything outside that returns a reason, and the field is
// flagged "rebuild in TypeScript" instead of guessed.

import { parseFormula, FormulaError, type Node } from "./parse.ts";

export type SqlKind = "number" | "text" | "bool" | "date" | "other";
export interface ColumnInfo { column: string; kind: SqlKind }
export type SqlResult = { ok: true; sql: string; kind: SqlKind } | { ok: false; reason: string };

class Untranslatable extends Error {}

type Expr = { sql: string; kind: SqlKind; notNull?: boolean };
type ColumnOf = (key: string) => ColumnInfo | undefined;

const TIME_FNS = ["TODAY", "NOW", "CREATED_TIME", "LAST_MODIFIED_TIME"];

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteral(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function num(e: Expr): string {
  if (e.kind === "text" || e.kind === "date") throw new Untranslatable("mixes text or dates with arithmetic");
  return e.notNull ? e.sql : `coalesce(${e.sql}, 0)`;
}

function text(e: Expr): string {
  if (e.kind === "date") throw new Untranslatable("turns a date into text, which a generated column cannot do");
  if (e.notNull && e.kind === "text") return e.sql;
  return `coalesce((${e.sql})::text, '')`;
}

function truthy(e: Expr): string {
  if (e.kind === "bool") return e.sql;
  if (e.kind === "number") return `(coalesce(${e.sql}, 0) <> 0)`;
  if (e.kind === "text") return `(coalesce(${e.sql}, '') <> '')`;
  return `(${e.sql} is not null)`;
}

function arity(fn: string, args: Node[], min: number, max: number): void {
  if (args.length < min || args.length > max) throw new Untranslatable(`${fn} has the wrong number of arguments`);
}

function concat(parts: Expr[]): Expr {
  return { sql: `(${parts.map(text).join(" || ")})`, kind: "text", notNull: true };
}

function call(fn: string, args: Node[], col: ColumnOf): Expr {
  const a = () => args.map((x) => tr(x, col));
  if (TIME_FNS.includes(fn)) throw new Untranslatable(`${fn}() changes over time; compute it in the app or a view`);
  switch (fn) {
    case "IF": {
      arity(fn, args, 2, 3);
      const [c, t, f] = a() as [Expr, Expr, Expr | undefined];
      return { sql: `(case when ${truthy(c)} then ${t.sql} else ${f ? f.sql : "null"} end)`, kind: t.kind };
    }
    case "AND": case "OR":
      if (args.length === 0) throw new Untranslatable(`${fn} needs arguments`);
      return { sql: `(${a().map(truthy).join(` ${fn.toLowerCase()} `)})`, kind: "bool" };
    case "NOT": arity(fn, args, 1, 1); return { sql: `(not ${truthy(a()[0] as Expr)})`, kind: "bool" };
    case "ROUND": {
      arity(fn, args, 1, 2);
      const [x, p] = a() as [Expr, Expr | undefined];
      return { sql: `round((${num(x)})::numeric, ${p ? num(p) : "0"})`, kind: "number" };
    }
    case "ABS": case "FLOOR": case "CEILING": {
      arity(fn, args, 1, 1);
      const sqlFn = fn === "CEILING" ? "ceil" : fn.toLowerCase();
      return { sql: `${sqlFn}(${num(a()[0] as Expr)})`, kind: "number" };
    }
    case "MIN": case "MAX":
      if (args.length === 0) throw new Untranslatable(`${fn} needs arguments`);
      return { sql: `${fn === "MIN" ? "least" : "greatest"}(${a().map((e) => e.sql).join(", ")})`, kind: "number" };
    case "UPPER": case "LOWER": case "TRIM":
      arity(fn, args, 1, 1);
      return { sql: `${fn.toLowerCase()}(${(a()[0] as Expr).sql})`, kind: "text" };
    case "LEN": arity(fn, args, 1, 1); return { sql: `length(${text(a()[0] as Expr)})`, kind: "number" };
    case "LEFT": case "RIGHT": {
      arity(fn, args, 2, 2);
      const [s, n] = a() as [Expr, Expr];
      return { sql: `${fn.toLowerCase()}(${text(s)}, (${num(n)})::int)`, kind: "text" };
    }
    case "CONCATENATE": return concat(a());
    case "BLANK": return { sql: "null", kind: "other" };
    case "TRUE": return { sql: "true", kind: "bool", notNull: true };
    case "FALSE": return { sql: "false", kind: "bool", notNull: true };
    default:
      throw new Untranslatable(`${fn}() has no direct SQL twin; rebuild in TypeScript`);
  }
}

function bin(op: string, l: Expr, r: Expr): Expr {
  if (op === "&") return concat([l, r]);
  if (op === "/") return { sql: `(${num(l)} / nullif(${num(r)}, 0))`, kind: "number" };
  if (["+", "-", "*"].includes(op)) return { sql: `(${num(l)} ${op} ${num(r)})`, kind: "number", notNull: true };
  const sqlOp = op === "!=" ? "<>" : op;
  return { sql: `(${l.sql} ${sqlOp} ${r.sql})`, kind: "bool" };
}

function tr(n: Node, col: ColumnOf): Expr {
  switch (n.t) {
    case "num": return { sql: String(n.v), kind: "number", notNull: true };
    case "str": return { sql: quoteLiteral(n.v), kind: "text", notNull: true };
    case "ref": {
      const c = col(n.key);
      if (!c) throw new Untranslatable(`reads {${n.key}}, which is not a plain column of this table`);
      return { sql: quoteIdent(c.column), kind: c.kind };
    }
    case "neg": return { sql: `(-${num(tr(n.arg, col))})`, kind: "number" };
    case "bin": return bin(n.op, tr(n.l, col), tr(n.r, col));
    case "call": return call(n.fn, n.args, col);
  }
}

export function formulaToSql(src: string, columnOf: ColumnOf): SqlResult {
  try {
    const e = tr(parseFormula(src), columnOf);
    return { ok: true, sql: e.sql, kind: e.kind };
  } catch (err) {
    if (err instanceof Untranslatable || err instanceof FormulaError) return { ok: false, reason: err.message };
    throw err;
  }
}
