import type { MetadataRoute } from 'next'
import { BRAND_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/manager', '/api/'] },
    ],
    sitemap: `${BRAND_URL}/sitemap.xml`,
    host: BRAND_URL,
  }
}
