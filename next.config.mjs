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
      "img-src 'self' data: blob: https://i.scdn.co",
      "font-src 'self' data:",
      "connect-src 'self'",
      // Аудио (радио/Audius) стримится с внешних https-хостов через <audio>.
      // Точечное послабление ТОЛЬКО для медиа — скрипты/connect остаются строгими.
      "media-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    // /throw — жест-бросок: нужна камера (MediaPipe HandLandmarker) и WASM,
    // модель и wasm-раннер самохостятся в /public/mediapipe (без внешних
    // хостов, CSP остаётся строгим). Переопределяем только два ключа —
    // остальные заголовки ниже (HSTS, X-Frame-Options и т.д.) достаются
    // этому пути от общего блока, т.к. Next при совпадении неск. блоков
    // на одном пути применяет все, а при совпадении ключа — берёт последний.
    const throwCsp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isProd ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
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
      {
        source: "/throw/:path*",
        headers: [
          { key: "Content-Security-Policy", value: throwCsp },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
