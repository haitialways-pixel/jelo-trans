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

export default nextConfig;