import { forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import TreeView from "react-composable-treeview"
import EveIcon, { iconSrc } from "@components/eveIcon"
import classNames from "classnames"
import { Type, MarketGroup as EsiMarketGroup } from "@app/esiStore.server"
import { createContext } from "react"
import { Link, useLocation, useNavigate, useParams } from "@remix-run/react"
import { useTypeSearch } from "@hooks/useTypeSearch"
import { SearchBar } from "@components/searchBar"
import QuickbarContext, { QuickbarContextType } from "@contexts/quickbarContext"
import { stringSort } from "@app/utils"
import * as ContextMenu from "@radix-ui/react-context-menu"
import triangleRightIcon from "@assets/triangle-right.png"
import collapseIcon from "@assets/collapse.png"
import pinIcon from "@assets/pin.png"
import unpinIcon from "@assets/unpin.png"
import "@scss/market-tree.scss"
import { getRarityIcon, getRarityName, getMetaRarity } from "@app/meta"
import { usePath } from "@hooks/usePath"

export interface MarketTreeRef {
  openGroup: (groupId: number) => void,
  openType: (typeId: number, blink: boolean) => void,
}

export interface MarketTreeProps extends Omit<React.HTMLAttributes<HTMLUListElement>, 'defaultValue'> {
  types: Type[]
  marketGroups: EsiMarketGroup[]
  treeValue: Set<string>
  onTreeValueChange: (v: Set<string>) => void
}

interface MarketGroupProps {
  group: EsiMarketGroup
  index: number
}

interface MarketRarityGroupProps {
  children: React.ReactNode
  group: EsiMarketGroup
  rarity: number
  index: number
}

interface MarketItemProps {
  type: Type
  setRefs: boolean
  index: number
  quickbar: QuickbarContextType
  currentTypeId: string
}

interface MarketTreeContextType {
  regionId: string
  typeId: string,
  types: Type[]
  marketGroups: EsiMarketGroup[]
}

const MarketTreeContext = createContext<MarketTreeContextType>({
  regionId: '0',
  typeId: '0',
  types: [],
  marketGroups: [],
})

type RefsContextType = Record<string, React.RefObject<HTMLDivElement|HTMLLIElement>>

const RefsContext = createContext<RefsContextType>({});

export const MarketTree = forwardRef<MarketTreeRef, MarketTreeProps>(({
  types,
  marketGroups,
  className,
  treeValue,
  onTreeValueChange,
  ...props
}, ref) => {
  const [search, setSearch, results] = useTypeSearch(types)
  const params = useParams()
  const refs = useRef<RefsContextType>({})
  const bodyRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<SearchResultsRef>(null);
  const displaySearch = search.length > 2

  const rootGroups = useMemo(() => (
    marketGroups.filter(g => g.parentId == null).sort(stringSort(g => g.name))
  ), [marketGroups])
  const regionId = params.region as string
  const typeId = params.type as string

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key == "ArrowDown") {
      event.preventDefault()
      searchResultsRef.current?.focus()
    }
  }

  function animateBlink(id: string) {
    if (id.substring(0, 6) == "group:") {
      refs.current[id]?.current?.classList.add("market-group__trigger--blink")
      setTimeout(() => {
        refs.current[id]?.current?.classList.remove("market-group__trigger--blink")
      }, 300)
    } else {
      refs.current[id]?.current?.classList.add("market-item--blink")
      setTimeout(() => {
        refs.current[id]?.current?.classList.remove("market-item--blink")
      }, 300)
    }
  }

  function scrollIntoView(id: string) {
    const el = refs.current[id]?.current;
    const body = bodyRef.current;
    if (!el || !body) return;
    const elBox = el.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();

    const margin = 150;
    if (elBox.y - bodyBox.y < margin) {
      body.scrollTo(0, el.offsetTop - bodyBox.y - margin)
    } else if (elBox.y - bodyBox.y > bodyBox.height - margin) {
      body.scrollTo(0, el.offsetTop - bodyBox.y - bodyBox.height + margin)
    }
  }

  function collapseTree() {
    if (displaySearch) {
      searchResultsRef.current?.collapse()
    } else {
      onTreeValueChange(new Set())
    }
  }

  function openGroup(groupId: number) {
    let g = getMarketGroup(marketGroups, groupId);
    while (1) {
      treeValue.add(`group:${g.id}`)
      if (g.parentId == null) break;
      g = getMarketGroup(marketGroups, g.parentId);
    }
    setSearch("")
    onTreeValueChange(new Set(treeValue))
    setTimeout(() => animateBlink(`group:${groupId}`), 0)
  }

  function openType(typeId: number, blink: boolean) {
    for (let g of marketGroups) {
      if (g.types.includes(typeId)) {
        while (1) {
          treeValue.add(`group:${g.id}`)
          if (g.parentId == null) break;
          g = getMarketGroup(marketGroups, g.parentId);
        }
        setSearch("")
        onTreeValueChange(new Set(treeValue))
        if (blink) {
          setTimeout(() => animateBlink(`type:${typeId}`), 0)
        }
        setTimeout(() => scrollIntoView(`type:${typeId}`), 0)
        return
      }
    }
    console.error("marketTreeValueOpenType: unknown type")
  }

  useImperativeHandle(ref, () => ({openGroup, openType}));

  return (
    <MarketTreeContext.Provider value={{ types, marketGroups, regionId, typeId }}>
      <RefsContext.Provider value={refs.current}>
        <div className="market-tree">
          <div className="market-tree__header">
            <SearchBar
              className="market-tree__search-bar"
              value={search}
              onValueChange={setSearch}
              onKeyDown={handleKeyDown}
              placeholder="Search"
              focusShortcut />
            <button onClick={collapseTree} className="market-tree__button" title="Collapse all folders">
              <img src={collapseIcon} className="market-tree__button-icon" />
            </button>
          </div>
          <div className="market-tree__body" ref={bodyRef}>
            <TreeView.Root
              style={{ display: displaySearch ? 'none' : undefined}}
              value={treeValue}
              onValueChange={onTreeValueChange}
              className={classNames(classNames, 'market-tree__tree')}
              {...props}
            >
              {rootGroups.map((group, index) => (
                <MarketGroup index={index} group={group} key={group.id} />
              ))}
            </TreeView.Root>

            <SearchResults
              results={results}
              marketGroups={marketGroups}
              display={displaySearch}
              ref={searchResultsRef}
            />
          </div>
        </div>
      </RefsContext.Provider>
    </MarketTreeContext.Provider>
  )
})

