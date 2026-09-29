import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/shared/ClientProviders";
import { LocalBusinessJsonLd } from "@/components/shared/JsonLd";
import {
  BRAND_NAME,
  BRAND_PHONE_DISPLAY,
  BRAND_URL,
  OG_IMAGE,
} from "@/lib/site";

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
  metadataBase: new URL(BRAND_URL),
  title: {
    default: `${BRAND_NAME} | Orlando Chauffeur Service`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Luxury chauffeur service in Orlando, Florida. MCO airport transfers, theme parks, Port Canaveral, and hourly executive charters. Professional chauffeurs available 24/7.",
  applicationName: BRAND_NAME,
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BRAND_URL,
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} | Orlando Chauffeur Service`,
    description:
      "White-glove chauffeur service for MCO, the theme parks, the convention center, and Port Canaveral.",
    images: [{ url: OG_IMAGE, width: 1344, height: 768, alt: `${BRAND_NAME} fleet` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Orlando Chauffeur Service`,
    description: `Call ${BRAND_PHONE_DISPLAY} for 24/7 chauffeur service in Central Florida.`,
    images: [OG_IMAGE],
  },
  alternates: { canonical: BRAND_URL },
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} antialiased scroll-smooth`}>
      <body className="bg-background text-on-surface min-h-screen font-sans overflow-x-hidden">
        <LocalBusinessJsonLd />
        {children}
        <ClientProviders />
      </body>
    </html>
  );
}
