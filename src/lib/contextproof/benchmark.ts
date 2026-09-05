import {
  applyStaleToolOutputPolicy,
  retrieveExact,
} from "./intervene";
import { benchmarkFixtureMetadata, createBenchmarkFixtures } from "./fixtures";
import { countEventTokens, getModelProfile } from "./models";
import { optimizeQuantitative } from "../engines/quantitative";
import type {
  BenchmarkBaselineSummary,
  BenchmarkCaseResult,
  BenchmarkFixture,
  BenchmarkReport,
} from "./types";

function scoreFixture(
  fixture: BenchmarkFixture,
  modelId: string
): BenchmarkCaseResult {
  const result = applyStaleToolOutputPolicy(fixture.events, {
    modelId,
    keepRecent: 3,
    minimumTokens: 128,
  });
  const active = result.events.map((event) => event.content).join("\n");
  const recovered: string[] = [];
  let recoveryExact = true;

  for (const handle of Object.keys(result.recovery)) {
    try {
      recovered.push(retrieveExact(handle, result.recovery));
    } catch {
      recoveryExact = false;
    }
  }
  const searchable = `${active}\n${recovered.join("\n")}`;
  const failures = fixture.mustKeep
    .filter((invariant) => !searchable.includes(invariant))
    .map((invariant) => `Missing invariant: ${invariant}`);
  if (!recoveryExact) failures.push("Recovery integrity check failed.");
  if (result.savedTokens < 0) failures.push("Policy increased token count.");

  const invariantsRetained = fixture.mustKeep.length - failures.filter((failure) =>
    failure.startsWith("Missing invariant:")
  ).length;

  return {
    fixtureId: fixture.id,
    category: fixture.category,
    passed: failures.length === 0,
    originalTokens: result.originalTokens,
    resultingTokens: result.resultingTokens,
    savedTokens: result.savedTokens,
    savedPercent: result.savedPercent,
    invariantsTotal: fixture.mustKeep.length,
    invariantsRetained,
    recoveryExact,
    processingMs: result.processingMs,
    failures,
  };
}

function retainedPercent(retained: number, total: number): number {
  return total > 0 ? Math.round((retained / total) * 10_000) / 100 : 100;
}

function compareBaselines(
  fixtures: BenchmarkFixture[],
  modelId: string,
  originalTokens: number,
  staleTokens: number,
  staleRetained: number,
  invariantsTotal: number
): BenchmarkBaselineSummary[] {
  const model = getModelProfile(modelId);
  let truncatedTokens = 0;
  let truncatedRetained = 0;
  let legacyTokens = 0;
  let legacyRetained = 0;

  for (const fixture of fixtures) {
    const fixed = fixture.events.filter(
      (event) => event.role === "system" || event.role === "user"
    );
    const recent = fixture.events
      .filter((event) => event.role !== "system" && event.role !== "user")
      .slice(-3);
    const truncatedEvents = [...fixed, ...recent];
    const truncated = truncatedEvents.map((event) => event.content).join("\n");
    truncatedTokens += truncatedEvents.reduce(
      (sum, event) => sum + countEventTokens(event, model),
      0
    );
    truncatedRetained += fixture.mustKeep.filter((value) =>
      truncated.includes(value)
    ).length;

    const legacyEvents = fixture.events.map((event) => ({
      ...event,
      content: optimizeQuantitative(event.content).optimizedPrompt,
    }));
    const legacy = legacyEvents.map((event) => event.content).join("\n");
    legacyTokens += legacyEvents.reduce(
      (sum, event) => sum + countEventTokens(event, model),
      0
    );
    legacyRetained += fixture.mustKeep.filter((value) =>
      legacy.includes(value)
    ).length;
  }

  const summary = (
    id: BenchmarkBaselineSummary["id"],
    label: string,
    resultingTokens: number,
    retained: number,
    recoverable: boolean,
    notes: string
  ): BenchmarkBaselineSummary => ({
    id,
    label,
    resultingTokens,
    savedPercent:
      originalTokens > 0
        ? Math.round(
            ((originalTokens - resultingTokens) / originalTokens) * 10_000
          ) / 100
        : 0,
    invariantRetentionPercent: retainedPercent(retained, invariantsTotal),
    recoverable,
    notes,
  });

  return [
    summary(
      "none",
      "No intervention",
      originalTokens,
      invariantsTotal,
      true,
      "Control: full active context."
    ),
    summary(
      "recent-events-truncation",
      "Keep system, user, and three recent events",
      truncatedTokens,
      truncatedRetained,
      false,
      "Cheap but permanently drops older evidence."
    ),
    summary(
      "legacy-regex",
      "Legacy prompt regex",
      legacyTokens,
      legacyRetained,
      false,
      "Historical prompt-polishing baseline; not safe for structured agent context."
    ),
    summary(
      "stale-tool-output-v1",
      "ContextProof stale-output policy",
      staleTokens,
      staleRetained,
      true,
      "Older eligible tool output remains byte-exact recoverable."
    ),
  ];
}

