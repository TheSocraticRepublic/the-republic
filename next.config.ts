import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'openparliament.ca' }],
  },
  // The PDF fonts in src/lib/pdf/fonts/ are read from disk at render time via
  // path.join(process.cwd(), ...), not imported as modules — so Next's module
  // tracing cannot see them and would prune them from the serverless bundle.
  // Without this, both export routes throw at Font load and return 500, which
  // is the exact failure the vendoring was meant to end.
  outputFileTracingIncludes: {
    "/api/campaign/export": ["./src/lib/pdf/fonts/**"],
    "/api/lever/export": ["./src/lib/pdf/fonts/**"],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
