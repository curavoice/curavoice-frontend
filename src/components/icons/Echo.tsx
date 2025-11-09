"use client"

import Image from 'next/image'

export type IconProps = {
  className?: string
  width?: number
  height?: number
  title?: string
}

export default function EchoIcon({ className, width = 469, height = 541, title }: IconProps) {
  return (
    <Image
      src="/assets/echo-character-figma.svg"
      alt={title ?? 'Echo Character'}
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}


