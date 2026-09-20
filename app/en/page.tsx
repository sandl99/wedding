import type { Metadata } from "next";
import { weddingMetadata } from "../wedding-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return weddingMetadata("/en", "en");
}

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
