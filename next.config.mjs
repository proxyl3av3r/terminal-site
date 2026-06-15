/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Компактная self-contained сборка для Docker (.next/standalone/server.js).
  output: "standalone",
  experimental: {
    // argon2 — нативный модуль, его нельзя бандлить в серверный chunk
    serverComponentsExternalPackages: ["argon2"],
  },
  async headers() {
    // Базовые заголовки безопасности на все маршруты.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
