import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stellar Pulse — Prediction Market on Stellar",
  description:
    "Predict. Win or Lose — You Always Earn. Decentralized prediction market on Stellar with near-zero fees and 5-second finality.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://stellarpulse.app"
  ),
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/logo.png",
  },
  openGraph: {
    title: "Stellar Pulse — Prediction Market on Stellar",
    description:
      "Predict. Win or Lose — You Always Earn. Decentralized prediction market with near-zero fees.",
    images: ["/logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stellar Pulse — Prediction Market on Stellar",
    description:
      "Predict. Win or Lose — You Always Earn. Decentralized prediction market with near-zero fees.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen flex flex-col bg-surface text-slate-100 antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
