import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Plaid-hosted institution and merchant logos
      { protocol: "https", hostname: "plaid-merchant-logos.plaid.com" },
      { protocol: "https", hostname: "plaid-category-icons.plaid.com" },
      { protocol: "https", hostname: "plaid-counterparty-logos.plaid.com" },
    ],
  },
};

export default nextConfig;
