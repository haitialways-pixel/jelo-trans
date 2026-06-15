/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Helpful for some deployments
  images: {
    remotePatterns: [
      { hostname: 'supabase.co' },
      { hostname: '**.vercel.app' }, // or your domain
      // add others as needed
    ],
  },
  // If using Edge runtime for some routes:
  // experimental: { runtime: 'edge' } // careful with this
};
const nextConfig = {
  // ... your existing config
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};
const nextConfig = {
  // ... your existing config
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;