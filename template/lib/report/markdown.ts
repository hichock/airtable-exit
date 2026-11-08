// Small Markdown → HTML renderer for the discovery report (headings, paragraphs, lists, tables,
// blockquotes, code, bold, italic, links). Escapes everything else. No dependencies.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inline(s: string): string {
  const codes: string[] = [];
  let out = esc(s).replace(/`([^`]+)`/g, (_, c: string) => `\u0000${codes.push(c) - 1}\u0000`);
  out = out
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[./#][^)\s]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function table(lines: string[]): string {
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, "|")));
  const [head, , ...body] = lines;
  const align = cells(lines[1] ?? "").map((c) => (/^-+:$/.test(c) ? "right" : "left"));
  const th = cells(head ?? "").map((c, i) => `<th style="text-align:${align[i] ?? "left"}">${c}</th>`).join("");
  const rows = body.map((l) => `<tr>${cells(l).map((c, i) => `<td style="text-align:${align[i] ?? "left"}">${c}</td>`).join("")}</tr>`).join("\n");
  return `<div class="table"><table><thead><tr>${th}</tr></thead><tbody>\n${rows}\n</tbody></table></div>`;
}

export function markdownToHtml(md: string): { html: string; title: string; toc: { id: string; text: string }[] } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const toc: { id: string; text: string }[] = [];
  let title = "";
  let i = 0;
  while (i < lines.length) {
    const l = lines[i] as string;
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const level = h[1]!.length, text = h[2]!.trim();
      if (level === 1 && !title) { title = text; i++; continue; }
      const id = slug(text);
      if (level === 2) toc.push({ id, text });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++; continue;
    }
    if (/^```/.test(l)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i] as string)) buf.push(lines[i++] as string);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^\s*\|/.test(l) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i] as string)) buf.push(lines[i++] as string);
      out.push(table(buf));
      continue;
    }
    if (/^---+\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(l)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] as string)) buf.push((lines[i++] as string).replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }
    const list = /^(\s*)([-*]|\d+\.)\s+/.exec(l);
    if (list) {
      const ordered = /\d/.test(list[2]!);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i] as string)) {
        let item = (lines[i++] as string).replace(/^\s*([-*]|\d+\.)\s+/, "");
        while (i < lines.length && /^\s{2,}\S/.test(lines[i] as string) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i] as string)) item += " " + (lines[i++] as string).trim();
        const box = /^\[( |x)\]\s+/.exec(item);
        items.push(box ? `<li class="task${box[1] === "x" ? " done" : ""}">${inline(item.slice(4))}</li>` : `<li>${inline(item)}</li>`);
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && (lines[i] as string).trim() && !/^(#{1,4}\s|```|>|\s*\||\s*([-*]|\d+\.)\s+|---+\s*$)/.test(lines[i] as string)) buf.push((lines[i++] as string).trim());
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return { html: out.join("\n"), title, toc };
}
