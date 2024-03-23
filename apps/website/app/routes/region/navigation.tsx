import type { MarketGroup } from "esi-server-store/types"
import "@scss/navigation.scss"
import { AccordionUl, AccordionLi } from "@components/small/accordion"

export interface NavigationProps {
  types: Record<string, string>
  marketGroups: MarketGroup[]
  marketGroupsRecord: Record<string, MarketGroup>
}

export default function Navigation({ types, marketGroups, marketGroupsRecord }: NavigationProps) {
  
  function getGroupUl(groups: MarketGroup[]) {
    if(groups.length > 1) {
      return (
        <AccordionUl type="multiple">
          {groups.map((g) => (
            <AccordionLi value={g.id.toString()} label={g.name} key={g.id}>
              { getGroupUl(g.childsId.map(id => marketGroupsRecord[id])) }
            </AccordionLi>
          ))}
        </AccordionUl>
      )
    }
  }
  
  return (
    <nav className="nav">
      <div className="nav__market-groups">
        {
          getGroupUl( marketGroups.filter(g => !g.parentId) )
        }
      </div>
    </nav>
  )
}