import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lâm San & Thu Trang — Wedding Invitation",
  description:
    "We would be honoured by your presence at the wedding of Lâm San and Thu Trang — 10:45 AM, Wednesday 30 September 2026 at Song Lam Palace Restaurant, Cửa Lò, Nghệ An.",
};

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

export default async function EnglishGuestInvitation({
  params,
}: {
  params: Promise<{ guest: string }>;
}) {
  const { guest: token } = await params;
  const guestName = decodeGuestToken(token);
  const source = guestName
    ? `/mirror/en/index.html?guest=${encodeURIComponent(guestName)}`
    : "/mirror/en/index.html";

  return (
    <iframe
      className="wedding-mirror-frame"
      src={source}
      title={guestName ? `Wedding invitation for ${guestName}` : "Lâm San and Thu Trang's wedding invitation"}
      allow="autoplay"
    />
  );
}
