import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "klebold.xyz",
  description: "personal terminal",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  // не запрещаем зум — доступность
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={mono.variable} suppressHydrationWarning>
      <head>
        {/* Применяем сохранённую тему ДО отрисовки — иначе фон (canvas) успевает
            прочитать акцент по умолчанию раньше, чем тема восстановится. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}})();",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
