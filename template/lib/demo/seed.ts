// Fake data for DEMO mode and screenshots: a small agency CRM. Every name is invented,
// every email uses example.com. Deterministic (seeded), with dates relative to today.

import type { Row } from "../data/types.ts";
import type { ActivityItem, AttachmentItem, CommentItem, Person, RunItem } from "../data/types.ts";

export interface DemoData {
  tables: Record<string, Row[]>;
  people: Person[];
  comments: Record<string, CommentItem[]>;
  activity: Record<string, ActivityItem[]>;
  attachments: Record<string, AttachmentItem[]>;
  automationRuns: RunItem[];
  syncRuns: RunItem[];
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE: Person[] = [
  { id: "u-1", name: "Maya Chen", email: "maya@example.com", role: "admin" },
  { id: "u-2", name: "Leo Hart", email: "leo@example.com", role: "editor" },
  { id: "u-3", name: "Priya Nair", email: "priya@example.com", role: "editor" },
  { id: "u-4", name: "Tom Okafor", email: "tom@example.com", role: "viewer" },
  { id: "u-5", name: "Sara Lind", email: "sara@example.com", role: "portal" },
];

const COMPANIES = [
  "Northwind Analytics", "Bluepeak Health", "Fernhill Foods", "Copperline Studio", "Atlas Learning", "Kestrel Finance",
  "Driftwood Hotels", "Lumen Robotics", "Harbor & Pine", "Quarry Labs", "Moss Street Bakery", "Orbit Fitness",
  "Sable Logistics", "Tidewater Clinics", "Juniper Schools", "Brightside Insurance", "Cobalt Commerce", "Willow Dental",
  "Ironbark Supply", "Meadow Organics", "Pinecrest Realty", "Vantage Payroll", "Saltmarsh Inns", "Redwood Tutors",
];
const CITIES = ["Austin", "Denver", "Toronto", "Lisbon", "Berlin", "Manchester", "Melbourne", "Chicago", "Dublin", "Seattle"];
const INDUSTRIES = ["SaaS", "E-commerce", "Health", "Education", "Finance", "Hospitality"];
const FIRST = ["Ana", "Ben", "Chloe", "Dev", "Elena", "Femi", "Grace", "Hugo", "Ines", "Jonah", "Kira", "Luis", "Mila", "Nate", "Olga", "Pavel", "Rosa", "Sam", "Tara", "Victor"];
const LAST = ["Alvarez", "Brooks", "Costa", "Dubois", "Evans", "Fischer", "Gupta", "Holm", "Ito", "Jensen", "Kowalski", "Lopez", "Moreau", "Novak", "Ortiz", "Patel", "Quinn", "Rossi", "Silva", "Turner"];
const TITLES = ["CEO", "Founder", "Head of Operations", "Marketing Lead", "COO", "Office Manager", "CTO", "Sales Director"];
const DEAL_KINDS = ["Website rebuild", "CRM setup", "Booking system", "Client portal", "Reporting dashboard", "Inventory app", "Onboarding flow", "Support desk"];
const TASKS = ["Send proposal", "Book discovery call", "Prepare demo", "Follow up on invoice", "Review contract", "Share timeline", "Collect requirements", "Kickoff meeting", "Check data import", "Write handover notes"];

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)] as T;
}

