import type { MarketGroup, Type } from "esi-server-store/types"
import "@scss/navigation.scss"
import TreeView from "@components/treeView"
import { Tab, TabsRoot } from "@components/tabs"
import { SearchBar } from "@components/searchBar"
import { useMemo, useState } from "react"
import { Link, useParams } from "@remix-run/react"
import { stringSort } from "utils"
import { useTypeSearch } from "@hooks/useTypeSearch"

export interface NavigationProps {
  types: Type[]
  typeRecord: Record<string, Type>
  marketGroups: MarketGroup[]
  marketGroupRecord: Record<string, MarketGroup>
}

export default function Navigation({ types, typeRecord, marketGroups, marketGroupRecord }: NavigationProps) {
  // const marketTypes 
  const [search, setSearch, results] = useTypeSearch(types)
  const params = useParams()

  const tabs = [
    { value: 'borwse', label: 'Borwse' },
    { value: 'quickbar', label: 'Quickbar' }
  ]

  return (
    <nav className="nav">
      <TabsRoot className="nav__tabs" tabs={tabs} defaultValue="borwse">
        <Tab className="nav__tab borwse" value="borwse">
          <div className="borwse__header">
            <SearchBar className="borwse__search-bar" value={search} onValueChange={setSearch} placeholder="Search" focusShortcut />
          </div>
          <div className="borwse__body">
              <TreeView
                style={search.length > 3 ? { display: 'none' } : {}}
                typeRecord={typeRecord}
                marketGroups={marketGroups}
                marketGroupRecord={marketGroupRecord} />

              {search.length > 3 && results.map(t => (
                <Link className="borwse__item" to={`/region/${params.region ?? 10000002}/type/${t.id}`} key={t.id}>
                  <span>{t.name}</span>
                </Link>
              ))}
          </div>
        </Tab>
        <Tab className="nav__tab" value="quickbar">

        </Tab>
      </TabsRoot>
    </nav>
  )
}