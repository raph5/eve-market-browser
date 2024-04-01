import type { MarketGroup, Type } from "esi-server-store/types"
import "@scss/navigation.scss"
import TreeView from "@components/treeView"
import { Tab, TabsRoot } from "@components/tabs"
import { SearchBar } from "@components/searchBar"
import { useMemo, useState } from "react"
import { Link, useParams } from "@remix-run/react"
import { stringSort } from "utils"

export interface NavigationProps {
  typeRecord: Record<string, Type>
  marketGroups: MarketGroup[]
  marketGroupRecord: Record<string, MarketGroup>
}

export default function Navigation({ typeRecord, marketGroups, marketGroupRecord }: NavigationProps) {
  const [searchValue, setSearchValue] = useState('')
  const types = useMemo(() => Object.values(typeRecord).sort(stringSort(t => t.name)), [typeRecord])
  const params = useParams()

  const tabs = [
    { value: 'borwse', label: 'Borwse' },
    { value: 'quickbar', label: 'Quickbar' }
  ]

  function searchResults(search: string) {
    const results: Type[] = []
    let i = 0
    while(i < types.length && results.length < 200) {
      if(types[i].name.search(search) != -1) {
        results.push(types[i])
      }
      i++
    }
    return results
  }

  return (
    <nav className="nav">
      <TabsRoot className="nav__tabs" tabs={tabs} defaultValue="borwse">
        <Tab className="nav__tab borwse" value="borwse">
          <div className="borwse__header">
            <SearchBar className="borwse__search-bar" value={searchValue} onValueChange={setSearchValue} placeholder="Search" />
          </div>
          <div className="borwse__body">
            <TreeView
              style={searchValue.length >= 3 ? { display: 'none' } : {}}
              typeRecord={typeRecord}
              marketGroups={marketGroups}
              marketGroupRecord={marketGroupRecord} />

            {searchValue.length >= 3 &&
              searchResults(searchValue).map(t => (
                <Link className="borwse__item" to={`/region/${params.region ?? 10000002}/type/${t.id}`}>
                  <span>{t.name}</span>
                </Link>
              ))
            }
          </div>
        </Tab>
        <Tab className="nav__tab" value="quickbar">

        </Tab>
      </TabsRoot>
    </nav>
  )
}