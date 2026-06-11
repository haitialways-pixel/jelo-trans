import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ChatWidgetGate } from "@/components/chatbot/ChatWidgetGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Phalo Transportation | Premium Orlando Chauffeur Service",
  description: "Luxury limousine and chauffeur service in Orlando, Florida. MCO airport transfers, hourly rentals, weddings, and corporate events. Professional chauffeurs available 24/7.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${outfit.variable} antialiased`}>
      <body className="bg-[#0a0a0a] text-white">
        {children}
        <ChatWidgetGate />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
