import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ContextInspection,
  PolicyRecommendation,
} from "./types";
import type { LoadedLocalSession } from "./session-adapters";

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED_OPENAI_KEY]"],
  [/\b(?:ghp|github_pat)_[A-Za-z0-9_]{12,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/\bAKIA[A-Z0-9]{16}\b/g, "[REDACTED_AWS_KEY]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi, "Bearer [REDACTED]"],
  [
    /\b(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["']?[^\s"',;]{6,}/gi,
    "$1=[REDACTED]",
  ],
  [
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g,
    "[REDACTED_JWT]",
  ],
];

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    value
  );
}

function escapeHtml(value: string): string {
  return redactSecrets(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function writeLocalReport(
  loaded: LoadedLocalSession,
  inspection: ContextInspection,
  recommendations: PolicyRecommendation[],
  workspace = process.cwd()
): Promise<string> {
  const reportDirectory = path.join(workspace, ".contextproof", "reports");
  await mkdir(reportDirectory, { recursive: true, mode: 0o700 });
  const filename = `${loaded.session.agent}-${loaded.session.id.replace(
    /[^A-Za-z0-9._-]/g,
    "-"
  )}.html`;
  const outputPath = path.join(reportDirectory, filename);
  const maxTokens = Math.max(1, ...inspection.categories.map((item) => item.tokens));

  const categoryRows = inspection.categories
    .map(
      (category) => `
      <div class="row">
        <div><strong>${escapeHtml(category.category.replaceAll("_", " "))}</strong><small>${category.events} events · ${category.sharePercent}%</small></div>
        <div class="bar"><span style="width:${Math.max(2, (category.tokens / maxTokens) * 100)}%"></span></div>
        <code>${category.tokens.toLocaleString()}</code>
      </div>`
    )
    .join("");
  const recommendationRows = recommendations
    .map(
      (item) => `
      <article>
        <div class="badge">${escapeHtml(item.priority)}</div>
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(
          item.rationale
        )}</p><small>${escapeHtml(item.safety)} · ${item.estimatedTokensAffected.toLocaleString()} tokens affected</small></div>
      </article>`
    )
    .join("");
  const warnings = inspection.warnings
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ContextProof · ${escapeHtml(loaded.session.id)}</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#090909;color:#ededed}
*{box-sizing:border-box}body{margin:0}.wrap{max-width:1050px;margin:auto;padding:40px 24px 72px}
header{border-bottom:1px solid #292929;padding-bottom:24px;margin-bottom:32px}h1{font-size:34px;margin:8px 0}h2{font-size:20px;margin:36px 0 14px}
p{color:#aaa;line-height:1.55}.eyebrow,small{font-size:12px;color:#818181}.eyebrow{text-transform:uppercase;letter-spacing:.14em;color:#8b88ff}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat,.panel{border:1px solid #292929;background:#141414;border-radius:12px;padding:18px}
.stat strong{display:block;font-size:25px;margin-bottom:5px}.meta{display:flex;flex-wrap:wrap;gap:8px;color:#999;font-size:13px}.meta span{border:1px solid #292929;border-radius:999px;padding:6px 10px}
.row{display:grid;grid-template-columns:210px 1fr 80px;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid #242424}.row:last-child{border:0}.row strong,.row small{display:block;text-transform:capitalize}.row small{margin-top:4px}
.bar{height:8px;background:#242424;border-radius:9px;overflow:hidden}.bar span{display:block;height:100%;background:#6b68f5;border-radius:9px}code{text-align:right}
article{display:grid;grid-template-columns:70px 1fr;gap:14px;padding:16px 0;border-bottom:1px solid #242424}article:last-child{border:0}article p{margin:5px 0}.badge{font-size:11px;text-transform:uppercase;color:#aaa;padding-top:2px}
.warning{border:1px solid #5c5122;background:#19170d;border-radius:12px;padding:14px 18px}.warning li{margin:7px 0;color:#c9bd84}
footer{margin-top:42px;color:#747474;font-size:12px}@media(max-width:720px){.grid{grid-template-columns:1fr 1fr}.row{grid-template-columns:1fr 70px}.bar{grid-row:2;grid-column:1/3}article{grid-template-columns:1fr}.badge{padding:0}}
</style>
</head>
<body><main class="wrap">
<header><div class="eyebrow">Local agent context report</div><h1>ContextProof</h1>
<p>Selected ${escapeHtml(loaded.session.agent)} session <strong>${escapeHtml(
    loaded.session.id
  )}</strong>. This report contains aggregate metadata only; raw message and tool content is not rendered.</p>
<div class="meta"><span>${escapeHtml(loaded.formatVersion)}</span><span>${new Date(
    loaded.session.modifiedAt
  ).toLocaleString()}</span><span>${loaded.session.bytes.toLocaleString()} source bytes</span><span>${loaded.skippedRecords} unrecognized or non-content records</span></div></header>
<section class="grid">
<div class="stat"><strong>${inspection.totalTokens.toLocaleString()}</strong><small>Active tokens</small></div>
<div class="stat"><strong>${inspection.eventCount}</strong><small>Normalized events</small></div>
<div class="stat"><strong>${inspection.repeatedSharePercent}%</strong><small>Exact repetition</small></div>
<div class="stat"><strong>${inspection.cacheablePrefixTokens.toLocaleString()}</strong><small>Cacheable prefix</small></div>
</section>
<h2>Context bill of materials</h2><section class="panel">${categoryRows}</section>
<h2>Recommended policies</h2><section class="panel">${recommendationRows}</section>
${warnings ? `<h2>Warnings</h2><ul class="warning">${warnings}</ul>` : ""}
<footer>Generated locally at ${escapeHtml(
    inspection.generatedAt
  )}. Model: ${escapeHtml(inspection.model.displayName)} · ${
    inspection.model.accuracyLabel
  }. No trace content was uploaded.</footer>
</main></body></html>`;

  await writeFile(outputPath, html, { encoding: "utf8", mode: 0o600 });
  return outputPath;
}

export function openLocalReport(reportPath: string): Promise<void> {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["/c", "start", "", reportPath]
      : [reportPath];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
