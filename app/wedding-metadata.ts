import type { Metadata } from "next";
import { headers } from "next/headers";

const copy = {
  vi: {
    title: "Lâm San & Thu Trang — Thiệp cưới",
    description:
      "Trân trọng kính mời bạn đến chung vui trong ngày cưới của Lâm San và Thu Trang — 10:45 thứ Tư, 30.09.2026 tại Nhà hàng Sông Lam Palace, Cửa Lò, Nghệ An.",
    locale: "vi_VN",
    imageAlt: "Thiệp cưới Lâm San và Thu Trang",
  },
  en: {
    title: "Lâm San & Thu Trang — Wedding Invitation",
    description:
      "We would be honoured by your presence at the wedding of Lâm San and Thu Trang — 10:45 AM, Wednesday 30 September 2026 at Song Lam Palace Restaurant, Cửa Lò, Nghệ An.",
    locale: "en_US",
    imageAlt: "Wedding invitation for Lâm San and Thu Trang",
  },
} as const;

export async function weddingMetadata(
  pathname: string,
  language: keyof typeof copy,
): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const pageUrl = new URL(pathname, baseUrl);
  const socialImage = new URL("/og.jpg", baseUrl).toString();
  const { title, description, locale, imageAlt } = copy[language];

  return {
    metadataBase: baseUrl,
    title,
    description,
    icons: { icon: "/favicon.png" },
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      type: "website",
      locale,
      url: pageUrl,
      images: [
        {
          url: socialImage,
          type: "image/jpeg",
          width: 1731,
          height: 909,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}
