// Renders kb/report.md → docs/report.html (one self-contained file to send the owner).
// Usage: npm run report:html -- [kb/report.md] [docs/report.html]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { markdownToHtml } from "../../lib/report/markdown.ts";

const src = process.argv[2] ?? "kb/report.md";
const dest = process.argv[3] ?? "docs/report.html";
const { html, title, toc } = markdownToHtml(readFileSync(src, "utf8"));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title || "Discovery report")}</title>
<style>
/* Report: one readable column with a sticky contents rail on wide screens. */
:root { --bg:#f4f6f5; --paper:#fff; --ink:#17201e; --ink-2:#55625e; --line:#e1e6e4; --accent:#136a5f; --soft:#e2f1ee; --warn:#fdf3dc; --warn-ink:#7a5300;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; --mono: ui-monospace, Menlo, Consolas, monospace; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0f1312; --paper:#161b1a; --ink:#e5ebe9; --ink-2:#a6b2ae; --line:#283130; --accent:#4fb8a8; --soft:#173733; --warn:#362b12; --warn-ink:#f0cf7a; color-scheme: dark; } }
:root[data-theme="dark"] { --bg:#0f1312; --paper:#161b1a; --ink:#e5ebe9; --ink-2:#a6b2ae; --line:#283130; --accent:#4fb8a8; --soft:#173733; --warn:#362b12; --warn-ink:#f0cf7a; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 var(--sans); }
.wrap { max-width: 1080px; margin: 0 auto; padding-block: 40px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 32px; align-items: start; }
nav { position: sticky; top: 24px; font-size: 13px; }
nav b { display: block; text-transform: uppercase; letter-spacing: .06em; font-size: 11px; color: var(--ink-2); margin-bottom: 8px; }
nav a { display: block; color: var(--ink-2); text-decoration: none; padding: 4px 0 4px 10px; border-left: 2px solid var(--line); }
nav a:hover { color: var(--accent); border-color: var(--accent); }
article { background: var(--paper); border: 1px solid var(--line); border-radius: 10px; padding: 36px 44px; min-width: 0; }
.eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); font-weight: 600; margin: 0; }
h1 { font-size: 30px; line-height: 1.2; margin: 6px 0 24px; letter-spacing: -.02em; text-wrap: balance; }
h2 { font-size: 20px; margin: 36px 0 10px; padding-top: 18px; border-top: 1px solid var(--line); letter-spacing: -.01em; }
h3 { font-size: 16px; margin: 22px 0 6px; }
p, li { max-width: 68ch; }
a { color: var(--accent); }
strong { font-weight: 650; }
code { font-family: var(--mono); font-size: .88em; background: var(--soft); padding: 1px 5px; border-radius: 4px; }
pre { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 16px 0; padding: 10px 14px; background: var(--warn); color: var(--warn-ink); border-radius: 8px; }
.table { overflow-x: auto; margin: 12px 0; }
table { border-collapse: collapse; width: 100%; font-size: 14px; font-variant-numeric: tabular-nums; }
th, td { padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 12px; color: var(--ink-2); text-transform: uppercase; letter-spacing: .04em; border-bottom-width: 2px; }
li.task { list-style: none; margin-left: -18px; }
li.task::before { content: "☐ "; color: var(--ink-2); }
li.task.done::before { content: "☑ "; color: var(--accent); }
hr { border: 0; border-top: 1px solid var(--line); margin: 28px 0; }
footer { margin-top: 36px; font-size: 12px; color: var(--ink-2); }
@media (max-width: 820px) { .wrap { grid-template-columns: minmax(0, 1fr); padding-top: 16px; } nav { display: none; } article { padding: 22px 18px; } h1 { font-size: 24px; } }
</style>
</head>
<body>
<div class="wrap">
<nav aria-label="Contents"><b>Contents</b>${toc.map((t) => `<a href="#${t.id}">${esc(t.text)}</a>`).join("")}</nav>
<article>
<p class="eyebrow">Airtable discovery report</p>
<h1>${esc(title || "Discovery report")}</h1>
${html}
<footer>Generated ${new Date().toISOString().slice(0, 10)} from ${esc(src)} by airtable-exit (open source, lowcoding.dev).</footer>
</article>
</div>
</body>
</html>
`;
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, page);
console.log(`wrote ${dest}`);
