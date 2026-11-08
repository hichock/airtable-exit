import { test } from "node:test";
import assert from "node:assert/strict";
import { inline, markdownToHtml } from "./markdown.ts";

test("inline: escapes HTML, keeps code literal, renders bold, italic, links", () => {
  assert.equal(inline("<b>x</b>"), "&lt;b&gt;x&lt;/b&gt;");
  assert.equal(inline("**Move** the *CRM* `a*b*c`"), "<strong>Move</strong> the <em>CRM</em> <code>a*b*c</code>");
  assert.equal(inline("[docs](https://airtable.com/developers)"), '<a href="https://airtable.com/developers">docs</a>');
  assert.equal(inline("[x](javascript:alert(1))"), "[x](javascript:alert(1))");
});

test("blocks: title, toc, table alignment, lists, tasks, code", () => {
  const r = markdownToHtml(`# Discovery report\n\n## Verdict\nMove. **Now.**\n\n| Item | Now | After |\n|---|---:|---:|\n| Seats | $432 | $45 |\n\n- [x] OAuth\n- [ ] PAT\n\n1. one\n2. two\n\n\`\`\`\n<script>\n\`\`\``);
  assert.equal(r.title, "Discovery report");
  assert.deepEqual(r.toc, [{ id: "verdict", text: "Verdict" }]);
  assert.match(r.html, /<td style="text-align:right">\$432<\/td>/);
  assert.match(r.html, /<li class="task done">OAuth<\/li><li class="task">PAT<\/li>/);
  assert.match(r.html, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(r.html, /<pre><code>&lt;script&gt;<\/code><\/pre>/);
});
