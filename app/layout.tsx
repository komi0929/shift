import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shift. — シフト収集",
  description: "摩擦レスなシフト希望収集アプリケーション。ログイン不要で直感的にシフトを提出できます。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
