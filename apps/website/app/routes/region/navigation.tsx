import type { MarketGroup, Type } from "esi-store/types"
import "@scss/navigation.scss"
import { Tab, TabRef, TabsRoot } from "@components/tabs"
import { MarketTree } from "./marketTree"
import { Quickbar } from "./quickbar"
import { useContext, useEffect, useRef, useState } from "react"
import QuickbarContext from "@contexts/quickbarContext"

export interface QuickItem {
  type: number
  name: string
  folder: string
}

export interface NavigationProps {
  types: Type[]
  typeRecord: Record<string, Type>
  marketGroups: MarketGroup[]
  marketGroupRecord: Record<string, MarketGroup>
}

export default function Navigation({ types, typeRecord, marketGroups, marketGroupRecord }: NavigationProps) {
  const quickbar = useContext(QuickbarContext)
  const tabsRef = useRef<TabRef>(null)
  const [marketTreeValue, setMarketTreeValue] = useState<Set<string>>(new Set())
  const [quickbarTreeValue, setQuickbarTreeValue] = useState<Set<string>>(new Set())

  useEffect(() => {
    tabsRef.current?.blink('quickbar')
  }, [quickbar.state])

  const tabs = [
    { value: 'browse', label: 'Browse' },
    { value: 'quickbar', label: 'Quickbar' }
  ]

  return (
    <nav className="nav">
      <TabsRoot className="nav__tabs" tabs={tabs} defaultValue="browse" ref={tabsRef}>
        <Tab className="nav__tab" value="browse">
          <MarketTree
            types={types}
            typeRecord={typeRecord}
            marketGroups={marketGroups}
            marketGroupRecord={marketGroupRecord}
            treeValue={marketTreeValue}
            onTreeValueChange={setMarketTreeValue}
          />
        </Tab>
        <Tab className="nav__tab" value="quickbar">
          <Quickbar
            typeRecord={typeRecord}
            treeValue={quickbarTreeValue}
            onTreeValueChange={setQuickbarTreeValue}
          />
        </Tab>
      </TabsRoot>
    </nav>
  )
}
