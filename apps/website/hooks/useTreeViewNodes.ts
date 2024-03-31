import { MarketGroup, Type } from "esi-server-store/types";
import { numberSort, stringSort } from "utils";
import { useMemo } from "react";
import { INode } from "react-accessible-treeview";
import { iconSrc } from "@components/eveIcon";
import { getMeta } from "esi-client-store";

export type useTreeViewNodesHook = INode[]

export function useTreeViewNodes(
  typeRecord: Record<string, Type>,
  marketGroups: MarketGroup[],
  marketGroupRecord: Record<string, MarketGroup>
): useTreeViewNodesHook {
  return useMemo(() => {

    const nodes: INode[] = []
    const rootNodes: number[] = []

    for(const g of marketGroups) {
      if(g.parentId == null) rootNodes.push(g.id)
      
      const sortedTypes = g.types.sort(stringSort(t => typeRecord[t].name))
      const sortedGroups = g.childsId.sort(stringSort(g => marketGroupRecord[g].name))
      
      const items: string[] = []
      const metaRecord: Record<string, string[]> = {}
      for(const t of sortedTypes) {
        const metaLevel = typeRecord[t].metaLevel
        if(metaLevel == 1) {
          items.push(`type:${t}`)
          nodes.push({
            id: `type:${t}`,
            name: typeRecord[t].name,
            parent: `group:${g.id}`,
            children: [],
            metadata: { type: 'item' }
          })
        }
        else {
          if(!metaRecord[metaLevel]) metaRecord[metaLevel] = [`type:${t}`]
          else metaRecord[metaLevel].push(`type:${t}`)

          nodes.push({
            id: `type:${t}`,
            name: typeRecord[t].name,
            parent: `group:${g.id}:tech:${metaLevel}`,
            children: [],
            metadata: { type: 'item' }
          })
        }
      }

      const metaGroups = Object.keys(metaRecord).sort(numberSort(parseInt))
      for(const metaLevel of metaGroups) {
        const meta = getMeta(parseInt(metaLevel))
        nodes.push({
          id: `group:${g.id}:tech:${metaLevel}`,
          name: meta.name,
          parent: `group:${g.id}`,
          children: metaRecord[metaLevel],
          metadata: { type: 'group', iconSrc: meta.iconSrc, iconAlt: `${meta.name} icon` }
        })
      }

      nodes.push({
        id: `group:${g.id}`,
        name: g.name,
        parent: g.parentId ? `group:${g.parentId}` : 'root',
        children: [
          ...sortedGroups.map(g => `group:${g}`),
          ...items,
          ...metaGroups.map(t => `group:${g.id}:tech:${t}`)
        ],
        metadata: { type: 'group', iconSrc: iconSrc(g.iconFile), iconAlt: g.iconAlt }
      })
    }

    nodes.push({
      id: 'root',
      name: '',
      parent: null,
      children: rootNodes.sort(stringSort(g => marketGroupRecord[g].name)).map(g => `group:${g}`)
    })

    return nodes
  }, [typeRecord, marketGroups, marketGroupRecord])
}