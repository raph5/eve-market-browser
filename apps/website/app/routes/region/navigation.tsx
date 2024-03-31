import type { MarketGroup } from "esi-server-store/types"
import "@scss/navigation.scss"
import TreeView from "@components/maketTreeView"

export interface NavigationProps {
  typeRecord: Record<string, string>
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