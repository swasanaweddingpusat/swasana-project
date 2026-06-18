import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build output for Docker/Dokploy — bundles only the files the
  // server needs into .next/standalone, so the runtime image stays small.
  output: "standalone",
  cacheComponents: true,
  allowedDevOrigins: ["192.168.1.4"],
  async redirects() {
    return [
      {
        source: "/dashboard/my-team",
        destination: "/dashboard/groups",
        permanent: true,
      },
      {
        source: "/dashboard/my-team/:groupId",
        destination: "/dashboard/groups/:groupId",
        permanent: true,
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
