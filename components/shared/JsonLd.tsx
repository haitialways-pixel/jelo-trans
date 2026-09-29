import {
  BRAND_CONCIERGE_EMAIL,
  BRAND_NAME,
  BRAND_PHONE_TEL,
  BRAND_URL,
  LEGAL_NAME,
} from '@/lib/site'

export function LocalBusinessJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: BRAND_NAME,
    legalName: LEGAL_NAME,
    url: BRAND_URL,
    telephone: BRAND_PHONE_TEL.replace('tel:', ''),
    email: BRAND_CONCIERGE_EMAIL,
    image: `${BRAND_URL}/images/hero-lineup.webp`,
    priceRange: '$$',
    areaServed: [
      { '@type': 'City', name: 'Orlando' },
      { '@type': 'AdministrativeArea', name: 'Central Florida' },
      { '@type': 'Airport', name: 'Orlando International Airport', iataCode: 'MCO' },
      { '@type': 'Place', name: 'Orange County Convention Center' },
      { '@type': 'Place', name: 'Port Canaveral' },
    ],
    openingHours: 'Mo-Su 00:00-23:59',
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
