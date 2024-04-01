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
      
      const metaRecord: Record<string, number[]> = {}
      for(const t of sortedTypes) {
        const metaLevel = typeRecord[t].metaLevel
        if(!metaRecord[metaLevel]) metaRecord[metaLevel] = [t]
        else metaRecord[metaLevel].push(t)
      }

      const items: string[] = []
      const metaGroups: string[] = []
      const metas = Object.keys(metaRecord).sort(numberSort(parseInt))
      if(metas.length > 1) {
        for(const metaLevel of metas) {
          if(metaLevel == '1') {
            for(const t of metaRecord[metaLevel]) {
              items.push(`type:${t}`)
              nodes.push({
                id: `type:${t}`,
                name: typeRecord[t].name,
                parent: `group:${g.id}`,
                children: [],
                metadata: { type: 'item' }
              })
            }
          }
          else {
            metaGroups.push(`group:${g.id}:tech:${metaLevel}`)
            const meta = getMeta(parseInt(metaLevel))
            nodes.push({
              id: `group:${g.id}:tech:${metaLevel}`,
              name: meta.name,
              parent: `group:${g.id}`,
              children: metaRecord[metaLevel].map(t => `type:${t}`),
              metadata: { type: 'group', iconSrc: meta.iconSrc, iconAlt: `${meta.name} icon` }
            })
  
            for(const t of metaRecord[metaLevel]) {
              nodes.push({
                id: `type:${t}`,
                name: typeRecord[t].name,
                parent: `group:${g.id}:tech:${metaLevel}`,
                children: [],
                metadata: { type: 'item' }
              })
            }
          }
        }
      }
      else {
        for(const t of sortedTypes) {
          items.push(`type:${t}`)
          nodes.push({
            id: `type:${t}`,
            name: typeRecord[t].name,
            parent: `group:${g.id}`,
            children: [],
            metadata: { type: 'item' }
          })
        }
      }

      nodes.push({
        id: `group:${g.id}`,
        name: g.name,
        parent: g.parentId ? `group:${g.parentId}` : 'root',
        children: [
          ...sortedGroups.map(g => `group:${g}`),
          ...items,
          ...metaGroups
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