function MarketGroup({ group, index }: MarketGroupProps) {
  const quickbar = useContext(QuickbarContext)
  const { typeId, types, marketGroups } = useContext(MarketTreeContext)
  const refs = useContext(RefsContext);
  refs[`group:${group.id}`] = useRef<HTMLDivElement>(null);

  let rarityGroupCount = 0
  const rarityGroups: Type[][] = []
  for(const typeId of group.types) {
    const type = getType(types, typeId)
    const rarity = getMetaRarity(type.meta)
    if(rarityGroups[rarity] === undefined) {
      rarityGroups[rarity] = [type]
      rarityGroupCount++
    }
    else {
      rarityGroups[rarity].push(type)
    }
  }

  let childIndex = 0

  return (
    <TreeView.Group index={index} value={`group:${group.id}`} className="market-group">
      <TreeView.Trigger
        ref={refs[`group:${group.id}`] as React.RefObject<HTMLDivElement>}
        className="market-group__trigger"
      >
        <img src={triangleRightIcon} className="market-group__triangle" />
        <EveIcon src={iconSrc(group.iconId)} alt="" className="market-group__icon" />
        <span className="market-group__label">{group.name}</span>
      </TreeView.Trigger>
      <TreeView.Content className="market-group__content">

        {group.childsId.map(groupId => (
          <MarketGroup index={childIndex++} group={getMarketGroup(marketGroups, groupId)} key={groupId} />
        ))}

        {rarityGroupCount == 1 && rarityGroups.flat().map(type => (
          <MarketItem index={childIndex++} setRefs={true} type={type} key={type.id} quickbar={quickbar} currentTypeId={typeId} />
        ))}

        {rarityGroupCount > 1 && rarityGroups[0] && rarityGroups[0].map(type => (
          <MarketItem index={childIndex++} setRefs={true} type={type} key={type.id} quickbar={quickbar} currentTypeId={typeId} />
        ))}
        {rarityGroupCount > 1 && rarityGroups[1] && rarityGroups[1].map(type => (
          <MarketItem index={childIndex++} setRefs={true} type={type} key={type.id} quickbar={quickbar} currentTypeId={typeId} />
        ))}
        {rarityGroupCount > 1 && rarityGroups.map((rarityGroup, rarity) => (
          rarity != 0 && rarity != 1 && (
            <MarketRarityGroup index={childIndex++} group={group} rarity={rarity} key={rarity}>
              {rarityGroup.map((type, index) => <MarketItem index={index} setRefs={true} type={type} key={type.id} quickbar={quickbar} currentTypeId={typeId} />)}
            </MarketRarityGroup>
          )
        ))}

      </TreeView.Content>
    </TreeView.Group>
  )
}

