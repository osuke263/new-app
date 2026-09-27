import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tempo | 自分のペースで、前へ",
  description: "行動科学を参考に、最初の一歩と余白をつくるパーソナルプランナー。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
