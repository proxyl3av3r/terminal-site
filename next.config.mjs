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
    const isProd = process.env.NODE_ENV === "production";
    // Content-Security-Policy. 'unsafe-eval' нужен только dev-режиму (HMR).
    // Шрифты self-hosted (next/font), QR — data:, сеть — только свой origin.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    // Базовые заголовки безопасности на все маршруты.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
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