function MarketRarityGroup({ rarity, group, children, index }: MarketRarityGroupProps) {
  const name = getRarityName(rarity)
  const iconSrc = getRarityIcon(rarity)

  return (
    <TreeView.Group index={index} value={`group:${group.id}:meta:${name}`} className="market-group market-group--meta">
      <TreeView.Trigger className="market-group__trigger">
        <img src={triangleRightIcon} className="market-group_triangle" />
        <EveIcon src={iconSrc} alt={`${name} icon`} className="market-group__icon" />
        <span className="market-group__label">{name}</span>
      </TreeView.Trigger>
      <TreeView.Content className="market-group__content">
        {children}
      </TreeView.Content>
    </TreeView.Group>
  )
}

function MarketItem({ type, index, quickbar, currentTypeId }: MarketItemProps) {
  const navigate = useNavigate()
  const path = usePath()
  const inQuickbar = quickbar.has(type.id)
  const refs = useContext(RefsContext);
  refs[`type:${type.id}`] = useRef(null);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key == 'Enter') {
      navigate(path.setTypeId(type.id))
    }
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <TreeView.Item
          ref={refs[`type:${type.id}`] as React.RefObject<HTMLLIElement>}
          value={`type:${type.id}`}
          index={index}
          onKeyDown={handleKeyDown}
          className="market-item"
          data-selected={currentTypeId == type.id.toString()}
          data-in-quickbar={inQuickbar}
        >
          <Link to={path.setTypeId(type.id)} tabIndex={-1} className="market-item__link">
            {type.name}
          </Link>
          {inQuickbar ? (
            <button onClick={e => { quickbar.removeItem(type.id); e.stopPropagation() }} className="market-item__button" title="Remove from quickbar">
              <img src={unpinIcon} className="market-item__button-icon" />
            </button>
          ) : (
            <button onClick={e => { quickbar.addItem(type.id); e.stopPropagation() }} className="market-item__button" title="Add to quickbar">
              <img src={pinIcon} className="market-item__button-icon" />
            </button>
          )}
        </TreeView.Item>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="context-menu">

          {inQuickbar ? (
            <ContextMenu.Item onClick={() => quickbar.removeItem(type.id)} className="context-menu__item">
              Remove from quickbar
            </ContextMenu.Item>
          ) : (
            <ContextMenu.Item onClick={() => quickbar.addItem(type.id)} className="context-menu__item">
              Add to quickbar
            </ContextMenu.Item>
          )}

        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

interface SearchResultsRef {
  focus: () => void
  collapse: () => void
}

interface SearchResultsProps {
  results: Type[]
  marketGroups: EsiMarketGroup[]
  display: boolean
}

