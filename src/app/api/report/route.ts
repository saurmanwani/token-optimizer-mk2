import { NextResponse } from "next/server";
import { runBenchmark } from "@/lib/contextproof";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(runBenchmark(), {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Content-Disposition": 'inline; filename="contextproof-benchmark.json"',
      "X-ContextProof-Data": "synthetic-v1",
    },
  });
}
