/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: '**' },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig