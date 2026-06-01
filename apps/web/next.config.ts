import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apple requires the apple-app-site-association file to be served as
        // application/json. It has no extension, so the static-file default is
        // application/octet-stream — override it here. (Only effective once the
        // iOS app declares Associated Domains, but harmless to serve correctly now.)
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
