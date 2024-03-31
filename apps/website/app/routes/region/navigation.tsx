import type { MarketGroup, Type } from "esi-server-store/types"
import "@scss/navigation.scss"
import TreeView from "@components/treeView"

export interface NavigationProps {
  typeRecord: Record<string, Type>
  marketGroups: MarketGroup[]
  marketGroupRecord: Record<string, MarketGroup>
}

export default function Navigation({ typeRecord, marketGroups, marketGroupRecord }: NavigationProps) {
  return (
    <nav className="nav">
      <div className="nav__market-groups">
        <TreeView typeRecord={typeRecord} marketGroups={marketGroups} marketGroupRecord={marketGroupRecord} />
      </div>
    </nav>
  )
}