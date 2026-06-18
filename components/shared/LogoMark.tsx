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
    <div
      className={`${box} rounded-lg border-2 border-dashed border-primary/45 bg-surface-container-lowest flex items-center justify-center shrink-0`}
      aria-label="Company logo placeholder"
    >
      <span className={`${label} text-primary/65 tracking-[0.2em] font-medium uppercase`}>Logo</span>
    </div>
  )
}