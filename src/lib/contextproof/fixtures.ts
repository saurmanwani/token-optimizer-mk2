import type { BenchmarkFixture, ContextCategory, TraceEvent } from "./types";

const TEMPLATE_COUNT = 6;
const VARIATIONS_PER_TEMPLATE = 20;

function repeatNoise(prefix: string, variation: number, lines = 80): string {
  return Array.from(
    { length: lines },
    (_, index) => `${prefix} sequence=${index} fixture=${variation} status=ok`
  ).join("\n");
}

function event(
  id: string,
  role: TraceEvent["role"],
  content: string,
  name?: string
): TraceEvent {
  return { id, role, content, name };
}

function template(
  type: number,
  variation: number
): Omit<BenchmarkFixture, "id"> {
  const marker = `CP_INVARIANT_${type}_${variation}`;
  const path = `/workspace/service-${variation}/src/handler.ts`;
  const error = `FATAL E${5000 + variation}: database timeout`;
  const command = `npm test -- --runInBand fixture-${variation}`;
  const base = [
    event("system", "system", "You are a coding agent. Preserve exact evidence."),
    event("user", "user", `Diagnose fixture ${variation} without inventing facts.`),
  ];

  const definitions: Array<{
    category: ContextCategory;
    description: string;
    outputs: string[];
    mustKeep: string[];
  }> = [
    {
      category: "log",
      description: "Noisy logs with a buried fatal error",
      outputs: [
        `${repeatNoise("INFO healthcheck", variation)}\n${error}\n${marker}`,
        repeatNoise("DEBUG pool", variation),
        repeatNoise("INFO retry", variation),
        repeatNoise("TRACE request", variation),
        repeatNoise("INFO final", variation),
      ],
      mustKeep: [error, marker],
    },
    {
      category: "structured_data",
      description: "Repeated JSON records with an answer-bearing identifier",
      outputs: Array.from({ length: 5 }, (_, outputIndex) =>
        JSON.stringify({
          fixture: variation,
          outputIndex,
          marker: outputIndex === 0 ? marker : "none",
          records: Array.from({ length: 70 }, (_, index) => ({
            id: index,
            status: "ok",
            region: "us-east-1",
            retry: false,
          })),
        })
      ),
      mustKeep: [marker],
    },
    {
      category: "code",
      description: "Repeated code reads with exact path and command invariants",
      outputs: [
        `FILE ${path}\n\`\`\`ts\nexport const marker = "${marker}";\n\`\`\`\n${repeatNoise("// comment", variation)}`,
        repeatNoise("export const value = true;", variation),
        repeatNoise("type Result = { ok: boolean };", variation),
        repeatNoise("function noop() { return true; }", variation),
        repeatNoise("const ready = true;", variation),
      ],
      mustKeep: [path, marker, command],
    },
    {
      category: "tool_schema",
      description: "Large repeated tool descriptions",
      outputs: Array.from({ length: 5 }, (_, outputIndex) =>
        JSON.stringify({
          name: `tool_${outputIndex}`,
          description: repeatNoise("parameter description", variation, 55),
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: marker },
            },
          },
        })
      ),
      mustKeep: [marker],
    },
    {
      category: "conversation",
      description: "Long agent history with stale search results",
      outputs: [
        `${repeatNoise("SEARCH result irrelevant", variation)}\nEvidence: ${marker}`,
        repeatNoise("SEARCH secondary", variation),
        repeatNoise("TOOL explanation", variation),
        repeatNoise("SEARCH recent", variation),
        repeatNoise("TOOL latest", variation),
      ],
      mustKeep: [marker],
    },
    {
      category: "tool_output",
      description: "Mixed command outputs with security-relevant evidence",
      outputs: [
        `${command}\n${repeatNoise("PASS unit", variation)}\nTRUST_BOUNDARY=${marker}`,
        repeatNoise("dependency listing", variation),
        repeatNoise("build artifact", variation),
        repeatNoise("test shard", variation),
        repeatNoise("coverage row", variation),
      ],
      mustKeep: [command, `TRUST_BOUNDARY=${marker}`],
    },
  ];

  const selected = definitions[type];
  const toolEvents = selected.outputs.map((content, index) =>
    event(
      `tool-${index + 1}`,
      "tool",
      content,
      selected.category === "log"
        ? "shell"
        : selected.category === "structured_data"
          ? "api_result"
          : "tool_output"
    )
  );

  if (selected.category === "code") {
    toolEvents.push(event("assistant-command", "assistant", command));
  }

  return {
    category: selected.category,
    description: selected.description,
    events: [...base, ...toolEvents],
    mustKeep: selected.mustKeep,
  };
}

export function createBenchmarkFixtures(): BenchmarkFixture[] {
  const fixtures: BenchmarkFixture[] = [];
  for (let type = 0; type < TEMPLATE_COUNT; type += 1) {
    for (let variation = 0; variation < VARIATIONS_PER_TEMPLATE; variation += 1) {
      fixtures.push({
        id: `template-${type + 1}-case-${variation + 1}`,
        ...template(type, variation),
      });
    }
  }
  return fixtures;
}

export const benchmarkFixtureMetadata = {
  templates: TEMPLATE_COUNT,
  variationsPerTemplate: VARIATIONS_PER_TEMPLATE,
  generatedCases: TEMPLATE_COUNT * VARIATIONS_PER_TEMPLATE,
};
