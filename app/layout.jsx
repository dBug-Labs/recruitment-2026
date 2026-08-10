import { Anton, Oswald, Barlow } from "next/font/google";
import "./globals.css";

const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-oswald", display: "swap" });
const barlow = Barlow({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-barlow", display: "swap" });

export const metadata = {
  title: "dBug Labs — Brand New Day | Recruitments '26",
  description: "Every great developer starts with one decision. dBug Labs Recruitments 2026 are now open.",
};

// Next.js only emits the responsive viewport meta tag when a route exports one.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08050a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${anton.variable} ${oswald.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
