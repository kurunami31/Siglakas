import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep rendering explicit and predictable for a live-data app.
  // `cacheComponents` is intentionally left off: nearly every page is dynamic.
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [64, 128, 256, 384, 512, 768, 1024, 1280, 1920],
    remotePatterns: [
      // Uploaded crew logos are served from Supabase Storage once sheets mode
      // is live; bundled logos stay local under /public/logos.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
