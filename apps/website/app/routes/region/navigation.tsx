import type { MarketGroup, Type } from "@app/esiStore.server"
import "@scss/navigation.scss"
import { Tab, TabRef, TabsRoot } from "@components/tabs"
import { MarketTree, MarketTreeRef } from "./marketTree"
import { Quickbar } from "./quickbar"
import { forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from "react"
import QuickbarContext from "@contexts/quickbarContext"

export interface QuickItem {
  type: number
  name: string
  folder: string
}

export interface NavigationRef {
  marketTree: {
    openGroup: (groupId: number) => void,
    openType: (typeId: number) => void,
  }
}

export interface NavigationProps {
  types: Type[]
  marketGroups: MarketGroup[]
}

const Navigation = forwardRef<NavigationRef, NavigationProps>(({ types, marketGroups }, ref) => {
  const quickbar = useContext(QuickbarContext)
  const tabsRef = useRef<TabRef>(null)
  const marketTreeRef = useRef<MarketTreeRef>(null)
  const [marketTreeValue, setMarketTreeValue] = useState<Set<string>>(new Set())
  const [quickbarTreeValue, setQuickbarTreeValue] = useState<Set<string>>(new Set())

  useEffect(() => {
    tabsRef.current?.blink('quickbar')
  }, [quickbar.state])

  const tabs = [
    { value: 'browse', label: 'Browse' },
    { value: 'quickbar', label: 'Quickbar' }
  ]

  useImperativeHandle(ref, () => ({
    marketTree: {
      openGroup: (groupId: number) => marketTreeRef.current?.openGroup(groupId),
      openType: (groupId: number) => marketTreeRef.current?.openType(groupId),
    }
  }))

  return (
    <nav className="nav">
      <TabsRoot className="nav__tabs" tabs={tabs} defaultValue="browse" ref={tabsRef}>
        <Tab className="nav__tab" value="browse">
          <MarketTree
            ref={marketTreeRef}
            types={types}
            marketGroups={marketGroups}
            treeValue={marketTreeValue}
            onTreeValueChange={setMarketTreeValue}
          />
        </Tab>
        <Tab className="nav__tab" value="quickbar">
          <Quickbar
            types={types}
            treeValue={quickbarTreeValue}
            onTreeValueChange={setQuickbarTreeValue}
          />
        </Tab>
      </TabsRoot>
    </nav>
  )
})

export default Navigation
