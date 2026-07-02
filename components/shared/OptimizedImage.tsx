import Image, { type ImageProps } from 'next/image'

type OptimizedImageProps = Omit<ImageProps, 'src'> & {
  src: string
}

/** next/image wrapper that supports local and remote fleet assets. */
export function OptimizedImage({ src, alt, className, ...rest }: OptimizedImageProps) {
  const isRemote = src.startsWith('http://') || src.startsWith('https://')

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      unoptimized={isRemote && !src.includes('supabase')}
      {...rest}
    />
  )
}