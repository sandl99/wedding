import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lâm San & Thu Trang — Wedding Invitation",
  description:
    "We would be honoured by your presence at the wedding of Lâm San and Thu Trang — 10:45 AM, Wednesday 30 September 2026 at Song Lam Palace Restaurant, Cửa Lò, Nghệ An.",
};

export default function EnglishHome() {
  return (
    <iframe
      className="wedding-mirror-frame"
      src="/mirror/en/index.html"
      title="Lâm San and Thu Trang's wedding invitation"
      allow="autoplay"
    />
  );
}
