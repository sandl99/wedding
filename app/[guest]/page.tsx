import type { Metadata } from "next";
import { weddingMetadata } from "../wedding-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ guest: string }>;
}): Promise<Metadata> {
  const { guest } = await params;
  const pathname = /^[A-Za-z0-9_-]{2,160}$/.test(guest) ? `/${guest}` : "/";
  return weddingMetadata(pathname, "vi");
}

function decodeGuestToken(token: string): string {
  if (!/^[A-Za-z0-9_-]{2,160}$/.test(token)) return "";

  try {
    const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return Array.from(decoded.normalize("NFC").replace(/\s+/g, " ").trim())
      .slice(0, 60)
      .join("");
  } catch {
    return "";
  }
}

export default async function GuestInvitation({
  params,
}: {
  params: Promise<{ guest: string }>;
}) {
  const { guest: token } = await params;
  const guestName = decodeGuestToken(token);
  const source = guestName
    ? `/mirror/index.html?guest=${encodeURIComponent(guestName)}`
    : "/mirror/index.html";

  return (
    <iframe
      className="wedding-mirror-frame"
      src={source}
      title={guestName ? `Thiệp cưới gửi ${guestName}` : "Thiệp cưới Lâm San và Thu Trang"}
      allow="autoplay"
    />
  );
}
