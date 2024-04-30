import { useContext, useMemo, useState } from "react"
import TreeView from "react-composable-treeview"
import { MixerHorizontalIcon, TriangleRightIcon, DrawingPinIcon, DrawingPinFilledIcon } from "@radix-ui/react-icons"
import EveIcon, { iconSrc } from "@components/eveIcon"
import classNames from "classnames"
import { Type, MarketGroup as MarketGroupType } from "esi-server-store/types"
import { createContext } from "react"
import { Link, useNavigate, useParams } from "@remix-run/react"
import { RARITY_TO_META, getMeta } from "esi-client-store/main"
import { Meta } from "esi-client-store/types"
import { useTypeSearch } from "@hooks/useTypeSearch"
import { SearchBar } from "@components/searchBar"
import { BsArrowsCollapse } from "react-icons/bs"
import QuickbarContext from "@contexts/quickbarContext"
import { stringSort } from "utils/main"
import "@scss/market-tree.scss"

export interface MarketTreeProps extends Omit<React.HTMLAttributes<HTMLUListElement>, 'defaultValue'> {
  types: Type[]
  typeRecord: Record<string, Type>
  marketGroups: MarketGroupType[]
  marketGroupRecord: Record<string, MarketGroupType>
  treeValue: Set<string>
  onTreeValueChange: (v: Set<string>) => void
}

interface MarketGroupProps {
  groupId: number
}

interface MarketMetaGroupProps {
  children: React.ReactNode
  groupId: Number
  meta: Meta
}

interface MarketItemProps {
  typeId: number
}


interface MarketTreeContextType {
  region: string
  typeRecord: Record<string, Type>
  marketGroups: MarketGroupType[]
  marketGroupRecord: Record<string, MarketGroupType>
  quickbar: Record<string, number[]>
  addToQuickbar: (typeId: number) => void
  removeFromQuickbar: (typeId: number) => void
}

const MarketTreeContext = createContext<MarketTreeContextType>({
  region: '10000002',
  typeRecord: {},
  marketGroups: [],
  marketGroupRecord: {},
  quickbar: {},
  addToQuickbar: () => { },
  removeFromQuickbar: () => { }
})


export function MarketTree({
  types,
  typeRecord,
  marketGroups,
  marketGroupRecord,
  className,
  treeValue,
  onTreeValueChange,
  ...props
}: MarketTreeProps) {
  const { quickbar, addToQuickbar, removeFromQuickbar } = useContext(QuickbarContext)
  const [search, setSearch, results] = useTypeSearch(types)
  const params = useParams()

  const rootGroups = marketGroups.filter(g => g.parentId == null).sort(stringSort(g => g.name))
  const region = params.region as string

  function collapseTree() {
    onTreeValueChange(new Set())
  }

  return (
    <MarketTreeContext.Provider value={{ typeRecord, marketGroupRecord, marketGroups, region, quickbar, addToQuickbar, removeFromQuickbar }}>
      <div className="market-tree">
        <div className="market-tree__header">
          <SearchBar
            className="market-tree__search-bar"
            value={search}
            onValueChange={setSearch}
            placeholder="Search"
            focusShortcut />
          <button onClick={collapseTree} className="market-tree__button" title="Collapse all folders">
            <BsArrowsCollapse className="market-tree__button-icon" />
          </button>
          {/* <button className="market-tree__button" title="Filters">
            <MixerHorizontalIcon className="market-tree__button-icon" />
          </button> */}
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
              <MarketGroup groupId={group.id} key={group.id} />
            ))}
          </TreeView.Root>

          {search.length > 3 && results.map(t => (
            <Link className="market-tree__item" to={`/region/${params.region ?? 10000002}/type/${t.id}`} key={t.id}>
              <span>{t.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </MarketTreeContext.Provider>
  )
}

function MarketGroup({ groupId }: MarketGroupProps) {
  const { marketGroupRecord, typeRecord } = useContext(MarketTreeContext)
  const group = marketGroupRecord[groupId]

  const [metaGroups, mainMetaRarity] = useMemo(() => {
    const metaGroups: Record<string, number[]> = {}  // rarity to typeId array record
    let mainMetaRarity: number = -1

    for (const typeId of group.types) {
      const type = typeRecord[typeId]
      const meta = getMeta(type.metaLevel)

      if (mainMetaRarity == -1 || meta.rarity < mainMetaRarity) {
        mainMetaRarity = meta.rarity
      }

      if (!metaGroups[meta.rarity]) {
        metaGroups[meta.rarity] = [type.id]
      }
      else {
        metaGroups[meta.rarity].push(type.id)
      }
    }

    return [metaGroups, mainMetaRarity]
  }, [groupId])

  return (
    <TreeView.Group value={`group:${group.id}`} className="market-group">
      <TreeView.Trigger className="market-group__trigger">
        <TriangleRightIcon className="market-group__triangle" />
        <EveIcon src={iconSrc(group.iconFile)} alt={group.iconAlt} className="market-group__icon" />
        <span className="market-group__label">{group.name}</span>
      </TreeView.Trigger>
      <TreeView.Content className="market-group__content">

        {group.childsId.map(groupId => (
          <MarketGroup groupId={groupId} key={groupId} />
        ))}

        {metaGroups[mainMetaRarity] && metaGroups[mainMetaRarity].map(typeId => (
          <MarketItem typeId={typeId} key={typeId} />
        ))}

        {Object.keys(metaGroups).filter(rarity => parseInt(rarity) != mainMetaRarity).map(rarity => (
          <MarketMetaGroup groupId={group.id} meta={RARITY_TO_META[rarity]} key={rarity}>

            {metaGroups[rarity].map(typeId => (
              <MarketItem typeId={typeId} key={typeId} />
            ))}

          </MarketMetaGroup>
        ))}

      </TreeView.Content>
    </TreeView.Group>
  )
}

function MarketMetaGroup({ meta, groupId, children }: MarketMetaGroupProps) {

  return (
    <TreeView.Group value={`group:${groupId}:meta:${meta.name}`} className="market-group market-group--meta">
      <TreeView.Trigger className="market-group__trigger">
        <TriangleRightIcon className="market-group_triangle" />
        <EveIcon src={meta.iconSrc} alt={`${meta.name} icon`} className="market-group__icon" />
        <span className="market-group__label">{meta.name}</span>
      </TreeView.Trigger>
      <TreeView.Content className="market-group__content">
        {children}
      </TreeView.Content>
    </TreeView.Group>
  )
}

function MarketItem({ typeId }: MarketItemProps) {
  const navigate = useNavigate()
  const { typeRecord, region } = useContext(MarketTreeContext)
  const { isInQuickbar, addToQuickbar, removeFromQuickbar } = useContext(QuickbarContext)
  const type = typeRecord[typeId]

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key != 'Enter') return
    navigate(`/region/${region}/type/${type.id}`)
  }

  return (
    <TreeView.Item value={`type:${type.id}`} onKeyDown={handleKeyDown} className="market-item">
      <Link to={`/region/${region}/type/${type.id}`} className="market-item__link">
        {type.name}
      </Link>
      {isInQuickbar(typeId) ? (
        <button onClick={e => { removeFromQuickbar(typeId); e.stopPropagation() }} className="market-item__button" title="Remove from quickbar">
          <DrawingPinFilledIcon className="market-item__button-icon" />
        </button>
      ) : (
        <button onClick={e => { addToQuickbar(typeId); e.stopPropagation() }} className="market-item__button" title="Add to quickbar">
          <DrawingPinIcon className="market-item__button-icon" />
        </button>
      )}
    </TreeView.Item>
  )
}
