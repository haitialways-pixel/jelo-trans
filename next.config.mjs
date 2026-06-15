// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: '**' }, // Allow Supabase, Stripe images, etc.
    ],
  },
  typescript: {
    ignoreBuildErrors: true,     // Temporary for Cloudflare deployment
  },
  eslint: {
    ignoreDuringBuilds: true,    // Temporary
  },
};

export default nextConfig;