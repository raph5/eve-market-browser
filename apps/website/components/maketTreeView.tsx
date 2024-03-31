import { TriangleDownIcon, TriangleRightIcon } from '@radix-ui/react-icons';
import React, { AnchorHTMLAttributes, useMemo } from 'react';
import AccessibleTreeView from "@utils/accessibleTreeView";
import "@scss/tree-view.scss"
import type { IBranchProps, INodeRendererProps, LeafProps, INode } from 'react-accessible-treeview';
import { Link, useParams } from '@remix-run/react';
import { MarketGroup } from 'libs/esi-server-store/types';
import EveIcon, { iconSrc } from './eveIcon';

export interface TreeViewProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onSelect'|'onBlur'> {
  typeRecord: Record<string, string>
  marketGroups: MarketGroup[]
  marketGroupRecord: Record<string, MarketGroup>
}

export interface GroupNodeProps {
  id: string
  name: string
  depth: number
  isExpanded: boolean
  getNodeProps: () => IBranchProps|LeafProps
  iconAlt: string
  iconFile: string
}

export interface ItemNodeProps {
  id: string
  name: string
  depth: number
  getNodeProps: () => IBranchProps|LeafProps
}

export default function TreeView({ typeRecord, marketGroups, marketGroupRecord, ...props }: TreeViewProps) {
  
  const [nodes, rootNodes] = useMemo(() => {
    const nodes: INode[] = []
    const rootNodes: string[] = []
    for(const g of marketGroups) {
      if(g.parentId == null) rootNodes.push(`group:${g.id}`)
      
      const sortedTypes = g.types.sort((a: number, b: number) => typeRecord[a].localeCompare(typeRecord[b]))
      const sortedGroups = g.childsId.sort((a: number, b: number) => marketGroupRecord[a].name.localeCompare(marketGroupRecord[b].name))
      nodes.push({
        id: `group:${g.id}`,
        name: g.name,
        parent: g.parentId ? `group:${g.parentId}` : 'root',
        children: sortedGroups.map(g => `group:${g}`).concat(sortedTypes.map(t => `type:${t}`)),
        metadata: { type: 'group', iconFile: g.iconFile, iconAlt: g.iconAlt }
      })
  
      for(const t of sortedTypes) {
        nodes.push({
          id: `type:${t}`,
          name: typeRecord[t],
          parent: `group:${g.id}`,
          children: [],
          metadata: { type: 'item' }
        })
      }
    }
    return [nodes, rootNodes]
  }, [typeRecord, marketGroups, marketGroupRecord])
  

  return (
    <AccessibleTreeView
      data={[
        { id: 'root', name: '', parent: null, children: rootNodes },
        ...nodes
      ]}
      nodeRenderer={Node}
      {...props}
    />
  )
}

function Node({ element, level, isExpanded, getNodeProps }: INodeRendererProps) {
  if(!element.metadata) return
  if(element.metadata.type == 'group') {
    return (
      <GroupNode
        id={element.id as string}
        name={element.name}
        depth={level}
        isExpanded={isExpanded}
        getNodeProps={getNodeProps}
        iconAlt={element.metadata.iconAlt as string ?? ''}
        iconFile={element.metadata.iconFile as string ?? ''} />
    )
  }
  if(element.metadata.type == 'item') {
    return (
      <ItemNode
        id={element.id as string}
        name={element.name}
        depth={level}
        getNodeProps={getNodeProps} />
    )
  }
}

function GroupNode({ id, name, depth, isExpanded, getNodeProps, iconAlt, iconFile }: GroupNodeProps) {
  return (
    <div {...getNodeProps()} style={{ '--depth': depth-1 } as React.CSSProperties}>
      {isExpanded ? (
        <TriangleDownIcon className="tree-node-triangle" />
        ) : (
        <TriangleRightIcon className="tree-node-triangle" />
      )}
      <EveIcon alt={iconAlt} src={iconSrc(iconFile)} className="tree-node-icon" />
      {name}
    </div>
  )
}

function ItemNode({ id, name, depth, getNodeProps }: ItemNodeProps) {
  const { region } = useParams()

  function onKeyDownHandler(event: React.KeyboardEvent) {
    if(event.key != 'Enter') return
    const target = event.target as HTMLAnchorElement
    target.click()
  }

  return (
    <Link
      onKeyDown={onKeyDownHandler}
      style={{ '--depth': depth-1 } as React.CSSProperties}
      to={`/region/${region ?? 10000002}/type/${id.substring(5)}`}
      {...getNodeProps() as React.HTMLAttributes<HTMLAnchorElement>}
    >
      {name}
    </Link>
  )
}