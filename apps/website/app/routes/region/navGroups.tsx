import { AccordionItem, Accordion } from "@components/accordion"
import type { MarketGroup } from "esi-server-store/types"
import { useContext } from "react"
import { NavContext } from "./navContext"
import NavItem from "./navItem"
import EveIcon, { iconSrc } from "@components/eveIcon"

export interface NavGroupProps {
  marketGroup: MarketGroup
  depth: number
}

export default function NavGroup({ marketGroup, depth }: NavGroupProps) {
  const { marketGroupRecord, typeRecord } = useContext(NavContext)

  return (
    <AccordionItem
      depth={depth}
      value={marketGroup.id.toString()}
      label={marketGroup.name}
      startContent={<EveIcon alt={marketGroup.iconAlt} src={iconSrc(marketGroup.iconFile)} className="nav-group__icon" />}
    >
      {marketGroup.childsId.sort((a, b) => marketGroupRecord[a].name.localeCompare(marketGroupRecord[b].name)).map(childId => (
        <NavGroup depth={depth+1} marketGroup={marketGroupRecord[childId]} key={childId} />
      ))}
      
      {marketGroup.types.sort((a, b) => typeRecord[a].localeCompare(typeRecord[b])).map(typeId => (
        <NavItem depth={depth+1} typeId={typeId} key={typeId} />
      ))}
    </AccordionItem>
  )
}