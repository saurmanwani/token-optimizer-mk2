import { TargetLLM, OptimizationResult, Change, TaskType } from "../types";
import { countTokens } from "../tokenizer";

function getMetaPrompt(targetLLM: TargetLLM): string {
  const llmFormattingRules: Record<TargetLLM, string> = {
    claude: `## Claude-Specific Formatting Rules
- Wrap different content types in XML tags: <instructions>, <context>, <examples>, <constraints>, <output_format>
- Put few-shot examples inside <example> tags (multiple inside <examples>)
- Place long documents/data at the TOP of the prompt, query at the bottom
- Set the role in a <system> or system-level instruction
- For complex reasoning tasks, suggest the user enable extended thinking
- Use clear, direct instructions -- Claude responds well to explicit requests
- Avoid over-prompting; Claude's latest models are proactive and overtrigger on aggressive instructions
- Match prompt formatting style to desired output style`,

    chatgpt: `## ChatGPT/GPT-Specific Formatting Rules
- Structure with developer/user/assistant message roles
- Use the "instructions" parameter for system-level behavior
- For GPT models: provide explicit step-by-step instructions (like a junior coworker)
- For reasoning models (o-series): provide high-level goals (like a senior coworker)
- Use JSON structured output format when extracting data
- Use clear delimiters (###, ----, XML tags) between sections
- Add few-shot examples with clear Input/Output delimiters
- Suggest temperature and other parameter settings when relevant`,

    gemini: `## Gemini-Specific Formatting Rules
- Use system instructions for role and behavioral setup
- JSON output format is preferred for structured data (it reduces hallucinations)
- Include diverse few-shot examples with edge cases
- Mix up classes in classification examples to avoid overfitting
- Suggest temperature, top-K, and top-P settings
- Document prompts in structured format (name, goal, model, settings)`,

    opensource: `## Open Source Model Formatting Rules (Llama, Mistral, etc.)
- Keep formatting simpler and more direct
- Use the model's specific chat template tokens (### System, ### User, ### Assistant)
- Shorter prompts perform better -- these models are more sensitive to prompt length
- Explicit few-shot examples are critical
- Avoid deep XML nesting or complex structural formatting
- Be very explicit about output format requirements`,

    generic: `## General Formatting Rules
- Use clear section headers to separate role, context, task, constraints, and output format
- Provide 3-5 diverse few-shot examples for non-trivial tasks
- Be specific about output format and constraints
- Use numbered steps for multi-step instructions
- Add success criteria when applicable`,
  };

  return `You are an expert prompt engineer with deep knowledge of all major LLMs and prompting techniques.

Your job is to take a user's raw prompt and transform it into a highly optimized prompt that will produce significantly better results from the target LLM.

## Your Process
1. **Detect task type**: Classify the prompt into one of: classification, reasoning, coding, creative, extraction, multistep, qa, general
2. **Identify weaknesses**: Find vague instructions, missing structure, absent examples, wrong format, missing constraints
3. **Apply techniques**: Based on task type, apply the most appropriate prompting techniques:
   - Classification → few-shot examples, output format constraint, system prompt
   - Reasoning/Math → Chain of Thought, "think step by step", structured reasoning
   - Coding → role prompting ("expert developer"), test-driven instructions, language-specific guidance
   - Creative → role + tone + style specification, directional stimulus
   - Extraction → structured output schema (JSON/XML), few-shot with edge cases
   - Multi-step → step decomposition, prompt chaining suggestions
   - Q&A → context grounding, source citation instructions, step-back prompting
4. **Format for target LLM**: Apply LLM-specific formatting rules

${llmFormattingRules[targetLLM]}

## Structure Enhancement
Always ensure the optimized prompt has these clear sections (where applicable):
1. **Role/Persona**: Who is the LLM acting as
2. **Context**: Background information relevant to the task
3. **Task**: The specific instruction (clear, direct, action-verb-led)
4. **Constraints**: Boundaries, limitations, things to avoid
5. **Output Format**: Exactly how the response should be structured
6. **Examples**: Few-shot examples if the task benefits from them

## Rules
- Do NOT change the semantic intent of the prompt
- Do NOT add information the user didn't provide or imply
- Do NOT remove content/data the user included (examples, reference text, code)
- DO make vague requests specific
- DO add structure where it's missing
- DO add appropriate technique markers (e.g., "think step by step" for reasoning)
- DO format specifically for the target LLM
- Keep the optimized prompt as concise as possible while being thorough

## Output Format
Return ONLY valid JSON (no markdown code fences) with this exact structure:
{
  "optimized_prompt": "the full optimized prompt text",
  "changes": [
    {"description": "what was changed", "technique": "technique name", "category": "structure|technique|formatting"}
  ],
  "task_type": "one of: classification, reasoning, coding, creative, extraction, multistep, qa, general",
  "techniques_applied": ["technique1", "technique2"]
}`;
}

export async function optimizeQualitative(
  prompt: string,
  targetLLM: TargetLLM,
  apiKey?: string
): Promise<OptimizationResult> {
  const key = apiKey || process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error(
      "No API key provided. Set OPENAI_API_KEY environment variable or provide a key via BYOK."
    );
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key });

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    messages: [
      { role: "developer", content: getMetaPrompt(targetLLM) },
      {
        role: "user",
        content: `Optimize this prompt for ${targetLLM}:\n\n${prompt}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from optimizer LLM");
  }

  let parsed: {
    optimized_prompt: string;
    changes: { description: string; technique: string; category: string }[];
    task_type: string;
    techniques_applied: string[];
  };

  try {
    parsed = JSON.parse(content);
  } catch {
    // Try extracting JSON from markdown code fences
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error("Failed to parse optimizer response as JSON");
    }
  }

  const beforeTokens = countTokens(prompt);
  const afterTokens = countTokens(parsed.optimized_prompt);
  const saved = beforeTokens - afterTokens;

  const changes: Change[] = parsed.changes.map((c) => ({
    description: c.description,
    technique: c.technique,
    category: c.category as Change["category"],
  }));

  return {
    optimizedPrompt: parsed.optimized_prompt,
    changes,
    tokenStats: {
      before: beforeTokens,
      after: afterTokens,
      saved,
      percentSaved:
        beforeTokens > 0 ? Math.round((saved / beforeTokens) * 100) : 0,
    },
    taskType: parsed.task_type as TaskType,
    techniquesApplied: parsed.techniques_applied,
  };
}
