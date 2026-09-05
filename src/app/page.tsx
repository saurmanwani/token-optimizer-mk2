import Link from "next/link";
import { runBenchmark } from "@/lib/contextproof";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function Home() {
  const report = runBenchmark();
  const categories = Object.entries(report.categoryDistribution);
  const failures = report.cases.filter((item) => !item.passed);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center font-bold text-white text-xs">
              CP
            </div>
            <div>
              <h1 className="text-lg font-semibold">ContextProof</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Measure context waste. Prove a policy before enabling it.
              </p>
            </div>
          </div>
          <span className="text-xs border border-[var(--border)] rounded-full px-3 py-1.5 text-[var(--text-secondary)]">
            Local-first · synthetic-v1
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)] font-semibold">
              Agent context observability
            </p>
            <h2 className="text-4xl lg:text-5xl font-bold leading-tight max-w-3xl">
              Before you compress context, prove what the model can afford to forget.
            </h2>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              ContextProof profiles agent traces, recommends conservative policies,
              and checks every intervention against explicit evidence-preservation
              invariants.
            </p>
            <div className="flex flex-wrap gap-3">
              <code className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm">
                npm run contextproof -- inspect examples/sample-trace.json
              </code>
              <Link
                href="/api/report"
                className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2.5 text-sm text-white font-medium"
              >
                Download benchmark JSON
              </Link>
            </div>
          </div>

          <aside className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-6">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-4">
              Evidence contract
            </p>
            <div className="space-y-4 text-sm">
              {[
                ["Measure before mutating", "Inspection and recommendations are advisory."],
                ["Recover exact bytes", "Cleared outputs use SHA-256 recovery handles."],
                ["Count net economics", "Savings are separate from model quality claims."],
                ["Publish limitations", "Synthetic fixtures are never called real-agent proof."],
              ].map(([title, body]) => (
                <div key={title}>
                  <p className="font-medium">{title}</p>
                  <p className="text-[var(--text-muted)] mt-1">{body}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Bundled deterministic benchmark
              </p>
              <h2 className="text-2xl font-semibold mt-1">
                Stale tool-output policy
              </h2>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              [`${report.passedCases}/${report.generatedCases}`, "Cases passed"],
              [`${report.invariantRetentionPercent}%`, "Invariant retention"],
              [`${report.byteExactRecoveryPercent}%`, "Exact recovery"],
              [`${report.savedPercent}%`, "Active tokens removed"],
              [`${report.meanProcessingMs} ms`, "Mean policy time"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4"
              >
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{label}</p>
              </div>
            ))}
          </div>

          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex justify-between text-sm mb-3">
              <span>{formatNumber(report.originalTokens)} original tokens</span>
              <span className="text-[var(--green)]">
                {formatNumber(report.savedTokens)} removed from active context
              </span>
            </div>
            <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full"
                style={{ width: `${100 - report.savedPercent}%` }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3">
              Resulting active context: {formatNumber(report.resultingTokens)} tokens.
              Removed evidence remains available through local recovery records.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Fixture distribution</h2>
            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
              {categories.map(([category, count]) => (
                <div
                  key={category}
                  className="flex justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b last:border-b-0 border-[var(--border)]"
                >
                  <span className="text-sm">{category.replaceAll("_", " ")}</span>
                  <span className="text-sm font-mono text-[var(--text-secondary)]">
                    {count} cases
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">Honest limitations</h2>
            <div className="space-y-3">
              {report.limitations.map((limitation) => (
                <div
                  key={limitation}
                  className="flex gap-3 text-sm text-[var(--text-secondary)]"
                >
                  <span className="w-5 h-5 shrink-0 rounded-full border border-[var(--border)] flex items-center justify-center text-[10px]">
                    !
                  </span>
                  <p>{limitation}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Baseline comparison
            </p>
            <h2 className="text-xl font-semibold mt-1">
              Savings are not safety
            </h2>
          </div>
          <div className="border border-[var(--border)] rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Method</th>
                  <th className="text-right font-medium px-4 py-3">Saved</th>
                  <th className="text-right font-medium px-4 py-3">Evidence retained</th>
                  <th className="text-left font-medium px-4 py-3">Recovery</th>
                </tr>
              </thead>
              <tbody>
                {report.baselines.map((baseline) => (
                  <tr
                    key={baseline.id}
                    className="bg-[var(--bg-secondary)] border-t border-[var(--border)]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{baseline.label}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {baseline.notes}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {baseline.savedPercent}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {baseline.invariantRetentionPercent}%
                    </td>
                    <td className="px-4 py-3">
                      {baseline.recoverable ? "Byte-exact / full" : "None"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Failure register</h2>
          <div
            className={`border rounded-xl p-5 ${
              failures.length === 0
                ? "border-[var(--green)]/30 bg-[var(--green)]/5"
                : "border-red-500/30 bg-red-500/5"
            }`}
          >
            {failures.length === 0 ? (
              <p className="text-sm">
                No bundled invariant failures. This does not establish downstream
                model quality; real-agent replay is the next evidence gate.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {failures.map((failure) => (
                  <li key={failure.fixtureId}>
                    {failure.fixtureId}: {failure.failures.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-5">
        <div className="max-w-7xl mx-auto text-xs text-[var(--text-muted)] flex flex-wrap justify-between gap-2">
          <span>ContextProof prototype</span>
          <span>Local inspection · advisory policies · public evidence contract</span>
        </div>
      </footer>
    </div>
  );
}
