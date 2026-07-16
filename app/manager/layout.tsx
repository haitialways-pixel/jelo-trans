import type { Metadata, Viewport } from 'next'
import { ManagerPwaRegister } from '@/components/manager/ManagerPwaRegister'

/**
 * Shared shell for the entire /manager tree (login + authenticated dash).
 * PWA manifest / theme / service-worker registration live here so both
 * /manager/login and the dashboard are installable as "VIP Manager".
 */
export const metadata: Metadata = {
  applicationName: 'VIP Manager',
  title: {
    default: 'Imperial Odyssey Manager',
    template: '%s · VIP Manager',
  },
  description:
    'Dispatcher and owner operations console for Imperial Odyssey luxury chauffeur service.',
  manifest: '/manager/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VIP Manager',
  },
  icons: {
    icon: [
      { url: '/manager/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/manager/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/manager/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d4af37' },
    { media: '(prefers-color-scheme: dark)', color: '#2b2625' },
  ],
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function ManagerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ManagerPwaRegister />
    </>
  )
}
