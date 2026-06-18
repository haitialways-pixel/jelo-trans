type LogoMarkProps = {
  size?: 'nav' | 'footer'
}

const SIZES = {
  nav: { box: 'w-[2.7rem] h-[2.7rem]', label: 'text-[9px]' },
  footer: { box: 'w-[2.4rem] h-[2.4rem]', label: 'text-[8px]' },
} as const

export function LogoMark({ size = 'nav' }: LogoMarkProps) {
  const { box, label } = SIZES[size]

  return (
    <Image
  src="/images/logo.png"
  alt="Phalo Transportation"
  width={size === 'nav' ? 43 : 38}
  height={size === 'nav' ? 43 : 38}
  className={`${box} object-contain shrink-0`}
/>
  )
}