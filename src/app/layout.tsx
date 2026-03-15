import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Token Optimizer - Prompt Engineering Tool",
  description:
    "Optimize your LLM prompts: save tokens (quantitative) and improve output quality (qualitative).",
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
