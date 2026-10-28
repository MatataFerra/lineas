import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Portadas verificadas en catálogos (src/lib/catalog/books.ts).
    remotePatterns: [
      // Google Books identifica la imagen por query string (?id=…&img=1&zoom=1).
      { protocol: "https", hostname: "books.google.com", pathname: "/books/content" },
      { protocol: "https", hostname: "covers.openlibrary.org", pathname: "/b/id/**", search: "" },
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
