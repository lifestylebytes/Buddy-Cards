import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buddy Cards",
  description: "밑줄 친 원서 사진으로 나만의 단어장을 만들어요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
