import assert from "node:assert/strict";
import { test, afterEach } from "node:test";

import { registerListSkills, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from "../src/tools/list.js";
import {
  registerSearchSkills,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
} from "../src/tools/search.js";

type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}>;

/** Capture a tool handler registered against a minimal fake McpServer. */
function captureTool(register: (server: unknown) => void): Handler {
  let handler: Handler | undefined;
  const fakeServer = {
    registerTool(_name: string, _def: unknown, h: Handler) {
      handler = h;
    },
  };
  register(fakeServer);
  if (!handler) throw new Error("tool did not register a handler");
  return handler;
}

const originalFetch = globalThis.fetch;

/** Stub fetch to return `count` skills and record the requested URL. */
function stubFetch(count: number): { urls: string[] } {
  const urls: string[] = [];
  const skills = Array.from({ length: count }, (_, i) => ({ id: `owner/repo/skill-${i}` }));
  globalThis.fetch = (async (input: unknown) => {
    urls.push(String(input));
    return new Response(JSON.stringify({ skills, scope: "public" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { urls };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("list_skills caps the returned list at the requested limit", async () => {
  const { urls } = stubFetch(500);
  const list = captureTool(registerListSkills as (s: unknown) => void);
  const res = await list({ limit: 5 });
  assert.notEqual(res.isError, true);
  const skills = res.structuredContent?.["skills"] as unknown[];
  assert.equal(skills.length, 5);
  assert.equal(res.structuredContent?.["count"], 5);
  assert.equal(res.structuredContent?.["limit"], 5);
  assert.equal(res.structuredContent?.["totalCount"], 500);
  assert.equal(res.structuredContent?.["truncated"], true);
  assert.match(urls[0]!, /limit=5/);
});

test("list_skills clamps a limit above the hard max down to the max", async () => {
  const { urls } = stubFetch(1000);
  const list = captureTool(registerListSkills as (s: unknown) => void);
  const res = await list({ limit: LIST_MAX_LIMIT + 50 });
  assert.notEqual(res.isError, true);
  const skills = res.structuredContent?.["skills"] as unknown[];
  assert.equal(skills.length, LIST_MAX_LIMIT);
  assert.equal(res.structuredContent?.["limit"], LIST_MAX_LIMIT);
  assert.match(urls[0]!, new RegExp(`limit=${LIST_MAX_LIMIT}`));
});

test("list_skills applies the default limit when omitted", async () => {
  const { urls } = stubFetch(500);
  const list = captureTool(registerListSkills as (s: unknown) => void);
  const res = await list({});
  assert.notEqual(res.isError, true);
  const skills = res.structuredContent?.["skills"] as unknown[];
  assert.equal(skills.length, LIST_DEFAULT_LIMIT);
  assert.equal(res.structuredContent?.["limit"], LIST_DEFAULT_LIMIT);
  assert.match(urls[0]!, new RegExp(`limit=${LIST_DEFAULT_LIMIT}`));
});

test("list_skills honors an explicit limit below the default", async () => {
  stubFetch(500);
  const list = captureTool(registerListSkills as (s: unknown) => void);
  const res = await list({ limit: 3 });
  const skills = res.structuredContent?.["skills"] as unknown[];
  assert.equal(skills.length, 3);
});

test("search_skills applies the default limit when omitted", async () => {
  const { urls } = stubFetch(500);
  const search = captureTool(registerSearchSkills as (s: unknown) => void);
  const res = await search({ query: "test" });
  assert.notEqual(res.isError, true);
  assert.equal(res.structuredContent?.["limit"], SEARCH_DEFAULT_LIMIT);
  assert.match(urls[0]!, new RegExp(`limit=${SEARCH_DEFAULT_LIMIT}`));
});

test("search_skills honors an explicit limit up to the max", async () => {
  const { urls } = stubFetch(500);
  const search = captureTool(registerSearchSkills as (s: unknown) => void);
  const res = await search({ query: "test", limit: SEARCH_MAX_LIMIT });
  assert.notEqual(res.isError, true);
  assert.equal(res.structuredContent?.["limit"], SEARCH_MAX_LIMIT);
  assert.match(urls[0]!, new RegExp(`limit=${SEARCH_MAX_LIMIT}`));
});
