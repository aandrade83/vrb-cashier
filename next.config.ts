import type { NextConfig } from "next";

const sharedHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const BASE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.public.blob.vercel-storage.com",
  "connect-src 'self'",
  "font-src 'self'",
  "worker-src 'self' blob:",
].join("; ");

// /master/* and all other non-cashier routes — iframe embedding blocked
const restrictiveHeaders = [
  ...sharedHeaders,
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: BASE_CSP },
];

// /[slug]/[token]/* cashier tenant routes — embeddable from any origin
const cashierHeaders = [
  ...sharedHeaders,
  // X-Frame-Options intentionally omitted; frame-ancestors in CSP takes precedence in modern browsers
  { key: "Content-Security-Policy", value: `${BASE_CSP}; frame-ancestors *` },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      // Catch-all: /api/*, /, and anything else — restrictive
      { source: "/(.*)", headers: restrictiveHeaders },
      // Master admin — explicit restrictive (overrides catch-all for /master/*)
      { source: "/master/:path*", headers: restrictiveHeaders },
      // Cashier tenant routes — allow iframe embedding from any origin.
      // (?!master) prevents /master/... from matching this rule.
      // Next.js applies all matching rules; last definition per header key wins,
      // so this overrides the catch-all's X-Frame-Options and CSP for cashier routes.
      { source: "/:slug((?!master)[^/]+)/:token/:path*", headers: cashierHeaders },
    ];
  },
};

export default nextConfig;
