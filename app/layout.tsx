import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/shared/ClientProviders";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: true,
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://phalotrans.com"),
  title: "Imperial Odyssey | Premium Orlando Chauffeur Service",
  description: "Luxury limousine and chauffeur service in Orlando, Florida. MCO airport transfers, hourly rentals, weddings, and corporate events. Professional chauffeurs available 24/7.",
  icons: { icon: "/favicon.ico" },
};

export const runtime = 'edge'

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} antialiased scroll-smooth`}>
      <body className="bg-background text-on-surface min-h-screen font-sans">
        {children}
        <ClientProviders />
      </body>
    </html>
  );
}