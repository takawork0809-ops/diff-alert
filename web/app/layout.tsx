import type { Metadata } from "next";
import { Noto_Sans_JP, Inter } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "差益レーダー | 仕入れチャンスを、見逃すな。",
  description:
    "Amazon×楽天の差益を毎朝自動監視。手数料込みの純利益がプラスになった瞬間、メールでお知らせ。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${noto.variable} ${inter.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
