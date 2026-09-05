import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContextProof — Agent Context Observability",
  description:
    "Measure coding-agent context waste and verify policies before enabling them.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
