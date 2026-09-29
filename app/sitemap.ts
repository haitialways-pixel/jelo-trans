import type { MetadataRoute } from 'next'
import { BRAND_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/fleet', '/services', '/about', '/corporate', '/contact', '/book', '/manage-booking', '/privacy', '/terms']
  const now = new Date()
  return paths.map((path) => ({
    url: `${BRAND_URL}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency: path === '/' || path === '/book' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }))
}
