import type { MarketGroup } from "esi-server-store/types"
import "@scss/navigation.scss"
import { Accordion } from "@components/accordion"
import { NavContext } from "./navContext"
import NavGroup from "./navGroups"

export interface NavigationProps {
  typeRecord: Record<string, string>
  marketGroups: MarketGroup[]
  marketGroupRecord: Record<string, MarketGroup>
}

export default function Navigation({ typeRecord, marketGroups, marketGroupRecord }: NavigationProps) {
  return (
    <NavContext.Provider value={{ typeRecord, marketGroupRecord }}>
      <nav className="nav">
        <div className="nav__market-groups">
          <Accordion>
            {marketGroups.filter(group => group.parentId == null).sort((a, b) => a.name.localeCompare(b.name)).map(group => (
              <NavGroup
                depth={0}
                marketGroup={group}
                key={group.id} />
            ))}
          </Accordion>
        </div>
      </nav>
    </NavContext.Provider>
  )
}