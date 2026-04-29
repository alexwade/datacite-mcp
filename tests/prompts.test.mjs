/**
 * Minimal integration tests for DataCite MCP prompts.
 * Uses node:test (Node ≥18, no extra deps) and the compiled dist/.
 *
 * Tests marked [network] call the real DataCite API.
 * Run:  node --test tests/prompts.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolveRepositoryName } from "../dist/prompts/repository-summary.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startServer() {
  const proc = spawn("node", ["dist/index.js"], { stdio: ["pipe", "pipe", "pipe"] });
  let buf = "";
  const pending = new Map();
  let msgId = 1;

  proc.stdout.on("data", (chunk) => {
    buf += chunk.toString();
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch {}
    }
  });

  function send(method, params) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  async function init() {
    await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0" },
    });
  }

  function stop() {
    proc.kill();
  }

  return { send, init, stop };
}

// ---------------------------------------------------------------------------
// resolveRepositoryName — unit tests [network]
// ---------------------------------------------------------------------------

await test("resolveRepositoryName: Zenodo resolves to a single client [network]", async () => {
  const result = await resolveRepositoryName("Zenodo");
  assert.equal(result.type, "found", `Expected found, got ${result.type}`);
  if (result.type === "found") {
    assert.ok(result.client.clientId.length > 0, "clientId should be non-empty");
    assert.ok(
      result.client.name.toLowerCase().includes("zenodo"),
      `Expected name to include 'zenodo', got "${result.client.name}"`
    );
  }
});

await test("resolveRepositoryName: caches result on second call [network]", async () => {
  const r1 = await resolveRepositoryName("Zenodo");
  const r2 = await resolveRepositoryName("Zenodo"); // should hit cache
  assert.deepEqual(r1, r2);
});

await test("resolveRepositoryName: unknown name returns not_found [network]", async () => {
  const result = await resolveRepositoryName("nonexistent-repository-xyz-99999");
  assert.equal(result.type, "not_found");
});

// ---------------------------------------------------------------------------
// prompts/list — via MCP protocol
// ---------------------------------------------------------------------------

await test("prompts/list returns all three prompts with correct required args", async () => {
  const srv = startServer();
  await srv.init();

  const resp = await srv.send("prompts/list", {});
  srv.stop();

  assert.ok(!resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
  const prompts = resp.result.prompts;

  const byName = Object.fromEntries(prompts.map((p) => [p.name, p]));

  // find-top-works-by-topic: only resource_type + topic required
  const topicPrompt = byName["find-top-works-by-topic"];
  assert.ok(topicPrompt, "find-top-works-by-topic should be listed");
  const topicRequired = topicPrompt.arguments.filter((a) => a.required).map((a) => a.name);
  assert.deepEqual(topicRequired.sort(), ["resource_type", "topic"]);
  const topicOptional = topicPrompt.arguments.filter((a) => !a.required);
  assert.equal(topicOptional.length, 0, "find-top-works-by-topic should have no optional args");

  // repository-summary: only repository_name required
  const repoPrompt = byName["repository-summary"];
  assert.ok(repoPrompt, "repository-summary should be listed");
  const repoRequired = repoPrompt.arguments.filter((a) => a.required).map((a) => a.name);
  assert.deepEqual(repoRequired, ["repository_name"]);
  const repoOptional = repoPrompt.arguments.filter((a) => !a.required);
  assert.equal(repoOptional.length, 0, "repository-summary should have no optional args");

  // researcher-profile: only identifier required
  const profilePrompt = byName["researcher-profile"];
  assert.ok(profilePrompt, "researcher-profile should be listed");
  const profileRequired = profilePrompt.arguments.filter((a) => a.required).map((a) => a.name);
  assert.deepEqual(profileRequired, ["identifier"]);
  const profileOptional = profilePrompt.arguments.filter((a) => !a.required);
  assert.equal(profileOptional.length, 0, "researcher-profile should have no optional args");
});

// ---------------------------------------------------------------------------
// prompts/get — rendering tests (no network for these three)
// ---------------------------------------------------------------------------

await test("find-top-works-by-topic renders correctly", async () => {
  const srv = startServer();
  await srv.init();

  const resp = await srv.send("prompts/get", {
    name: "find-top-works-by-topic",
    arguments: { resource_type: "Dataset", topic: "climate change" },
  });
  srv.stop();

  assert.ok(!resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
  const text = resp.result.messages[0].content.text;
  assert.ok(text.includes("Dataset"), "should mention the resource type");
  assert.ok(text.includes("climate change"), "should mention the topic");
  assert.ok(text.includes("page_size = 10"), "should hardcode page_size 10");
});

await test("find-top-works-by-topic: missing required arg returns MCP error", async () => {
  const srv = startServer();
  await srv.init();

  const resp = await srv.send("prompts/get", {
    name: "find-top-works-by-topic",
    arguments: { resource_type: "Dataset" }, // missing topic
  });
  srv.stop();

  assert.ok(resp.error, "Expected MCP error for missing required arg");
  assert.equal(resp.error.code, -32602);
});

await test("researcher-profile: ORCID path renders correctly", async () => {
  const srv = startServer();
  await srv.init();

  const resp = await srv.send("prompts/get", {
    name: "researcher-profile",
    arguments: { identifier: "0000-0001-8135-3489" },
  });
  srv.stop();

  assert.ok(!resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
  const text = resp.result.messages[0].content.text;
  assert.ok(text.includes("0000-0001-8135-3489"), "should include the ORCID");
  assert.ok(text.includes("search_by_person"), "should reference the search tool");
});

await test("researcher-profile: https://orcid.org/ prefix is stripped", async () => {
  const srv = startServer();
  await srv.init();

  const resp = await srv.send("prompts/get", {
    name: "researcher-profile",
    arguments: { identifier: "https://orcid.org/0000-0001-8135-3489" },
  });
  srv.stop();

  assert.ok(!resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
  const text = resp.result.messages[0].content.text;
  assert.ok(text.includes("0000-0001-8135-3489"), "should contain stripped ORCID");
});

await test("researcher-profile: name path renders correctly", async () => {
  const srv = startServer();
  await srv.init();

  const resp = await srv.send("prompts/get", {
    name: "researcher-profile",
    arguments: { identifier: "Jane Smith" },
  });
  srv.stop();

  assert.ok(!resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
  const text = resp.result.messages[0].content.text;
  assert.ok(text.includes("Jane Smith"), "should include the name");
  assert.ok(text.toLowerCase().includes("disambiguation"), "should mention disambiguation");
});

// ---------------------------------------------------------------------------
// repository-summary — rendering test [network]
// ---------------------------------------------------------------------------

await test("repository-summary: Zenodo resolves and renders prompt [network]", async () => {
  const srv = startServer();
  await srv.init();

  const resp = await srv.send("prompts/get", {
    name: "repository-summary",
    arguments: { repository_name: "Zenodo" },
  });
  srv.stop();

  assert.ok(!resp.error, `Unexpected error: ${JSON.stringify(resp.error)}`);
  const text = resp.result.messages[0].content.text;
  assert.ok(text.includes("Zenodo"), "should reference Zenodo by name");
  assert.ok(text.includes("client_id"), "should include the resolved client_id");
  assert.ok(text.includes("get_repository"), "should reference get_repository tool");

  // Print the resolved client_id for inspection
  const match = text.match(/client_id.*?`([^`]+)`/);
  if (match) console.log(`  Resolved Zenodo → client_id: ${match[1]}`);
});

await test("repository-summary: unknown repository name returns not_found message [network]", async () => {
  const srv = startServer();
  await srv.init();

  const resp = await srv.send("prompts/get", {
    name: "repository-summary",
    arguments: { repository_name: "nonexistent-repository-xyz-99999" },
  });
  srv.stop();

  assert.ok(!resp.error, "Should return a valid prompt response (not an MCP error)");
  const text = resp.result.messages[0].content.text;
  assert.ok(
    text.toLowerCase().includes("no datacite repository found") ||
      text.toLowerCase().includes("not found"),
    "Should include a not-found message"
  );
});
