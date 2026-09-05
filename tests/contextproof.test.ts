import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStaleToolOutputPolicy,
  createBenchmarkFixtures,
  inspectContext,
  normalizeTrace,
  recommendPolicies,
  retrieveExact,
  runBenchmark,
} from "../src/lib/contextproof";

test("normalizes common message arrays", () => {
  const events = normalizeTrace({
    messages: [
      { role: "system", content: "Keep evidence exact." },
      { role: "tool", name: "shell", output: "FATAL E500" },
    ],
  });
  assert.equal(events.length, 2);
  assert.equal(events[1].content, "FATAL E500");
  assert.equal(events[1].role, "tool");
});

test("inspects categories, repetition, and cacheable prefix", () => {
  const events = normalizeTrace([
    { id: "a", role: "system", content: "stable instructions" },
    { id: "b", role: "system", name: "tool schema", content: "{}" },
    { id: "c", role: "user", content: "question" },
    { id: "d", role: "assistant", content: "question" },
  ]);
  const result = inspectContext(events, {
    modelId: "gpt-4.1",
    generatedAt: "2026-09-05T00:00:00.000Z",
  });
  assert.ok(result.totalTokens > 0);
  assert.ok(result.repeatedTokens > 0);
  assert.ok(result.cacheablePrefixTokens > 0);
  assert.equal(result.model.accuracyLabel, "exact-family-tokenizer");
});

test("reversible stale-output policy preserves exact bytes", () => {
  const large = `FATAL E5042\n${"INFO repeated line\n".repeat(200)}`;
  const events = Array.from({ length: 5 }, (_, index) => ({
    id: `tool-${index}`,
    role: "tool" as const,
    name: "shell",
    content: index === 0 ? large : `LOG ${index}\n${"noise\n".repeat(200)}`,
  }));
  const result = applyStaleToolOutputPolicy(events, {
    keepRecent: 3,
    minimumTokens: 20,
  });
  assert.ok(result.savedTokens > 0);
  const firstHandle = Object.keys(result.recovery)[0];
  assert.ok(firstHandle);
  assert.equal(retrieveExact(firstHandle, result.recovery), large);
});

test("recommendations remain advisory or recoverable", () => {
  const events = createBenchmarkFixtures()[0].events;
  const inspection = inspectContext(events);
  const recommendations = recommendPolicies(inspection, events);
  assert.ok(recommendations.length > 0);
  assert.equal(
    recommendations.some((item) => item.safety === "lossless" || item.safety === "recoverable" || item.safety === "advisory"),
    true
  );
});

test("synthetic benchmark reports limitations and retains invariants", () => {
  const report = runBenchmark();
  assert.equal(report.generatedCases, 120);
  assert.equal(report.fixtureTemplates, 6);
  assert.equal(report.failedCases, 0);
  assert.equal(report.invariantRetentionPercent, 100);
  assert.equal(report.byteExactRecoveryPercent, 100);
  assert.ok(report.savedTokens > 0);
  assert.equal(report.baselines.length, 4);
  assert.equal(
    report.baselines.find((item) => item.id === "stale-tool-output-v1")
      ?.invariantRetentionPercent,
    100
  );
  assert.ok(
    (report.baselines.find((item) => item.id === "recent-events-truncation")
      ?.invariantRetentionPercent ?? 100) < 100
  );
  assert.ok(report.limitations.length >= 4);
});
