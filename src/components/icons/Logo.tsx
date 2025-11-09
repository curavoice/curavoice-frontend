"use client"

import Image from 'next/image'

export type IconProps = {
  className?: string
  width?: number
  height?: number
  title?: string
}

export default function LogoIcon({ className, width = 68, height = 68, title }: IconProps) {
  return (
    <Image
      src="/assets/logo.svg"
      alt={title ?? 'CuraVoice Logo'}
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}