function day(offset: number, now: Date): string {
  return new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function companies(r: () => number, now: Date): Row[] {
  const statuses = ["Lead", "Active client", "Active client", "Past client", "Lead", "Churned"];
  return COMPANIES.map((name, i) => ({
    id: `com-${i + 1}`,
    name,
    status: pick(r, statuses),
    industry: INDUSTRIES[i % INDUSTRIES.length],
    size: pick(r, ["1-10", "11-50", "51-200", "200+"]),
    owner: pick(r, PEOPLE.slice(0, 3)).id,
    website: `https://${slug(name)}.example.com`,
    city: pick(r, CITIES),
    notes: i % 3 === 0 ? "Came in through a referral. Prefers email over calls." : null,
    created_at: new Date(now.getTime() - (200 - i * 7) * 86_400_000).toISOString(),
  }));
}

function contacts(r: () => number, coms: Row[], now: Date): Row[] {
  return Array.from({ length: 56 }, (_, i) => {
    const first = FIRST[i % FIRST.length] as string;
    const last = LAST[(i * 7) % LAST.length] as string;
    const com = coms[i % coms.length] as Row;
    return {
      id: `con-${i + 1}`,
      name: `${first} ${last}`,
      company: com.id,
      title: pick(r, TITLES),
      email: `${slug(first)}.${slug(last)}@example.com`,
      phone: `+1 555 01${String(i).padStart(2, "0")}`,
      stage: pick(r, ["New", "Contacted", "Qualified", "Qualified", "Not a fit"]),
      last_contacted: r() > 0.2 ? day(-Math.floor(r() * 60), now) : null,
      linkedin: null,
      created_at: new Date(now.getTime() - (160 - i * 2) * 86_400_000).toISOString(),
    };
  });
}

function deals(r: () => number, coms: Row[], cons: Row[], now: Date): Row[] {
  const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost", "Proposal", "Qualified", "Won"];
  const prob: Record<string, number> = { Lead: 0.1, Qualified: 0.25, Proposal: 0.5, Negotiation: 0.75, Won: 1, Lost: 0 };
  return Array.from({ length: 38 }, (_, i) => {
    const com = coms[(i * 5) % coms.length] as Row;
    const stage = pick(r, stages);
    const mine = cons.filter((c) => c.company === com.id).map((c) => c.id);
    return {
      id: `deal-${i + 1}`,
      name: `${com.name}: ${pick(r, DEAL_KINDS)}`,
      company: com.id,
      contacts: mine.slice(0, 1 + Math.floor(r() * 2)),
      stage,
      value: (4 + Math.floor(r() * 46)) * 500,
      probability: prob[stage],
      close_date: day(stage === "Won" || stage === "Lost" ? -Math.floor(r() * 90) : Math.floor(r() * 75) - 10, now),
      owner: pick(r, PEOPLE.slice(0, 3)).id,
      source: pick(r, ["Referral", "Website", "Outbound", "Event", "Referral"]),
      created_at: new Date(now.getTime() - (120 - i * 3) * 86_400_000).toISOString(),
    };
  });
}

function tasks(r: () => number, ds: Row[], now: Date): Row[] {
  return Array.from({ length: 46 }, (_, i) => {
    const deal = ds[(i * 3) % ds.length] as Row;
    return {
      id: `task-${i + 1}`,
      title: pick(r, TASKS),
      status: pick(r, ["To do", "To do", "In progress", "Done"]),
      priority: pick(r, ["Low", "Medium", "Medium", "High"]),
      due: day(Math.floor(r() * 40) - 12, now),
      assignee: pick(r, PEOPLE).id,
      deal: deal.id,
      company: deal.company,
      notes: null,
      created_at: new Date(now.getTime() - (60 - i) * 86_400_000).toISOString(),
    };
  });
}

function runs(now: Date): Pick<DemoData, "automationRuns" | "syncRuns"> {
  const at = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  return {
    automationRuns: [
      { id: "ar-3", name: "stale-deals", status: "ok", startedAt: at(3), finishedAt: at(3), detail: "2 follow-up tasks created" },
      { id: "ar-2", name: "deal-won-onboarding", status: "ok", startedAt: at(27), finishedAt: at(27), detail: "1 onboarding task created" },
      { id: "ar-1", name: "stale-deals", status: "error", startedAt: at(51), finishedAt: at(51), error: "Could not load deals: timeout" },
    ],
    syncRuns: [
      { id: "sr-2", name: "delta: all tables", status: "ok", startedAt: at(6), finishedAt: at(6), detail: "14 read, 14 written" },
      { id: "sr-1", name: "copy: all tables", status: "ok", startedAt: at(30), finishedAt: at(30), detail: "164 read, 164 written" },
    ],
  };
}

export function buildSeed(now: Date = new Date()): DemoData {
  const r = rng(42);
  const coms = companies(r, now);
  const cons = contacts(r, coms, now);
  const ds = deals(r, coms, cons, now);
  const ts = tasks(r, ds, now);
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  return {
    tables: { companies: coms, contacts: cons, deals: ds, tasks: ts },
    people: PEOPLE,
    comments: {
      "deals:deal-1": [
        { id: "c-1", author: "Leo Hart", body: "They want the portal live before their busy season. Proposal sent.", createdAt: ago(50) },
        { id: "c-2", author: "Maya Chen", body: "Call booked for Thursday. Bring the timeline.", createdAt: ago(5) },
      ],
    },
    activity: {
      "deals:deal-1": [
        { id: "a-2", actor: "Maya Chen", action: "update", field: "stage", oldValue: "Qualified", newValue: ds[0]?.stage, createdAt: ago(6) },
        { id: "a-1", actor: "Airtable import", action: "import", createdAt: ago(30) },
      ],
    },
    attachments: {
      "deals:deal-1": [
        { id: "f-1", field: "files", filename: "proposal-v2.pdf", mime: "application/pdf", size: 482_133 },
        { id: "f-2", field: "files", filename: "scope-notes.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 38_410 },
      ],
    },
    ...runs(now),
  };
}
