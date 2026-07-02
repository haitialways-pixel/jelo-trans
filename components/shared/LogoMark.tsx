import Image from 'next/image'

type LogoMarkProps = {
  size?: 'nav' | 'footer'
}

const SIZES = {
  nav: 44,
  footer: 38,
} as const

export function LogoMark({ size = 'nav' }: LogoMarkProps) {
  const px = SIZES[size]

  return (
    <Image
      src="/images/logo.webp"
      alt="Imperial Odyssey"
      width={px}
      height={px}
      className="object-contain shrink-0"
      priority={size === 'nav'}
    />
  )
}