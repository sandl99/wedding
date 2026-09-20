import type { Metadata } from "next";
import "./globals.css";
import { weddingMetadata } from "./wedding-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return weddingMetadata("/", "vi");
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
