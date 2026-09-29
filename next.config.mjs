/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Pre-sized WebP files; OpenNext on Cloudflare does not resize via /_next/image.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Always revalidate the manager service worker so staff get SW updates.
        source: '/manager/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
      {
        source: '/manager/manifest.webmanifest',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig