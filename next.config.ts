import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build output for Docker/Dokploy — bundles only the files the
  // server needs into .next/standalone, so the runtime image stays small.
  output: "standalone",
  cacheComponents: true,
  serverExternalPackages: ["sharp"],
  allowedDevOrigins: ["192.168.1.4", "100.108.85.60"],
  async headers() {
    // Client agreement is a public, status-sensitive flow (validate / sign /
    // render-po). Without no-store, an intermediate HTTP/CDN cache can serve a
    // stale "Signed" response to some browsers after the status has changed,
    // causing a false "Agreement sudah ditandatangani". Force every response on
    // this path (and its API) to be revalidated on each request.
    const noStore = [
      { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
      { key: "Pragma", value: "no-cache" },
    ];
    return [
      { source: "/api/client-agreement/:path*", headers: noStore },
      { source: "/client-agreement", headers: noStore },
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // MinIO on Railway — wildcard covers *.up.railway.app and subdomains
      {
        protocol: "https",
        hostname: "**.up.railway.app",
      },
      {
        protocol: "https",
        hostname: "**.railway.app",
      },
    ],
  },
};

export default nextConfig;
