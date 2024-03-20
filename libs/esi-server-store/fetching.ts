import type { Region, MarketGroup, Type } from "./types";
import esiFetch from "esi-fetch";

const HUB_REGION = [ 10000002, 10000043, 10000030, 10000032, 10000042 ]

export async function fetchType(id: number): Promise<Type> {
  const type = await esiFetch(`/universe/types/${id}`)
  if(type.error) throw new Error("type fetching error")
  return { id: type.type_id, name: type.name }
}

export async function fetchRegions(): Promise<Region[]> {
  const regions = await esiFetch('/universe/regions')
  if(regions.error) throw new Error("region id fetching error")

  const regionNames = await esiFetch('/universe/names', {}, regions, 'POST')
  if(regionNames.error) throw new Error("region name fetching error")

  // filters out jovian and wormhole regions 
  const minorRegionList = regionNames
    .map(({ id, name }: Region) => ({ id, name }))
    .filter(({ id }: Region) => id != 10000004 && id != 10000017 && id != 10000019 && id < 11000000 && !HUB_REGION.includes(id))
    .sort()

  const hubList = HUB_REGION
    .map(hubId => {
      const { id, name } = regionNames.find(({ id }: Region) => id == hubId)
      return { id, name }
    })
  
  return hubList.concat(minorRegionList)
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