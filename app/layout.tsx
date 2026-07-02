import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/shared/ClientProviders";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: true,
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Phalo Transportation | Premium Orlando Chauffeur Service",
  description: "Luxury limousine and chauffeur service in Orlando, Florida. MCO airport transfers, hourly rentals, weddings, and corporate events. Professional chauffeurs available 24/7.",
  icons: { icon: "/favicon.ico" },
};

export const runtime = 'edge'

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${playfair.variable} antialiased`}>
      <body className="bg-background text-on-surface">
        {children}
        <ClientProviders />
      </body>
    </html>
  );
}