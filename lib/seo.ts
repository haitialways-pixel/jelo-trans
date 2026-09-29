import type { Metadata } from 'next'
import { BRAND_NAME, BRAND_URL, OG_IMAGE } from '@/lib/site'

type PageMetaInput = {
  title: string
  description: string
  path: string
  image?: string
}

export function pageMetadata({ title, description, path, image }: PageMetaInput): Metadata {
  const url = `${BRAND_URL}${path === '/' ? '' : path}`
  const ogImage = image ?? OG_IMAGE
  const fullTitle = title.includes(BRAND_NAME) ? title : `${title} | ${BRAND_NAME}`

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url,
      siteName: BRAND_NAME,
      title: fullTitle,
      description,
      images: [{ url: ogImage, width: 1344, height: 768, alt: `${BRAND_NAME} chauffeur fleet in Orlando` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage],
    },
  }
}
