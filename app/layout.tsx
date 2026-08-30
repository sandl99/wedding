import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const title = "Lâm San & Thu Trang — Thiệp cưới";
  const description = "Trân trọng kính mời bạn đến chung vui trong ngày cưới của Lâm San và Thu Trang — 10:45 thứ Tư, 30.09.2026 tại Nhà hàng Sông Lam Palace, Cửa Lò, Nghệ An.";
  const socialImage = new URL("/og.jpg", baseUrl).toString();

  return {
    metadataBase: baseUrl,
    title,
    description,
    icons: { icon: "/favicon.png" },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "vi_VN",
      images: [{ url: socialImage, width: 1731, height: 909, alt: "Thiệp cưới Lâm San và Thu Trang" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
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