const SearchResults = forwardRef<SearchResultsRef, SearchResultsProps>(({
  results,
  marketGroups,
  display,
}, ref) => {
  const quickbar = useContext(QuickbarContext)
  const { typeId } = useContext(MarketTreeContext)

  interface ResultGroup {
    types: Type[]
    id: number
    iconId: number
    name: string
  }

  const rootGroups = useMemo(() => (
    marketGroups.filter(g => g.parentId == null).map(g => `group:${g.id}`)
  ), [marketGroups])

  const treeRef = useRef<HTMLLIElement>(null)
  const [treeValue, setTreeValue] = useState(new Set<string>(rootGroups))

  const groups = useMemo(() => {
    const groups: ResultGroup[] = []
    for (const type of results) {
      let typeGroup = getMarketGroupWithType(marketGroups, type.id)
      while (typeGroup.parentId != null) {
        typeGroup = getMarketGroup(marketGroups, typeGroup.parentId)
      }
      const groupIndex = groups.findIndex(g => g.id == typeGroup.id)
      if (groupIndex == -1) {
        groups.push({
          types: [type],
          id: typeGroup.id,
          name: typeGroup.name,
          iconId: typeGroup.iconId
        })
      } else {
        groups[groupIndex].types.push(type)
      }
    }

    const groupsMinLength: Record<string, number> = {}
    for (const g of groups) {
      let minLength = g.types[0].name.length
      for (const t of g.types) {
        if (t.name.length < minLength) {
          minLength = t.name.length
        }
      }
      groupsMinLength[g.id] = minLength
    }

    // PERF: this save react to have to load a huge tree by default
    for (const g of groups) {
      if (g.types.length > 200 && treeValue.has(`group:${g.id}`)) {
        const newTreeValue = new Set(treeValue)
        newTreeValue.delete(`group:${g.id}`)
        setTreeValue(newTreeValue)
      }
    }

    return groups.sort((a, b) => groupsMinLength[a.id] - groupsMinLength[b.id])
  }, [results])

  useImperativeHandle(ref, () => ({
    focus() {
      treeRef.current?.focus()
    },
    collapse() {
      setTreeValue(new Set())
    },
  }));

  return (
    <TreeView.Root
      style={{ display: display ? undefined : 'none' }}
      value={treeValue}
      onValueChange={setTreeValue}
      className={classNames(classNames, 'market-tree__tree')}
    >
      {groups.map((group, index) => (
        <TreeView.Group
          ref={index == 0 ? treeRef : undefined}
          index={index}
          key={group.id}
          value={`group:${group.id}`}
          className="market-group"
        >
          <TreeView.Trigger className="market-group__trigger">
            <img src={triangleRightIcon} className="market-group__triangle" />
            <EveIcon src={iconSrc(group.iconId)} alt="" className="market-group__icon" />
            <span className="market-group__label">{group.name}</span>
          </TreeView.Trigger>
          <TreeView.Content className="market-group__content">
            {group.types.map((t, index) => (
              <MarketItem index={index} setRefs={false} type={t} key={t.id} quickbar={quickbar} currentTypeId={typeId} />
            ))}
          </TreeView.Content>
        </TreeView.Group>
      ))}
      {groups.length == 0 &&
        <p className="market-tree__message">Nothing found</p>
      }
    </TreeView.Root>
  )
})

function getType(types: Type[], typeId: number): Type {
  for(let i=0; i<types.length; i++) {
    if(types[i].id == typeId) {
      return types[i]
    }
  }
  return {id: typeId, name: `Unknown Item ${typeId}`, meta: 1, volume: 0}
}

function getMarketGroup(groups: EsiMarketGroup[], groupId: number): EsiMarketGroup {
  for(let i=0; i<groups.length; i++) {
    if(groups[i].id == groupId) {
      return groups[i]
    }
  }
  return {
    id: groupId,
    parentId: null,
    description: `Unknwon Market Group ${groupId}`,
    name: `Unknwon Market Group ${groupId}`,
    types: [],
    iconId: 0,
    iconAlt: `Unknwon Market Group ${groupId}`,
    childsId: [],
  }
}

function getMarketGroupWithType(groups: EsiMarketGroup[], typeId: number): EsiMarketGroup {
  for(let i=0; i<groups.length; i++) {
    if(groups[i].types.includes(typeId)) {
      return groups[i]
    }
  }
  return {
    id: 0,
    parentId: null,
    description: `Unknwon Market Group`,
    name: `Unknwon Market Group`,
    types: [],
    iconId: 0,
    iconAlt: `Unknwon Market Group`,
    childsId: [],
  }
}
