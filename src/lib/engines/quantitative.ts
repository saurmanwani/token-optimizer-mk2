import { Change, OptimizationResult } from "../types";
import { countTokens } from "../tokenizer";

interface ProtectedZone {
  start: number;
  end: number;
}

function findProtectedZones(text: string): ProtectedZone[] {
  const zones: ProtectedZone[] = [];
  let match;

  // Code blocks: ```...```
  const codeBlockRegex = /```[\s\S]*?```/g;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    zones.push({ start: match.index, end: match.index + match[0].length });
  }

  // Inline code: `...`
  const inlineCodeRegex = /`[^`]+`/g;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    if (!zones.some((z) => match!.index >= z.start && match!.index < z.end)) {
      zones.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Quoted strings: "..." (3+ chars to avoid false positives)
  const quotedRegex = /"[^"]{3,}"/g;
  while ((match = quotedRegex.exec(text)) !== null) {
    if (!zones.some((z) => match!.index >= z.start && match!.index < z.end)) {
      zones.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // XML content tags
  const xmlContentRegex =
    /<(example|content|data|input|output|document|context)>([\s\S]*?)<\/\1>/gi;
  while ((match = xmlContentRegex.exec(text)) !== null) {
    zones.push({ start: match.index, end: match.index + match[0].length });
  }

  // Example blocks: lines starting with "Example:", "Input:", etc.
  const exampleBlockRegex =
    /^(Example|Input|Output|Data|Content|Sample)\s*[:\-]\s*.+(?:\n(?![\n]|[A-Z][a-z]+\s*:).+)*/gim;
  while ((match = exampleBlockRegex.exec(text)) !== null) {
    if (!zones.some((z) => match!.index >= z.start && match!.index < z.end)) {
      zones.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  return zones.sort((a, b) => a.start - b.start);
}

function isInProtectedZone(
  text: string,
  matchStart: number,
  matchEnd: number,
  zones: ProtectedZone[]
): boolean {
  return zones.some((z) => matchStart >= z.start && matchEnd <= z.end);
}

interface Rule {
  pattern: RegExp;
  replacement: string;
  description: string;
  category: Change["category"];
}

// Rules are ordered: full phrases first, then individual words
// This avoids artifacts from partial matches
const RULES: Rule[] = [
  // --- FULL APPRECIATION SENTENCES (match first, most specific) ---
  // Don't consume the preceding period -- it belongs to the previous sentence
  {
    pattern:
      /\s*Thank you( so much| very much)? for your (help|time|assistance)[^.!]*[.!]?\s*/gi,
    replacement: " ",
    description: "Removed appreciation sentence",
    category: "filler_removal",
  },
  {
    pattern: /,?\s*I (really |truly )?appreciate (it|your help|that)[^.!]*[.!]?\s*/gi,
    replacement: " ",
    description: "Removed appreciation sentence",
    category: "filler_removal",
  },
  {
    pattern: /\s*Thanks in advance[^.!]*[.!]?\s*/gi,
    replacement: " ",
    description: "Removed appreciation sentence",
    category: "filler_removal",
  },

  // --- VERBOSE OPENERS (full phrases, match before individual words) ---
  {
    pattern: /\bI was wondering if you could\s+/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bI would like you to\s+/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bI'd like you to\s+/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bI'd appreciate it if you could\s+/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bI want you to\s+/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bI need you to\s+/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bCould you (please\s+)?/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bCan you (please\s+)?/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bWould you (please\s+)?/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },
  {
    pattern: /\bWould you be so kind (as to\s+)?/gi,
    replacement: "",
    description: "Simplified verbose opener to direct instruction",
    category: "filler_removal",
  },

  // --- META-COMMENTARY ---
  {
    pattern: /\bThis is a prompt (for|to|that|where)\s+/gi,
    replacement: "",
    description: "Removed self-referential preamble",
    category: "filler_removal",
  },
  {
    pattern:
      /\bI'm (going to |gonna )?(ask|prompt|request)(ing)? (you to|that you)\s+/gi,
    replacement: "",
    description: "Removed self-referential preamble",
    category: "filler_removal",
  },

  // --- HEDGING LANGUAGE ---
  {
    pattern: /\bI think (that\s+)?/gi,
    replacement: "",
    description: "Removed hedging language",
    category: "filler_removal",
  },
  {
    pattern: /\bI believe (that\s+)?/gi,
    replacement: "",
    description: "Removed hedging language",
    category: "filler_removal",
  },
  {
    pattern: /\bmaybe you could\s+/gi,
    replacement: "",
    description: "Removed hedging language",
    category: "filler_removal",
  },
  {
    pattern: /\bperhaps you could\s+/gi,
    replacement: "",
    description: "Removed hedging language",
    category: "filler_removal",
  },

  // --- POLITENESS TOKENS (individual words) ---
  {
    pattern: /\b(please|kindly)\s+/gi,
    replacement: "",
    description: "Removed politeness filler",
    category: "filler_removal",
  },

  // --- GREETING / SIGN-OFF ---
  {
    pattern: /^(Hello|Hi|Hey|Dear [A-Za-z]+),?\s*/i,
    replacement: "",
    description: "Removed greeting",
    category: "filler_removal",
  },

  // --- REDUNDANT QUALIFIERS ---
  {
    pattern: /\b(very|extremely|quite|fairly|rather|somewhat)\s+/gi,
    replacement: "",
    description: "Removed redundant qualifier",
    category: "filler_removal",
  },
  {
    pattern: /\b(basically|essentially|fundamentally|literally)\s+/gi,
    replacement: "",
    description: "Removed filler word",
    category: "filler_removal",
  },
  {
    pattern: /\b(really)\s+(?!appreciate|need|want|important|critical)/gi,
    replacement: "",
    description: "Removed redundant qualifier",
    category: "filler_removal",
  },

  // --- CONVERSATIONAL FILLERS (careful: "so" only at clause start) ---
  {
    pattern: /(?:^|[.!?]\s+)(So|Well|Okay|Ok|Alright),?\s+/gm,
    replacement: "",
    description: "Removed conversational filler",
    category: "filler_removal",
  },
  {
    pattern: /\b(you know|I mean|like I said|as I mentioned|as you know)\s*,?\s*/gi,
    replacement: "",
    description: "Removed conversational filler",
    category: "filler_removal",
  },
  {
    pattern: /\b(um|uh|hmm|hm)\b,?\s*/gi,
    replacement: "",
    description: "Removed speech filler",
    category: "filler_removal",
  },

  // --- WORDY PHRASES -> CONCISE EQUIVALENTS ---
  {
    pattern: /\bin order to\b/gi,
    replacement: "to",
    description: "Simplified 'in order to' -> 'to'",
    category: "compression",
  },
  {
    pattern: /\bdue to the fact that\b/gi,
    replacement: "because",
    description: "Simplified 'due to the fact that' -> 'because'",
    category: "compression",
  },
  {
    pattern: /\bfor the purpose of\b/gi,
    replacement: "to",
    description: "Simplified 'for the purpose of' -> 'to'",
    category: "compression",
  },
  {
    pattern: /\bat this point in time\b/gi,
    replacement: "now",
    description: "Simplified 'at this point in time' -> 'now'",
    category: "compression",
  },
  {
    pattern: /\bin the event that\b/gi,
    replacement: "if",
    description: "Simplified 'in the event that' -> 'if'",
    category: "compression",
  },
  {
    pattern: /\bwith regard to\b/gi,
    replacement: "about",
    description: "Simplified 'with regard to' -> 'about'",
    category: "compression",
  },
  {
    pattern: /\bin spite of the fact that\b/gi,
    replacement: "although",
    description: "Simplified 'in spite of the fact that' -> 'although'",
    category: "compression",
  },
  {
    pattern: /\bmake sure (that\s+)?/gi,
    replacement: "ensure ",
    description: "Simplified 'make sure' -> 'ensure'",
    category: "compression",
  },
  {
    pattern: /\ba large number of\b/gi,
    replacement: "many",
    description: "Simplified 'a large number of' -> 'many'",
    category: "compression",
  },
  {
    pattern: /\bin the near future\b/gi,
    replacement: "soon",
    description: "Simplified 'in the near future' -> 'soon'",
    category: "compression",
  },
  {
    pattern: /\bhas the ability to\b/gi,
    replacement: "can",
    description: "Simplified 'has the ability to' -> 'can'",
    category: "compression",
  },
  {
    pattern: /\bis able to\b/gi,
    replacement: "can",
    description: "Simplified 'is able to' -> 'can'",
    category: "compression",
  },
];

function applyRules(text: string): { result: string; changes: Change[] } {
  const zones = findProtectedZones(text);
  const changes: Change[] = [];
  let result = text;

  for (const rule of RULES) {
    const newResult = result.replace(
      new RegExp(rule.pattern.source, rule.pattern.flags),
      (fullMatch, ...args) => {
        // Get the match offset -- it's the second to last argument
        const offset = args[args.length - 2] as number;

        if (isInProtectedZone(result, offset, offset + fullMatch.length, zones)) {
          return fullMatch;
        }

        const existing = changes.find(
          (c) => c.description === rule.description && c.category === rule.category
        );
        if (!existing) {
          changes.push({
            description: rule.description,
            technique: "Rule-based optimization",
            category: rule.category,
          });
        }

        return rule.replacement;
      }
    );

    result = newResult;
  }

  return { result, changes };
}

function postProcess(text: string): string {
  let result = text;

  // Collapse multiple spaces
  result = result.replace(/[ \t]{2,}/g, " ");

  // Fix space before punctuation
  result = result.replace(/ +([.,!?;:])/g, "$1");

  // Fix double punctuation
  result = result.replace(/([.!?])\s*([.!?])/g, "$1");

  // Fix capitalization after sentence-ending punctuation
  result = result.replace(/([.!?])\s+([a-z])/g, (_m, punct, letter) => {
    return `${punct} ${letter.toUpperCase()}`;
  });

  // Capitalize first character of the whole text
  result = result.replace(/^\s*[a-z]/, (m) => m.toUpperCase());

  // Collapse 3+ newlines into 2
  result = result.replace(/\n{3,}/g, "\n\n");

  // Trim lines
  result = result
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // Trim overall
  result = result.trim();

  // Remove leading punctuation artifacts
  result = result.replace(/^[,;]\s*/, "");

  return result;
}

export function optimizeQuantitative(prompt: string): OptimizationResult {
  const beforeTokens = countTokens(prompt);

  const { result: afterRules, changes } = applyRules(prompt);
  const optimized = postProcess(afterRules);

  const afterTokens = countTokens(optimized);
  const saved = beforeTokens - afterTokens;

  return {
    optimizedPrompt: optimized,
    changes,
    tokenStats: {
      before: beforeTokens,
      after: afterTokens,
      saved,
      percentSaved:
        beforeTokens > 0 ? Math.round((saved / beforeTokens) * 100) : 0,
    },
  };
}
