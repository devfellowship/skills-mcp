/**
 * Shared input validation for skill ids and install flags.
 *
 * IMPORTANT security note on WHY this exists:
 * `get_skill` uses these segments only inside a URL path where each segment is
 * `encodeURIComponent`-ed (see api.ts) — so a `;`, backtick or `$(...)` is inert
 * there. `install_skill` instead composes a literal `npx skills add ...` SHELL
 * STRING; if a host agent execs that string via a shell, unvalidated metachars
 * become command injection (the MCP is a confused deputy). We therefore validate
 * every segment against a strict charset BEFORE building the command, and apply
 * the same check in get for a clear client error + to stop a future refactor
 * (e.g. dropping encodeURIComponent) from silently reintroducing the hole.
 */

import type { ParsedSkillId } from "../types/parsedskillid.js";

/** A single id segment: owner, repo or slug. No shell metachars, no leading dash. */
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

/** An agent name passed to `--agent`. */
const AGENT_RE = /^[a-z0-9_-]+$/;

/** Upper bound on any single id segment or agent name. */
const MAX_LEN = 100;

/** Allowed install scopes. */
export const ALLOWED_SCOPES = ["project", "global"] as const;
export type Scope = (typeof ALLOWED_SCOPES)[number];

function assertSegment(segment: string, label: string): void {
  if (segment.length > MAX_LEN) {
    throw new Error(`Invalid ${label} "${segment}": exceeds ${MAX_LEN} characters.`);
  }
  if (!SEGMENT_RE.test(segment)) {
    throw new Error(
      `Invalid ${label} "${segment}". Only letters, digits, "." "_" "-" are allowed.`,
    );
  }
  if (segment.startsWith("-")) {
    throw new Error(`Invalid ${label} "${segment}": must not start with "-".`);
  }
  // The charset above admits "." and ".." (path traversal) and dotfiles; reject
  // any "." only, ".." only, or leading/trailing-dot segment explicitly.
  if (segment === "." || segment === "..") {
    throw new Error(`Invalid ${label} "${segment}": path segments "." and ".." are not allowed.`);
  }
  if (segment.startsWith(".") || segment.endsWith(".")) {
    throw new Error(`Invalid ${label} "${segment}": must not start or end with ".".`);
  }
}

/**
 * Split and validate a skill id of the form "owner/repo" or "owner/repo/slug".
 * Rejects any segment with shell metacharacters or a leading dash.
 */
export function parseAndValidateSkillId(
  id: string,
  opts: { requireSlug?: boolean } = {},
): ParsedSkillId {
  const parts = id.split("/").filter(Boolean);
  const expected = opts.requireSlug ? '"owner/repo/slug"' : '"owner/repo" or "owner/repo/slug"';
  if (opts.requireSlug ? parts.length !== 3 : parts.length < 2 || parts.length > 3) {
    throw new Error(`Invalid skill id "${id}". Expected ${expected}.`);
  }
  const [owner, repo, slug] = parts as [string, string, string?];
  assertSegment(owner, "owner");
  assertSegment(repo, "repo");
  if (slug !== undefined) assertSegment(slug, "slug");
  return slug !== undefined ? { owner, repo, slug } : { owner, repo };
}

/** Validate an `--agent` value; throws on anything outside the safe charset. */
export function assertValidAgent(agent: string): void {
  if (agent.length > MAX_LEN) {
    throw new Error(`Invalid agent "${agent}": exceeds ${MAX_LEN} characters.`);
  }
  if (!AGENT_RE.test(agent)) {
    throw new Error(
      `Invalid agent "${agent}". Only lowercase letters, digits, "_" and "-" are allowed.`,
    );
  }
  // A leading dash would reach `npx skills add` as a flag (e.g. `--agent -rf`).
  if (agent.startsWith("-")) {
    throw new Error(`Invalid agent "${agent}": must not start with "-".`);
  }
}

/** Validate and narrow a scope string against the allowlist. */
export function assertValidScope(scope: string): asserts scope is Scope {
  if (!(ALLOWED_SCOPES as readonly string[]).includes(scope)) {
    throw new Error(
      `Invalid scope "${scope}". Allowed: ${ALLOWED_SCOPES.join(", ")}.`,
    );
  }
}
