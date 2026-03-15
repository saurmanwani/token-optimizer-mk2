import { NextRequest, NextResponse } from "next/server";
import { OptimizeRequest, OptimizationResult, Change } from "@/lib/types";
import { optimizeQuantitative } from "@/lib/engines/quantitative";
import { optimizeQualitative } from "@/lib/engines/qualitative";

export async function POST(request: NextRequest) {
  try {
    const body: OptimizeRequest = await request.json();
    const { prompt, targetLLM, mode, apiKey } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (mode === "quantitative") {
      const result = optimizeQuantitative(prompt);
      return NextResponse.json(result);
    }

    if (mode === "qualitative") {
      try {
        const result = await optimizeQualitative(prompt, targetLLM, apiKey);
        return NextResponse.json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Qualitative optimization failed";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    if (mode === "both") {
      // First do quantitative (rule-based)
      const quantResult = optimizeQuantitative(prompt);

      // Then do qualitative on the already-compressed prompt
      try {
        const qualResult = await optimizeQualitative(
          quantResult.optimizedPrompt,
          targetLLM,
          apiKey
        );

        const allChanges: Change[] = [
          ...quantResult.changes,
          ...qualResult.changes,
        ];

        const result: OptimizationResult = {
          optimizedPrompt: qualResult.optimizedPrompt,
          changes: allChanges,
          tokenStats: {
            before: quantResult.tokenStats.before,
            after: qualResult.tokenStats.after,
            saved: quantResult.tokenStats.before - qualResult.tokenStats.after,
            percentSaved:
              quantResult.tokenStats.before > 0
                ? Math.round(
                    ((quantResult.tokenStats.before - qualResult.tokenStats.after) /
                      quantResult.tokenStats.before) *
                      100
                  )
                : 0,
          },
          taskType: qualResult.taskType,
          techniquesApplied: qualResult.techniquesApplied,
        };

        return NextResponse.json(result);
      } catch {
        // If qualitative fails (no API key), return just quantitative
        return NextResponse.json({
          ...quantResult,
          warning:
            "Qualitative optimization unavailable (no API key). Showing quantitative results only.",
        });
      }
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
