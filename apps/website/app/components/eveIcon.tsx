import fallback from "@assets/fallback.png"
import { useEffect, useRef } from "react"

export interface EveIconProps {
  src: string
  alt: string
  className?: string
}

export const iconSrc = (iconId: number) => `/icons/${iconId}.png`
export const typeIconSrc = (type: string|number) => `https://images.evetech.net/types/${type}/icon`

export default function EveIcon({ src, alt, className }: EveIconProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (
      imgRef.current?.complete &&
      imgRef.current?.naturalWidth == 0 &&
      imgRef.current?.naturalHeight == 0
    ) {
      handleError(imgRef.current)
    }
  }, [])

  function handleError(img: HTMLImageElement) {
    if (img.src != fallback) {
      img.onerror = null
      img.src = fallback
      img.alt = 'Unknown'
    }
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      ref={imgRef}
      onError={error => handleError(error.currentTarget)} />
  )
}
