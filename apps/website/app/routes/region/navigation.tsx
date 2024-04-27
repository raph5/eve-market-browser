import type { MarketGroup, Type } from "esi-server-store/types"
import "@scss/navigation.scss"
import { Tab, TabRef, TabsRoot } from "@components/tabs"
import { MarketTree } from "./marketTree"
import { Quickbar } from "./quickbar"
import { useContext, useEffect, useRef } from "react"
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
  const { quickbar } = useContext(QuickbarContext)
  const tabsRef = useRef<TabRef>(null)

  useEffect(() => {
    tabsRef.current?.blink('quickbar')
  }, [quickbar])

  const tabs = [
    { value: 'borwse', label: 'Borwse' },
    { value: 'quickbar', label: 'Quickbar' }
  ]

  return (
    <nav className="nav">
      <TabsRoot className="nav__tabs" tabs={tabs} defaultValue="borwse" ref={tabsRef}>
        <Tab className="nav__tab" value="borwse">
          <MarketTree
            types={types}
            typeRecord={typeRecord}
            marketGroups={marketGroups}
            marketGroupRecord={marketGroupRecord} />
        </Tab>
        <Tab className="nav__tab" value="quickbar">
          <Quickbar typeRecord={typeRecord} />
        </Tab>
      </TabsRoot>
    </nav>
  )
}
