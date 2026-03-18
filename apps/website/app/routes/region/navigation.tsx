import type { MarketGroup, Type } from "@app/esiStore.server"
import "@scss/navigation.scss"
import { Tab, TabRef, TabsRoot } from "@components/tabs"
import { MarketTree, MarketTreeRef } from "./marketTree"
import { Quickbar } from "./quickbar"
import { forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from "react"
import QuickbarContext from "@contexts/quickbarContext"
import patreonLogo from "@assets/patreon.svg"

export interface QuickItem {
  type: number
  name: string
  folder: string
}

export interface NavigationRef {
  marketTree: {
    openGroup: (groupId: number) => void,
    openType: (typeId: number, blink: boolean) => void,
  }
}

export interface NavigationProps {
  types: Type[]
  marketGroups: MarketGroup[]
}

const Navigation = forwardRef<NavigationRef, NavigationProps>(({ types, marketGroups }, ref) => {
  const quickbar = useContext(QuickbarContext)
  const tabsRef = useRef<TabRef>(null)
  const hasLoaded = useRef(false)
  const marketTreeRef = useRef<MarketTreeRef>(null)
  const [marketTreeValue, setMarketTreeValue] = useState<Set<string>>(new Set())
  const [quickbarTreeValue, setQuickbarTreeValue] = useState<Set<string>>(new Set())

  useEffect(() => {
    setTimeout(() => hasLoaded.current = true, 200)
  }, [])
  useEffect(() => {
    if (hasLoaded.current) {
      tabsRef.current?.blink('quickbar')
    }
  }, [quickbar.state])

  const tabs = [
    { value: 'browse', label: 'Browse' },
    { value: 'quickbar', label: 'Quickbar' }
  ]

  useImperativeHandle(ref, () => ({
    marketTree: {
      openGroup: (groupId: number) => {
        tabsRef.current?.open("browse")
        marketTreeRef.current?.openGroup(groupId)
      },
      openType: (groupId: number, blink: boolean) => {
        tabsRef.current?.open("browse")
        marketTreeRef.current?.openType(groupId, blink)
      },
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
      <div className="nav__sponsors">
        {/* Help me fuel the server! */}
        {/* <button className="button button--accent"> */}
        {/*   <img className="button__icon" src={patreonLogo} /> */}
        {/*   <span>Patreon</span> */}
        {/* </button> */}
      </div>
    </nav>
  )
})

export default Navigation
