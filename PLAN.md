# Token Optimizer - Prompt Optimization Platform

## Project Overview

A web platform (+ lightweight browser extension) that takes a user's LLM prompt and makes it **better** in two distinct ways:

1. **Quantitative Optimization** -- Reduce token count (and therefore cost) without compromising output accuracy or quality.
2. **Qualitative Optimization** -- Restructure and enhance prompts to dramatically improve LLM output quality, tailored to the specific target LLM.

---

## Research & References

### Sources Studied

| Source | Type | Key Takeaways |
|---|---|---|
| [Google Prompt Engineering Whitepaper (Lee Boonstra)](https://www.gptaiflow.com/assets/files/2025-01-18-pdf-1-TechAI-Goolge-whitepaper_Prompt%20Engineering_v4-af36dcc7a49bb7269a58b1c9b89a8ae1.pdf) | PDF (68 pages) | Zero/few-shot, CoT, self-consistency, ToT, ReAct, APE, system/role/contextual prompting, code prompting, LLM configuration (temperature, top-K, top-P), best practices |
| [Prompting Guide (DAIR.ai)](https://www.promptingguide.ai/introduction) | Website | Comprehensive technique catalog: 18+ techniques from zero-shot to graph prompting |
| [Google Cloud - What is Prompt Engineering](https://cloud.google.com/discover/what-is-prompt-engineering) | Website | Prompt types, use cases, strategies for better prompts, CoT, few-shot |
| [Claude Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) | Docs | XML tags, role prompting, adaptive thinking, output control, agentic systems, long-context handling |
| [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering) | Docs | Message roles (developer/user/assistant), structured outputs, reasoning vs GPT model differences, few-shot with delimiters |
| [The Complete Prompt Engineering Guide (Benjy Bodner)](https://www.youtube.com/watch?v=42LJ955MGHU) | Video | 3 levels of prompting (task, role-based 5-step formula, meta prompting), fast vs thinking models |
| [Prompt Engineering Guide - Beginner to Advanced (Matthew Berman)](https://www.youtube.com/watch?v=uDIW34h8cmM) | Video | End-to-end walkthrough of the Google whitepaper techniques with practical examples |

---

## Prompt Engineering Techniques Catalog

### Foundational Techniques

| Technique | Description | When to Apply |
|---|---|---|
| **Zero-shot** | Direct instruction with no examples | Simple, well-defined tasks |
| **One-shot** | Single example provided | Tasks needing format demonstration |
| **Few-shot** (3-5 examples) | Multiple examples showing the pattern | Classification, extraction, formatting |
| **Multi-shot** | Many examples for complex patterns | Edge-case-heavy tasks, nuanced classification |

### Reasoning Techniques

| Technique | Description | When to Apply |
|---|---|---|
| **Chain of Thought (CoT)** | Encourage step-by-step reasoning | Math, logic, multi-step reasoning |
| **Zero-shot CoT** | Add "think step by step" without examples | Quick reasoning boost without examples |
| **Self-Consistency** | Generate multiple reasoning paths, take majority | High-stakes reasoning where accuracy matters |
| **Tree of Thoughts (ToT)** | Explore multiple reasoning branches | Complex problem-solving, planning |
| **Step-back Prompting** | Ask a higher-level question first, then the specific one | When direct questions fail |

### Structural Techniques

| Technique | Description | When to Apply |
|---|---|---|
| **System Prompting** | Set the overall context and purpose | Every prompt (defines model behavior) |
| **Role Prompting** | Assign a specific persona/identity | Domain-specific expertise needed |
| **Contextual Prompting** | Provide task-specific background | When the model lacks domain context |
| **XML Tags (Claude)** | Wrap content in semantic XML tags | Claude prompts with mixed content types |
| **JSON Structured Output** | Request output in JSON schema | Data extraction, API responses |
| **Meta Prompting** | Prompt about prompting (self-improvement) | When you want the LLM to help design the prompt |

### Advanced Techniques

| Technique | Description | When to Apply |
|---|---|---|
| **ReAct** | Interleave reasoning and action steps | Tool-using agents, multi-step tasks |
| **Prompt Chaining** | Break complex tasks into sequential prompts | Multi-stage workflows |
| **Automatic Prompt Engineer (APE)** | LLM generates and evaluates its own prompts | Meta-optimization |
| **Active-Prompt** | Dynamically select the most informative examples | Adaptive few-shot |
| **Directional Stimulus** | Add a hint/keyword to guide generation direction | Creative tasks, specific focus areas |
| **Reflexion** | Self-reflect on previous outputs to improve | Iterative improvement tasks |
| **Program-Aided Language (PAL)** | Generate code to solve problems | Math, data processing |

### LLM Configuration Knowledge

| Parameter | Effect | Recommended Starting Points |
|---|---|---|
| **Temperature** | Controls randomness (0 = deterministic, 1+ = creative) | Factual: 0-0.2, General: 0.5-0.7, Creative: 0.8-1.0 |
| **Top-K** | Limits token candidates to K most likely | Conservative: 20, General: 30, Creative: 40 |
| **Top-P** | Limits token candidates by cumulative probability | Conservative: 0.9, General: 0.95, Creative: 0.99 |
| **Output Length** | Max tokens in response | Set to expected length + buffer; too high wastes compute |

---

## LLM-Specific Formatting Rules

### Claude (Anthropic)

- **Structure**: XML tags are first-class (`<instructions>`, `<context>`, `<examples>`, `<example>`, `<output_format>`, `<constraints>`)
- **Role**: Set in system prompt, even a single sentence makes a difference
- **Examples**: Wrap in `<example>` tags (multiple in `<examples>` tags) -- 3-5 for best results
- **Long context**: Put documents at the TOP, query at the bottom (up to 30% quality improvement)
- **Thinking**: For complex tasks, suggest adaptive thinking or extended thinking with interleaved mode
- **Formatting**: Use XML format indicators to control output; match prompt style to desired output style
- **Avoid**: Over-prompting (Claude 4.5+ models are more proactive; aggressive instructions cause overtriggering)

```xml
<system>You are an expert data analyst specializing in financial markets.</system>

<instructions>
Analyze the following dataset and provide:
1. Key trends
2. Anomalies
3. Actionable recommendations
</instructions>

<context>
The data covers Q1-Q4 2025 revenue figures for a SaaS company.
</context>

<output_format>
Return your analysis as a structured report with headers for each section.
Use specific numbers from the data to support each finding.
</output_format>

<data>
{{user_data}}
</data>
```

### ChatGPT / GPT Models (OpenAI)

- **Structure**: Use `developer` (system-level), `user`, and `assistant` roles; `instructions` parameter for high-level behavior
- **Reasoning vs GPT**: Reasoning models (o-series) need high-level goals ("senior coworker"); GPT models need explicit step-by-step ("junior coworker")
- **Structured Output**: JSON schema enforcement via Structured Outputs feature
- **Few-shot**: Use clear delimiters between examples; XML-style or markdown separators work
- **Formatting**: Explicit `developer` message for tone, constraints, format
- **Reusable prompts**: Dashboard-based prompt templates with variables

```json
{
  "model": "gpt-4.1",
  "messages": [
    {
      "role": "developer",
      "content": "You are an expert data analyst specializing in financial markets. Always respond with structured JSON containing: trends (array), anomalies (array), recommendations (array). Support each finding with specific numbers from the data."
    },
    {
      "role": "user",
      "content": "Analyze this Q1-Q4 2025 SaaS revenue dataset:\n\n{{user_data}}"
    }
  ]
}
```

### Gemini (Google)

- **Structure**: System instructions + prompt body; supports JSON and XML output formats
- **Configuration**: Heavily tunable via temperature, top-K, top-P (all three interact)
- **Few-shot**: Essential for classification tasks; mix up classes in examples; include edge cases
- **Output**: JSON format forces structure and limits hallucinations
- **Best practice**: Document prompt attempts in structured table format (name, goal, model, temp, top-K, top-P, prompt, output)

```
System: You are an expert data analyst specializing in financial markets.

Instructions: Analyze the following dataset. Return your analysis as valid JSON with this schema:

{
  "trends": [{"description": String, "evidence": String}],
  "anomalies": [{"description": String, "severity": "high" | "medium" | "low"}],
  "recommendations": [{"action": String, "expected_impact": String}]
}

Data:
{{user_data}}
```

### Open Source Models (Llama, Mistral, etc.)

- **Structure**: Simpler formatting; use chat template tokens specific to the model
- **Prompts**: Keep shorter and more direct; less tolerant of complex nested formatting
- **Examples**: Explicit few-shot examples are critical (these models are more sensitive)
- **Avoid**: Deep XML nesting, overly long system prompts, assumptions about instruction-following capability

```
### System:
You are a data analyst. Analyze the data and return findings as JSON.

### User:
Here is the dataset:
{{user_data}}

Return JSON with keys: "trends", "anomalies", "recommendations".
Each should be an array of objects with "description" and "detail" fields.

### Assistant:
```

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  Web App      │  │  Browser     │  │  API (for             │  │
│  │  (Full)       │  │  Extension   │  │  integrations)        │  │
│  │              │  │  (Lite)      │  │                       │  │
│  │  Quant+Qual  │  │  Quant ONLY  │  │  Quant+Qual           │  │
│  │  LLM-powered │  │  Rule-based  │  │  LLM-powered          │  │
│  │  All features │  │  No LLM     │  │  Programmatic access  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                 │                      │              │
└─────────┼─────────────────┼──────────────────────┼──────────────┘
          │                 │                      │
          ▼                 ▼                      ▼
┌─────────────────┐  ┌─────────────┐  ┌─────────────────────────┐
│  Backend API    │  │  LOCAL JS   │  │  Backend API            │
│  (Next.js)      │  │  ENGINE     │  │  (same as web app)      │
│                 │  │  (no server │  │                         │
│  Meta-prompt +  │  │   calls)    │  │                         │
│  LLM call       │  │             │  │                         │
│  Token counting │  │  Rule-based │  │                         │
│  Diff generation│  │  transforms │  │                         │
│                 │  │  Token count │  │                         │
└─────────────────┘  └─────────────┘  └─────────────────────────┘
```

### Two Engines

#### Engine 1: Rule-Based Quantitative Engine (No LLM Required)

This is the lightweight engine that powers the **browser extension** and can also be used in the web app. It runs entirely client-side with zero API calls.

**How it works:**

1. **AST-like Prompt Parsing**: Parse the prompt into segments:
   - Instruction blocks (what the user is asking the LLM to do)
   - Content blocks (data, examples, quoted text that must NOT be modified)
   - Metadata blocks (role definitions, system prompts, format specs)

2. **Context-Aware Filler Detection & Removal**:

   | Pattern | Example | Replacement | Rule |
   |---|---|---|---|
   | Politeness tokens in instructions | "Please generate a summary" | "Generate a summary" | Remove "please", "kindly", "thank you" ONLY in instruction segments |
   | Verbose openers | "I was wondering if you could help me with" | Direct verb form | Regex patterns for common verbose constructions |
   | Redundant qualifiers | "very specifically generate" | "generate" | Remove "very", "really", "basically", "essentially" when modifying instruction verbs |
   | Hedging language | "I think you should probably" | Direct instruction | Remove "I think", "I believe", "maybe", "probably" in instructions |
   | Conversational fillers | "So, um, what I need is" | Direct statement | Remove discourse markers |
   | Duplicate instructions | "Make it concise. Keep it short." | Single instruction | Detect semantic duplicates via keyword overlap |
   | Unnecessary meta-commentary | "This is a prompt for you to..." | Skip to the actual task | Remove self-referential preambles |

3. **Critical Safety Rules** (what NOT to touch):
   - Text inside quotation marks (could be content/examples)
   - Text inside code blocks
   - Text inside XML/HTML tags that appear to be example content
   - Text after markers like "Example:", "Content:", "Data:", "Input:"
   - Text that is clearly part of the desired output format
   - "Thank you" etc. when they appear in example conversations or desired outputs

4. **Structural Compression**:
   - Remove excessive whitespace/newlines (normalize to single breaks)
   - Collapse repeated delimiters
   - Suggest removing examples beyond 5 if pattern is established (flag, don't auto-remove)

5. **Token Counting** (client-side):
   - Use `tiktoken` (WASM build for browser) for OpenAI models
   - Approximate counting for Claude/Gemini (character-to-token ratio heuristics)
   - Display: before tokens, after tokens, savings %, estimated cost delta

**Implementation**: Pure JavaScript/TypeScript, runs in browser or extension. No network calls. No privacy concerns.

#### Engine 2: LLM-Powered Qualitative + Advanced Quantitative Engine

This powers the **web app** and **API**. It uses an LLM with a meta-prompt to deeply analyze and restructure prompts.

**Backend LLM Choice Analysis:**

| LLM | Pros | Cons | Cost (approx per 1M tokens) |
|---|---|---|---|
| **GPT-4.1** | Fast, cheap, excellent instruction following, 1M context | Not the smartest for nuanced restructuring | ~$2 input / ~$8 output |
| **GPT-4.1-mini** | Very cheap, fast | Less capable for complex prompt analysis | ~$0.40 input / ~$1.60 output |
| **Claude Sonnet 4.6** | Excellent at understanding prompt structure, great at XML | Slightly more expensive | ~$3 input / ~$15 output |
| **Claude Haiku 4.5** | Cheap, fast, good enough for many optimizations | Less capable for deep restructuring | ~$0.80 input / ~$4 output |
| **Gemini 2.5 Flash** | Very cheap, fast, good reasoning | Less proven for meta-prompt tasks | ~$0.15 input / ~$0.60 output |

**Recommendation: Tiered approach**
- **Default/Free tier**: Gemini 2.5 Flash or GPT-4.1-mini (cheapest, good enough for most)
- **Pro tier**: GPT-4.1 or Claude Sonnet 4.6 (better restructuring quality)
- **Let the user choose**: Advanced users can pick which backend model optimizes their prompt

**Privacy Considerations:**
- User prompts are sent to our server and then to the LLM provider
- Required: Clear privacy policy, ToS, data processing agreement
- User prompts should NOT be stored unless the user opts in (prompt history feature)
- Consider: Option to bring your own API key (BYOK) so prompts go directly to their LLM provider
- The browser extension (quantitative-only) avoids this entirely -- fully local

**The Meta-Prompt** (what we send to our backend LLM):

The meta-prompt is the core IP. It instructs the optimizer LLM to:
1. Classify the user's prompt intent and task type
2. Identify weaknesses (vague instructions, missing structure, no examples, wrong format for target LLM)
3. Apply the appropriate techniques from our catalog
4. Reformat for the target LLM
5. Return: optimized prompt + change explanation + technique badges

---

## Mode 1: Quantitative Optimization (Token Saving)

### Goal
Same or better output quality, fewer tokens, lower cost.

### What It Does

1. **Context-Aware Filler Removal** (see Engine 1 above for full rules)
2. **Structural Compression** (merge duplicates, normalize whitespace)
3. **Token Counting & Cost Estimation** (before/after with $ delta)

### Advanced Quantitative (LLM-Powered)

When the LLM engine is available, additional optimizations:
- Semantic deduplication (detect instructions that say the same thing differently)
- Intelligent example pruning (identify which few-shot examples are redundant)
- Instruction consolidation (merge scattered constraints into a single block)
- Context window awareness (warn if prompt is too large for target model)

---

## Mode 2: Qualitative Optimization (Output Quality)

### Goal
Dramatically better LLM output from the same intent.

### What It Does

1. **Intent Detection & Task Classification**
   - Classify into: generation, extraction, classification, reasoning, coding, creative, multi-step, Q&A
   - This drives which techniques to apply

2. **Technique Application Engine** (auto-selected based on task type):

   | Task Type | Techniques Applied |
   |---|---|
   | Classification | Few-shot examples, system prompt, output format constraint |
   | Reasoning / Math | Chain of Thought, Zero-shot CoT ("think step by step"), self-consistency suggestion |
   | Code generation | Role prompting ("expert [language] developer"), code-specific instructions, test-driven prompting |
   | Creative writing | Role + tone + style specification, directional stimulus |
   | Data extraction | Structured output (JSON/XML), schema definition, few-shot |
   | Multi-step tasks | Prompt chaining suggestions, step-by-step decomposition |
   | Q&A / Research | Context grounding, source citation instructions, step-back prompting |

3. **LLM-Specific Formatting** (see "LLM-Specific Formatting Rules" section above)

4. **Structure Enhancement**
   - Add clear sections: Role/Persona, Context, Task, Constraints, Output Format, Examples
   - Turn vague requests into specific ones
   - Add output format specifications
   - Add constraints and boundaries
   - Add success criteria when missing
   - Suggest system prompt vs user prompt separation

---

## Browser Extension Design (Quantitative-Only, No LLM)

### Why This Exists

- **Zero privacy concerns**: Everything runs locally in the browser
- **Zero cost to user**: No API calls, no subscription needed for basic optimization
- **Instant**: No network latency
- **Works everywhere**: ChatGPT, Claude, Gemini, any LLM web interface
- **Justifies the value**: Users see immediate token savings before committing to the paid web app

### How It Works

1. User types/pastes a prompt in any LLM web interface (ChatGPT, Claude, Gemini, etc.)
2. Extension detects the input textarea
3. Shows a small floating widget with:
   - Token count (live, as they type)
   - "Optimize" button
4. On click: runs the rule-based Engine 1 on the prompt text
5. Shows: optimized text, token delta, option to replace the textarea content
6. Optional: "Want deeper optimization? Try the full app" upsell link

### Extension Tech Stack

- Manifest V3 Chrome Extension
- Pure TypeScript, no external dependencies except tiktoken WASM
- Content script injects into LLM web interfaces
- Popup for settings (enable/disable per site, token counter visibility)

### What the Extension CAN Do (Rule-Based)

- Remove filler words/phrases from instructions (context-aware)
- Normalize whitespace and structure
- Live token counting
- Cost estimation
- Before/after comparison

### What the Extension CANNOT Do (Needs LLM)

- Restructure prompts for specific LLMs
- Add techniques (CoT, few-shot, etc.)
- Detect task type and apply appropriate patterns
- Deep semantic optimization

---

## Cost Justification Analysis

### The Core Question

> "If I'm spending $300/month on tokens, and our tool also uses tokens to optimize, when does it make sense?"

### Math

**Assumptions:**
- Average prompt: ~500 tokens
- Average quantitative savings: 15-30% token reduction
- User sends 10,000 prompts/month (moderate usage)
- Using GPT-4.1 at ~$2/1M input tokens

**User's current cost:**
- 10,000 prompts x 500 tokens = 5M input tokens/month
- Cost: 5M x $2/1M = $10/month in input tokens alone
- (Output tokens add more, but we're optimizing input)

**With quantitative optimization (rule-based, free):**
- 20% average reduction = 4M input tokens
- Savings: $2/month on input tokens
- For output tokens (which are 4-5x more expensive), savings compound

**With qualitative optimization (LLM-powered):**
- Our optimizer call: ~2,000 tokens per optimization (prompt + meta-prompt + response)
- Cost to us: 10,000 x 2,000 tokens = 20M tokens
- Using Gemini 2.5 Flash: 20M x $0.15/1M = $3/month
- Using GPT-4.1-mini: 20M x $0.40/1M = $8/month

**The real value proposition is NOT just token savings:**
- Better prompts = better outputs = fewer retries
- Fewer retries = massive savings (each retry costs full input + output tokens)
- Industry data: poorly written prompts cause 30-50% retry rates
- Reducing retries from 40% to 10% on a $300/month spend = $90/month saved

### Break-Even Analysis

| User Monthly Spend | Rule-Based Savings (free) | LLM-Powered Savings | Our Cost (Gemini Flash) | Net Value |
|---|---|---|---|---|
| $50/mo | ~$10 | ~$15 (fewer retries) | ~$1.50 | +$23.50 |
| $300/mo | ~$60 | ~$90 (fewer retries) | ~$3 | +$147 |
| $1,000/mo | ~$200 | ~$300 (fewer retries) | ~$5 | +$495 |
| $10,000/mo | ~$2,000 | ~$3,000 (fewer retries) | ~$15 | +$4,985 |

**Conclusion**: The tool pays for itself at virtually any usage level, especially when you factor in retry reduction. The browser extension (free, rule-based) provides immediate value with zero cost.

### Pricing Strategy

| Tier | Price | Features |
|---|---|---|
| **Free** | $0 | Browser extension (quantitative only), 5 web app optimizations/day |
| **Pro** | $19/mo | Unlimited web app optimizations, prompt history, all LLM targets, GPT-4.1-mini backend |
| **Team** | $49/mo per seat | Everything in Pro + shared prompt library, team analytics, GPT-4.1/Claude Sonnet backend |
| **Enterprise** | Custom | BYOK, custom meta-prompts, on-premise option, API access, SLA |

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui | Fast, modern, SSR for SEO, great DX |
| **Backend** | Next.js API Routes | Co-located with frontend, serverless-ready on Vercel |
| **LLM Integration** | OpenAI SDK + Anthropic SDK + Google GenAI SDK | Multi-provider support for the optimizer backend |
| **Token Counting** | `tiktoken` (OpenAI), `@anthropic-ai/tokenizer` (Claude), heuristics (others) | Accurate before/after counts per model |
| **Database** | Supabase (PostgreSQL) | User accounts, prompt history, analytics; generous free tier |
| **Auth** | NextAuth.js or Clerk | Quick setup, multiple OAuth providers |
| **Hosting** | Vercel | Zero-config Next.js deployment, edge functions |
| **Rate Limiting** | Upstash Redis | Serverless-compatible, prevent abuse on free tier |
| **Extension** | Chrome Manifest V3 + TypeScript + tiktoken WASM | Pure client-side, no server dependency |
| **Monitoring** | PostHog or Mixpanel | Usage analytics, conversion tracking |

---

## MVP Feature Set

### Web App (v1)

1. Prompt input textarea
2. Target LLM selector (Claude, ChatGPT, Gemini, Llama/Open Source, Generic)
3. Mode toggle: Quantitative / Qualitative / Both
4. "Optimize" button
5. Side-by-side diff view (original vs optimized)
6. Token count comparison with cost estimate
7. Explanation panel: what was changed and why, with technique badges
8. Copy-to-clipboard for the optimized prompt
9. Basic auth (Google/GitHub OAuth)
10. Prompt history (last 50 optimizations)

### Browser Extension (v1)

1. Live token counter on any LLM web interface
2. One-click quantitative optimization
3. Before/after token comparison
4. Replace-in-place or copy optimized prompt
5. Settings: enable/disable per site, choose target model for token counting
6. "Try full optimization" link to web app

### API (v1)

1. POST `/api/optimize` with prompt, target LLM, mode
2. Returns optimized prompt, token counts, diff, explanations
3. API key auth
4. Rate limiting per tier

---

## Development Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Next.js project with Tailwind + shadcn/ui
- [ ] Build the rule-based quantitative engine (TypeScript)
- [ ] Build token counting module (multi-model)
- [ ] Create the core UI: input, output, diff view

### Phase 2: LLM Integration (Weeks 3-4)
- [ ] Design and test the meta-prompt (iterative process)
- [ ] Integrate OpenAI/Anthropic/Google SDKs
- [ ] Build the qualitative optimization pipeline
- [ ] Add LLM-specific formatting logic
- [ ] Build the explanation/technique badge system

### Phase 3: Polish & Auth (Weeks 5-6)
- [ ] Add authentication (NextAuth.js)
- [ ] Add prompt history with Supabase
- [ ] Add rate limiting
- [ ] Cost estimation display
- [ ] Responsive design + mobile support

### Phase 4: Browser Extension (Weeks 7-8)
- [ ] Chrome Manifest V3 extension scaffold
- [ ] Content script for LLM web interfaces (ChatGPT, Claude, Gemini)
- [ ] Integrate rule-based engine into extension
- [ ] Token counter widget
- [ ] Extension settings popup

### Phase 5: Launch (Week 9-10)
- [ ] Landing page
- [ ] Documentation
- [ ] Chrome Web Store submission
- [ ] Beta testing
- [ ] Analytics integration
