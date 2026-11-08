import { test } from "node:test";
import assert from "node:assert/strict";
import { decideStaleDeals, TASK_TITLE } from "./stale-deals.ts";

const NOW = new Date("2026-11-08T12:00:00Z");

test("stale deals: open, untouched 14+ days, no open follow-up", () => {
  const deals = [
    { id: "a", stage: "Proposal", updated_at: "2026-10-01T00:00:00Z" },
    { id: "b", stage: "Won", updated_at: "2026-10-01T00:00:00Z" },
    { id: "c", stage: "Lead", updated_at: "2026-11-05T00:00:00Z" },
    { id: "d", stage: "Lead", updated_at: "2026-10-01T00:00:00Z" },
    { id: "e", stage: "Lead" },
  ];
  const tasks = [{ id: "t1", title: TASK_TITLE, status: "To do", deal: "d" }, { id: "t2", title: TASK_TITLE, status: "Done", deal: "a" }];
  assert.deepEqual(decideStaleDeals(deals, tasks, NOW).map((d) => d.id), ["a"]);
});