export function runBenchmark(modelId = "gpt-4.1"): BenchmarkReport {
  const fixtures = createBenchmarkFixtures();
  const cases = fixtures.map((fixture) => scoreFixture(fixture, modelId));
  const originalTokens = cases.reduce((sum, item) => sum + item.originalTokens, 0);
  const resultingTokens = cases.reduce(
    (sum, item) => sum + item.resultingTokens,
    0
  );
  const invariantsTotal = cases.reduce(
    (sum, item) => sum + item.invariantsTotal,
    0
  );
  const invariantsRetained = cases.reduce(
    (sum, item) => sum + item.invariantsRetained,
    0
  );
  const recoveries = cases.filter((item) => item.savedTokens > 0);
  const exactRecoveries = recoveries.filter((item) => item.recoveryExact);
  const categoryDistribution: Record<string, number> = {};
  for (const item of cases) {
    categoryDistribution[item.category] =
      (categoryDistribution[item.category] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    benchmarkVersion: "synthetic-v1",
    model: getModelProfile(modelId),
    fixtureTemplates: benchmarkFixtureMetadata.templates,
    generatedCases: cases.length,
    passedCases: cases.filter((item) => item.passed).length,
    failedCases: cases.filter((item) => !item.passed).length,
    invariantRetentionPercent:
      invariantsTotal > 0
        ? Math.round((invariantsRetained / invariantsTotal) * 10_000) / 100
        : 100,
    byteExactRecoveryPercent:
      recoveries.length > 0
        ? Math.round((exactRecoveries.length / recoveries.length) * 10_000) / 100
        : 100,
    originalTokens,
    resultingTokens,
    savedTokens: originalTokens - resultingTokens,
    savedPercent:
      originalTokens > 0
        ? Math.round(
            ((originalTokens - resultingTokens) / originalTokens) * 10_000
          ) / 100
        : 0,
    meanProcessingMs:
      cases.length > 0
        ? Math.round(
            (cases.reduce((sum, item) => sum + item.processingMs, 0) /
              cases.length) *
              1000
          ) / 1000
        : 0,
    categoryDistribution,
    baselines: compareBaselines(
      fixtures,
      modelId,
      originalTokens,
      resultingTokens,
      invariantsRetained,
      invariantsTotal
    ),
    limitations: [
      "The bundled cases are generated from six synthetic templates, not independent real-agent tasks.",
      "Invariant retention proves evidence remains active or recoverable; it does not prove downstream task success.",
      "OpenAI-family counts use gpt-tokenizer; other provider counts are labeled estimates.",
      "Processing time excludes agent execution, model latency, and future persistent recovery I/O.",
      "External compressors and provider-native compaction are not executed in this offline benchmark.",
    ],
    cases,
  };
}
