import type { NextConfig } from "next";

/**
 * Conservative security headers. No Content-Security-Policy is set here yet
 * because AdSense and the PeerJS broker both need allowances that depend on
 * deployment configuration — see docs/DEPLOYMENT.md before adding one.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    // Next.js already sets immutable caching for its own static output.
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
