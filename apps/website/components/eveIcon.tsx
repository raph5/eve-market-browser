import fallback from "@assets/fallback.png"

export interface EveIconProps {
  src: string
  alt: string
  className?: string
}

export const iconSrc = (file: string) => `/icons/${file}`
export const typeIconSrc = (type: string|number) => `https://images.evetech.net/types/${type}/icon`

export default function EveIcon({ src, alt, className }: EveIconProps) {
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={({ currentTarget }) => {
        currentTarget.onerror = null
        currentTarget.src = fallback
        currentTarget.alt = 'Unknown'
      }} />
  )
}
