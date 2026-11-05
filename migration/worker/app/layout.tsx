import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "تعمیران | انتقال به سایت‌ساز",
  description: "انتقال کنترل‌شده تعمیران با حفظ منوها و قواعد عملیاتی",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="stylesheet" href="/assets/app-D2PBnnyi.css" />
        <link rel="stylesheet" href="/assets/beta7-ui.css" />
        <link rel="stylesheet" href="/assets/index-B_SWlkkz.css" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
