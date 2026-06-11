import type { NextConfig } from "next";

// Content-Security-Policy — defense in depth against XSS. Each `*-src` directive lists
// the ONLY origins from which that asset type is allowed to load. If a future attacker
// ever injected a <script src="evil.com/x.js">, the browser would refuse to load it
// because evil.com isn't whitelisted here.
//
// Why each origin is allowed:
//   - 'self'                          our own bundles / API routes
//   - 'unsafe-inline' (script/style)  required by Next.js runtime + React inline styles
//                                     (nonce-based CSP would need middleware — future hardening)
//   - 'unsafe-eval' (DEV ONLY)        React + Turbopack HMR need eval() for hot-reload.
//                                     STRIPPED in production builds.
//   - js.stripe.com                   Stripe Elements (browser SDK)
//   - hooks.stripe.com                Stripe 3DS confirmation iframe
//   - api.stripe.com                  client-side fetch from the SDK
//   - *.supabase.co (+ wss)           browser Supabase client (REST + Realtime)
//   - data:, blob:, https:            images can be inlined or loaded from any HTTPS host
const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
  : "script-src 'self' 'unsafe-inline' https://js.stripe.com";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Baseline security headers applied to every route.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Hide the floating Next.js Dev Tools indicator (the small "N" bottom-left in dev).
  // No effect on production. Set back to true if you want it back for debugging.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
