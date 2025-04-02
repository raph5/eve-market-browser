import { useContext, useEffect, useMemo, useState } from "react"
import TreeView from "react-composable-treeview"
import EveIcon, { iconSrc } from "@components/eveIcon"
import classNames from "classnames"
import { Type, MarketGroup as EsiMarketGroup } from "@app/esiStore/types"
import { createContext } from "react"
import { Link, useLocation, useNavigate, useParams } from "@remix-run/react"
import { useTypeSearch } from "@hooks/useTypeSearch"
import { SearchBar } from "@components/searchBar"
import QuickbarContext from "@contexts/quickbarContext"
import { stringSort } from "@app/utils"
import * as ContextMenu from "@radix-ui/react-context-menu"
import triangleRightIcon from "@assets/triangle-right.png"
import collapseIcon from "@assets/collapse.png"
import pinIcon from "@assets/pin.png"
import unpinIcon from "@assets/unpin.png"
import "@scss/market-tree.scss"
import { getRarityIcon, getRarityName, getMetaRarity } from "@app/meta"
import { usePath } from "@hooks/usePath"


export interface MarketTreeProps extends Omit<React.HTMLAttributes<HTMLUListElement>, 'defaultValue'> {
  types: Type[]
  marketGroups: EsiMarketGroup[]
  treeValue: Set<string>
  onTreeValueChange: (v: Set<string>) => void
}

interface MarketGroupProps {
  group: EsiMarketGroup
}

interface MarketRarityGroupProps {
  children: React.ReactNode
  group: EsiMarketGroup
  rarity: number
}

interface MarketItemProps {
  type: Type
}

interface MarketTypeProps {
  type: Type
}


interface MarketTreeContextType {
  region: string
  types: Type[]
  marketGroups: EsiMarketGroup[]
}

const MarketTreeContext = createContext<MarketTreeContextType>({
  region: '0',
  types: [],
  marketGroups: [],
})


export function MarketTree({
  types,
  marketGroups,
  className,
  treeValue,
  onTreeValueChange,
  ...props
}: MarketTreeProps) {
  const [search, setSearch, results] = useTypeSearch(types)
  const params = useParams()

  const rootGroups = marketGroups.filter(g => g.parentId == null).sort(stringSort(g => g.name))
  const region = params.region as string

  function collapseTree() {
    onTreeValueChange(new Set())
  }

  return (
    <MarketTreeContext.Provider value={{ types, marketGroups, region }}>
      <div className="market-tree">
        <div className="market-tree__header">
          <SearchBar
            className="market-tree__search-bar"
            value={search}
            onValueChange={setSearch}
            placeholder="Search"
            focusShortcut />
          <button onClick={collapseTree} className="market-tree__button" title="Collapse all folders">
            <img src={collapseIcon} className="market-tree__button-icon" />
          </button>
        </div>
        <div className="market-tree__body">
          <TreeView.Root
            style={search.length > 3 ? { display: 'none' } : {}}
            value={treeValue}
            onValueChange={onTreeValueChange}
            className={classNames(classNames, 'market-tree__tree')}
            {...props}
          >
            {rootGroups.map(group => (
              <MarketGroup group={group} key={group.id} />
            ))}
          </TreeView.Root>

          {search.length > 3 &&
            <ul className="market-tree__results">
              {results.map(type => (
                <MarketType type={type} key={type.id} />
              ))}
            </ul>
          }
        </div>
      </div>
    </MarketTreeContext.Provider>
  )
}

function MarketGroup({ group }: MarketGroupProps) {
  const { types, marketGroups } = useContext(MarketTreeContext)

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

  return (
    <TreeView.Group value={`group:${group.id}`} className="market-group">
      <TreeView.Trigger className="market-group__trigger">
        <img src={triangleRightIcon} className="market-group__triangle" />
        <EveIcon src={iconSrc(group.iconId)} alt="" className="market-group__icon" />
        <span className="market-group__label">{group.name}</span>
      </TreeView.Trigger>
      <TreeView.Content className="market-group__content">

        {group.childsId.map(groupId => (
          <MarketGroup group={getMarketGroup(marketGroups, groupId)} key={groupId} />
        ))}

        {rarityGroupCount == 1 && rarityGroups.flat().map(type => (
          <MarketItem type={type} key={type.id} />
        ))}

        {rarityGroupCount > 1 && rarityGroups[0] && rarityGroups[0].map(type => (
          <MarketItem type={type} key={type.id} />
        ))}
        {rarityGroupCount > 1 && rarityGroups[1] && rarityGroups[1].map(type => (
          <MarketItem type={type} key={type.id} />
        ))}
        {rarityGroupCount > 1 && rarityGroups.map((rarityGroup, rarity) => (
          rarity != 0 && rarity != 1 && (
            <MarketRarityGroup group={group} rarity={rarity} key={rarity}>
              {rarityGroup.map(type => <MarketItem type={type} key={type.id} />)}
            </MarketRarityGroup>
          )
        ))}

      </TreeView.Content>
    </TreeView.Group>
  )
}

function MarketRarityGroup({ rarity, group, children }: MarketRarityGroupProps) {
  const name = getRarityName(rarity)
  const iconSrc = getRarityIcon(rarity)

  return (
    <TreeView.Group value={`group:${group.id}:meta:${name}`} className="market-group market-group--meta">
      <TreeView.Trigger className="market-group__trigger">
        <TriangleRightIcon className="market-group_triangle" />
        <EveIcon src={iconSrc} alt={`${name} icon`} className="market-group__icon" />
        <span className="market-group__label">{name}</span>
      </TreeView.Trigger>
      <TreeView.Content className="market-group__content">
        {children}
      </TreeView.Content>
    </TreeView.Group>
  )
}

function MarketItem({ type }: MarketItemProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const path = usePath()
  const quickbar = useContext(QuickbarContext)
  const inQuickbar = useMemo(() => quickbar.has(type.id), [type, quickbar.state])
  const [linkHref, setLinkHref] = useState(path.setTypeId(type.id))

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key == 'Enter') {
      navigate(path.setTypeId(type.id))
    }
  }

  // NOTE: The cost of the useEffect may be big
  useEffect(() => setLinkHref(path.setTypeId(type.id)), [location])

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <TreeView.Item value={`type:${type.id}`} onKeyDown={handleKeyDown} className="market-item">
          <Link to={linkHref} tabIndex={-1} className="market-item__link">
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

function MarketType({ type }: MarketTypeProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const path = usePath()
  const quickbar = useContext(QuickbarContext)
  const inQuickbar = useMemo(() => quickbar.has(type.id), [type.id, quickbar.state])
  const [linkHref, setLinkHref] = useState(path.setTypeId(type.id))

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key == 'Enter') {
      navigate(path.setTypeId(type.id))
    }
  }

  // NOTE: The cost of the useEffect may be big
  useEffect(() => setLinkHref(path.setTypeId(type.id)), [location])

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <li onKeyDown={handleKeyDown} className="market-item">
          <Link to={linkHref} tabIndex={-1} className="market-item__link">
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
        </li>
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

function getType(types: Type[], typeId: number): Type {
  for(let i=0; i<types.length; i++) {
    if(types[i].id == typeId) {
      return types[i]
    }
  }
  throw Error(`Cant find type ${typeId} in types`)
}

function getMarketGroup(groups: EsiMarketGroup[], groupId: number): EsiMarketGroup {
  for(let i=0; i<groups.length; i++) {
    if(groups[i].id == groupId) {
      return groups[i]
    }
  }
  throw Error(`Cant find group ${groupId} in market groups`)
}
