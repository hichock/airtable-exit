// Minimal Airtable REST client for the copy and the nightly delta.
// Limits (sourced, Airtable docs, read 2026-11-08): 5 requests/s per base, 100 records per page,
// HTTP 429 → wait 30 s. Attachment URLs expire 2 hours after the API returns them.

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
  commentCount?: number;
}

export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
}

export interface Deps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export const realDeps: Deps = { fetch: (...a) => fetch(...a), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now() };

/** Spaces calls so no more than `perSecond` start in any second. */
export class RateLimiter {
  private next = 0;
  constructor(private perSecond: number, private deps: Pick<Deps, "sleep" | "now">) {}
  async wait(): Promise<void> {
    const gap = 1000 / this.perSecond;
    const now = this.deps.now();
    const at = Math.max(now, this.next);
    this.next = at + gap;
    if (at > now) await this.deps.sleep(at - now);
  }
}

export class AirtableClient {
  private limiter: RateLimiter;
  constructor(private token: string, private deps: Deps = realDeps, perSecond = 5) {
    this.limiter = new RateLimiter(perSecond, deps);
  }

  async get<T>(path: string, attempt = 1): Promise<T> {
    await this.limiter.wait();
    const res = await this.deps.fetch(`https://api.airtable.com/v0/${path}`, { headers: { Authorization: `Bearer ${this.token}` } });
    if (res.status === 429 && attempt <= 3) {
      await this.deps.sleep(30_000);
      return this.get<T>(path, attempt + 1);
    }
    if (!res.ok) throw new Error(`Airtable ${res.status} on ${path.split("?")[0]}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  }

  /** All records of a table, page by page. Fields come keyed by field id, so renames don't break the copy. */
  async *records(baseId: string, tableId: string, opts: { filterByFormula?: string; commentCount?: boolean } = {}): AsyncGenerator<AirtableRecord[]> {
    let offset: string | undefined;
    do {
      const q = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true" });
      if (opts.filterByFormula) q.set("filterByFormula", opts.filterByFormula);
      if (opts.commentCount) q.append("recordMetadata[]", "commentCount");
      if (offset) q.set("offset", offset);
      const page = await this.get<{ records: AirtableRecord[]; offset?: string }>(`${baseId}/${tableId}?${q}`);
      yield page.records;
      offset = page.offset;
    } while (offset);
  }

  async comments(baseId: string, tableId: string, recordId: string): Promise<{ id: string; text: string; createdTime: string; author: { email?: string; name?: string } }[]> {
    const out: { id: string; text: string; createdTime: string; author: { email?: string; name?: string } }[] = [];
    let offset: string | undefined;
    do {
      const q = new URLSearchParams({ pageSize: "100" });
      if (offset) q.set("offset", offset);
      const page = await this.get<{ comments: typeof out; offset?: string }>(`${baseId}/${tableId}/${recordId}/comments?${q}`);
      out.push(...page.comments);
      offset = page.offset;
    } while (offset);
    return out;
  }
}

/** Download an attachment right away (URLs expire after 2 hours). */
export async function download(deps: Deps, a: AirtableAttachment): Promise<ArrayBuffer> {
  const res = await deps.fetch(a.url);
  if (!res.ok) throw new Error(`Could not download ${a.filename}: HTTP ${res.status}`);
  return res.arrayBuffer();
}
