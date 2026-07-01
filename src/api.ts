/**
 * Thin client for the live DFL Forge skills registry
 * (skills.sh-compatible API at https://skills.devfellowship.com).
 *
 * No database, no caching beyond the process — every call hits the live API.
 */

import { parseAndValidateSkillId } from "./tools/validate.js";

export const DEFAULT_API_BASE = "https://skills.devfellowship.com";

const API_BASE = (process.env.SKILLS_API_URL ?? DEFAULT_API_BASE).replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = Number(process.env.SKILLS_API_TIMEOUT_MS ?? 15000);

export type SkillKind = "skill" | "mcp" | "connection" | "all";

export class SkillsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "SkillsApiError";
  }
}

async function request<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new SkillsApiError(`Failed to reach skills registry: ${reason}`, 0, url);
  } finally {
    clearTimeout(timer);
  }

  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {
    throw new SkillsApiError(
      `Registry returned non-JSON response (status ${res.status})`,
      res.status,
      url,
    );
  }

  if (!res.ok) {
    const msg =
      isRecord(parsed) && typeof parsed.error === "string"
        ? parsed.error
        : `Registry responded with HTTP ${res.status}`;
    throw new SkillsApiError(msg, res.status, url);
  }

  return parsed as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Generic skill record — registry is skills.sh-compatible; shape is passed through. */
export interface SkillSummary {
  [key: string]: unknown;
}

export interface ListResponse {
  skills: SkillSummary[];
  scope?: string;
  [key: string]: unknown;
}

export interface SearchResponse {
  searchType?: string;
  skills: SkillSummary[];
  scope?: string;
  [key: string]: unknown;
}

export interface SkillDetail {
  [key: string]: unknown;
}

/** GET /api/v1/skills — full public list, optionally filtered by kind/sorted. */
export async function listSkills(opts?: {
  kind?: SkillKind;
  sort?: string;
}): Promise<ListResponse> {
  const params = new URLSearchParams();
  if (opts?.kind && opts.kind !== "all") params.set("kind", opts.kind);
  if (opts?.sort) params.set("sort", opts.sort);
  const qs = params.toString();
  return request<ListResponse>(`/api/v1/skills${qs ? `?${qs}` : ""}`);
}

/** GET /api/v1/skills/search?q=&semantic= — hybrid semantic + FTS search. */
export async function searchSkills(
  query: string,
  opts?: { limit?: number; kind?: SkillKind; semantic?: boolean },
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.kind && opts.kind !== "all") params.set("kind", opts.kind);
  if (opts?.semantic != null) params.set("semantic", String(opts.semantic));
  return request<SearchResponse>(`/api/v1/skills/search?${params.toString()}`);
}

/**
 * GET /api/v1/skills/:owner/:repo/:skill — one skill with file tree, content
 * hash and audit metadata. `id` is "owner/repo/slug".
 */
export async function getSkill(id: string): Promise<SkillDetail> {
  // Same charset validation as install. Here segments are encodeURIComponent'd
  // into a URL path (so metachars are inert), but we still validate for a clear
  // client error and to stay safe if this is ever refactored to a shell string.
  let owner: string;
  let repo: string;
  let slug: string | undefined;
  try {
    ({ owner, repo, slug } = parseAndValidateSkillId(id, { requireSlug: true }));
  } catch (err) {
    throw new SkillsApiError(err instanceof Error ? err.message : String(err), 400, id);
  }
  const [encOwner, encRepo, encSlug] = [owner, repo, slug as string].map((p) =>
    encodeURIComponent(p),
  );
  return request<SkillDetail>(`/api/v1/skills/${encOwner}/${encRepo}/${encSlug}`);
}
