import { TriangleDownIcon, TriangleRightIcon } from '@radix-ui/react-icons';
import React from 'react';
import AccessibleTreeView from "@utils/accessibleTreeView";
import "@scss/tree-view.scss"
import type { IBranchProps, INodeRendererProps, LeafProps, INode } from 'react-accessible-treeview';
import { Link, useParams } from '@remix-run/react';
import { MarketGroup, Type } from 'esi-server-store/types';
import EveIcon, { iconSrc } from './eveIcon';
import { useTreeViewNodes } from '@hooks/useTreeViewNodes';

export interface TreeViewProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onSelect'|'onBlur'> {
  typeRecord: Record<string, Type>
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
  iconSrc: string
}

export interface ItemNodeProps {
  id: string
  name: string
  depth: number
  getNodeProps: () => IBranchProps|LeafProps
}

export default function TreeView({ typeRecord, marketGroups, marketGroupRecord, ...props }: TreeViewProps) {
  const nodes = useTreeViewNodes(typeRecord, marketGroups, marketGroupRecord)

  return (
    <AccessibleTreeView
      data={nodes}
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
        iconSrc={element.metadata.iconSrc as string ?? ''} />
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

function GroupNode({ id, name, depth, isExpanded, getNodeProps, iconAlt, iconSrc }: GroupNodeProps) {
  return (
    <div {...getNodeProps()} style={{ '--depth': depth-1 } as React.CSSProperties}>
      {isExpanded ? (
        <TriangleDownIcon className="tree-node-triangle" />
        ) : (
        <TriangleRightIcon className="tree-node-triangle" />
      )}
      <EveIcon alt={iconAlt} src={iconSrc} className="tree-node-icon" />
      <span>{name}</span>
    </div>
  )
}

function ItemNode({ id, name, depth, getNodeProps }: ItemNodeProps) {
  const params = useParams()
  const type = id.substring(5)

  function onKeyDownHandler(event: React.KeyboardEvent) {
    if(event.key != 'Enter') return
    const target = event.target as HTMLAnchorElement
    target.click()
  }

  return (
    <Link
      onKeyDown={onKeyDownHandler}
      style={{ '--depth': depth-1 } as React.CSSProperties}
      to={`/region/${params.region ?? 10000002}/type/${type}`}
      {...getNodeProps() as React.HTMLAttributes<HTMLAnchorElement>}
    >
      <span className={type == params.type ? 'selected' : ''}>{name}</span>
    </Link>
  )
}