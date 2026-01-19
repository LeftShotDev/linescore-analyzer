import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NHL Linescore Period Analyzer",
  description: "Analyze period-by-period NHL game performance with natural language queries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
