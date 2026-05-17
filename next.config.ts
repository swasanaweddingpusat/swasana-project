import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
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
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },
};

export default nextConfig;
