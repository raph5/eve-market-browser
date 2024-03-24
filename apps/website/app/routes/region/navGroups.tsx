import { AccordionItem, Accordion } from "@components/small/accordion"
import type { MarketGroup } from "esi-server-store/types"
import { useContext } from "react"
import { NavContext } from "./navContext"
import NavItem from "./navItem"
import EveIcon from "@components/small/eveIcon"

export interface NavGroupProps {
  marketGroup: MarketGroup
  depth: number
}

export default function NavGroup({ marketGroup, depth }: NavGroupProps) {
  const { marketGroupRecord } = useContext(NavContext)

  return (
    <AccordionItem
      depth={depth}
      value={marketGroup.id.toString()}
      label={marketGroup.name}
      startContent={<EveIcon iconAlt={marketGroup.iconAlt} iconFile={marketGroup.iconFile} className="nav-group__icon" />}
    >
      {marketGroup.childsId.map(childId => (
        <NavGroup depth={depth+1} marketGroup={marketGroupRecord[childId]} key={childId} />
      ))}
      
      {marketGroup.types.map(typeId => (
        <NavItem depth={depth+1} typeId={typeId} key={typeId} />
      ))}
    </AccordionItem>
  )
}