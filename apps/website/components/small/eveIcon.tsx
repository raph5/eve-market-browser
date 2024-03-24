import fallback from "@assets/fallback.png"

export interface EveIconProps {
  iconFile: string
  iconAlt: string
  className?: string
}

const IMAGE_SERVER = "https://evetycoon.com/images/icons/"

export default function EveIcon({ iconFile, iconAlt, className }: EveIconProps) {
  return (
    <img
      className={className}
      src={IMAGE_SERVER + iconFile}
      alt={iconAlt}
      onError={({ currentTarget }) => {
        currentTarget.onerror = null
        currentTarget.src = fallback
        currentTarget.alt = 'Unknown'
      }} />
  )
}