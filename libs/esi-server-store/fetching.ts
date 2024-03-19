import type { Region, MarketGroup, Type } from "./types";
import esiFetch from "esi-fetch";

export async function fetchType(id: number): Promise<Type> {
  const type = await esiFetch(`/universe/types/${id}`)
  if(type.error) throw new Error("type fetching error")
  return { id: type.type_id, name: type.name }
}

export async function fetchRegions(): Promise<Record<string, Region>> {
  const regions = await esiFetch('/universe/regions')
  if(regions.error) throw new Error("region id fetching error")

  const regionNames = await esiFetch('/universe/names', {}, regions, 'POST')
  if(regionNames.error) throw new Error("region name fetching error")

  const regionRecord: Record<string, Region> = {}
  for(const { id, name } of regionNames) {
    regionRecord[id] = { id, name }
  }

  return regionRecord
}

export async function fetchMarketGroups(): Promise<Record<string, MarketGroup>> {
  const groups = await esiFetch('/markets/groups')
  if(groups.error) throw new Error("groups id fetching error")

  const groupsDataPromises = groups.map((gId: number) => esiFetch(`/markets/groups/${gId}`))
  const groupsData = await Promise.all(groupsDataPromises)
  if(groupsData.find(g => g.error)) throw new Error("groups data fetching error")

  const groupRecord: Record<string, MarketGroup> = {}
  for(const {name, description, market_group_id, parent_group_id, types} of groupsData) {
    groupRecord[market_group_id] = {
      id: market_group_id,
      childsId: [],
      name: name,
      description: description,
      types: types
    }
    if(parent_group_id) groupRecord[market_group_id].parentId = parent_group_id
  }

  for(const gId in groupRecord) {
    const parentId = groupRecord[gId].parentId
    if(parentId) {
      groupRecord[parentId].childsId.push(parseInt(gId))
    }
  }

  return groupRecord
}