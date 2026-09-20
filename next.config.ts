import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Open Graph metadata in <head> for every crawler. Meta uses several
  // user agents, and some are not included in Next.js's default bot list.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
