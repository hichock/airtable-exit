// A small parser for the subset of Airtable's formula language we can carry over.
// One parser, two back ends: to-sql.ts (generated columns) and evaluate.ts (TypeScript at read time).

export type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ref"; key: string }
  | { t: "neg"; arg: Node }
  | { t: "bin"; op: BinOp; l: Node; r: Node }
  | { t: "call"; fn: string; args: Node[] };

export type BinOp = "+" | "-" | "*" | "/" | "&" | "=" | "!=" | "<" | ">" | "<=" | ">=";

type Tok =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "ref"; v: string }
  | { k: "id"; v: string }
  | { k: "op"; v: string }
  | { k: "eof" };

export class FormulaError extends Error {}

const OPS = ["<=", ">=", "!=", "+", "-", "*", "/", "&", "=", "<", ">", "(", ")", ","];

function readString(src: string, i: number): [string, number] {
  const quote = src[i];
  let out = "";
  let j = i + 1;
  while (j < src.length && src[j] !== quote) {
    if (src[j] === "\\" && j + 1 < src.length) j++;
    out += src[j];
    j++;
  }
  if (j >= src.length) throw new FormulaError("Unclosed string");
  return [out, j + 1];
}

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    if (/\s/.test(c)) { i++; continue; }
    if (c === "{") {
      const end = src.indexOf("}", i);
      if (end < 0) throw new FormulaError("Unclosed field reference");
      toks.push({ k: "ref", v: src.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const [v, next] = readString(src, i);
      toks.push({ k: "str", v });
      i = next;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { toks.push({ k: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) { toks.push({ k: "id", v: id[0].toUpperCase() }); i += id[0].length; continue; }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new FormulaError(`Unexpected character "${c}"`);
    toks.push({ k: "op", v: op });
    i += op.length;
  }
  toks.push({ k: "eof" });
  return toks;
}

class Parser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok { return this.toks[this.pos] as Tok; }
  private next(): Tok { return this.toks[this.pos++] as Tok; }
  private isOp(v: string): boolean { const t = this.peek(); return t.k === "op" && t.v === v; }
  private expect(v: string): void {
    if (!this.isOp(v)) throw new FormulaError(`Expected "${v}"`);
    this.pos++;
  }

  parse(): Node {
    const n = this.comparison();
    if (this.peek().k !== "eof") throw new FormulaError("Unexpected text after the formula");
    return n;
  }

  private binary(next: () => Node, ops: string[]): Node {
    let l = next();
    for (;;) {
      const t = this.peek();
      if (t.k !== "op" || !ops.includes(t.v)) return l;
      this.pos++;
      l = { t: "bin", op: t.v as BinOp, l, r: next() };
    }
  }

  private comparison = (): Node => this.binary(this.concat, ["=", "!=", "<", ">", "<=", ">="]);
  private concat = (): Node => this.binary(this.additive, ["&"]);
  private additive = (): Node => this.binary(this.term, ["+", "-"]);
  private term = (): Node => this.binary(this.unary, ["*", "/"]);

  private unary = (): Node => {
    if (this.isOp("-")) { this.pos++; return { t: "neg", arg: this.unary() }; }
    return this.primary();
  };

  private primary(): Node {
    const t = this.next();
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "str") return { t: "str", v: t.v };
    if (t.k === "ref") return { t: "ref", key: t.v };
    if (t.k === "op" && t.v === "(") { const n = this.comparison(); this.expect(")"); return n; }
    if (t.k === "id") return { t: "call", fn: t.v, args: this.args() };
    throw new FormulaError("Unexpected end of formula");
  }

  private args(): Node[] {
    this.expect("(");
    const args: Node[] = [];
    if (this.isOp(")")) { this.pos++; return args; }
    for (;;) {
      args.push(this.comparison());
      if (this.isOp(",")) { this.pos++; continue; }
      this.expect(")");
      return args;
    }
  }
}

export function parseFormula(src: string): Node {
  return new Parser(tokenize(src)).parse();
}

/** Every {field} the formula reads. */
export function refsOf(n: Node): string[] {
  switch (n.t) {
    case "ref": return [n.key];
    case "neg": return refsOf(n.arg);
    case "bin": return [...refsOf(n.l), ...refsOf(n.r)];
    case "call": return n.args.flatMap(refsOf);
    default: return [];
  }
}
