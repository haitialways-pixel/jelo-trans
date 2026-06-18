type LogoMarkProps = {
  size?: 'nav' | 'footer'
}

const SIZES = {
  nav: 'w-[2.7rem] h-[2.7rem]',
  footer: 'w-[2.4rem] h-[2.4rem]',
} as const

export function LogoMark({ size = 'nav' }: LogoMarkProps) {
  return (
    <img
      src="/images/Logo.png"
      alt="Phalo Transportation"
      className={`${SIZES[size]} object-contain shrink-0`}
    />
  )
}