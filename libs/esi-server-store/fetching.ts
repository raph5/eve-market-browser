import type { Region, MarketGroup, Type } from "./types";
import esiFetch from "esi-fetch";
import { createRecord } from "utils";
import { parseCsv } from "utils/server";

const HUB_REGION = [ 10000002, 10000043, 10000030, 10000032, 10000042 ]

export async function fetchType(id: number): Promise<Type> {
  const type = await esiFetch(`/universe/types/${id}`)
  if(type.error) throw new Error("type fetching error")
  return { id: type.type_id, name: type.name }
}

export async function fetchRegions(): Promise<Region[]> {
  const regionDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/mapRegions.csv')

  if(!regionDumpResponse.ok) throw new Error("cant fetch fuzzwork dumps")

  const regionDump = await regionDumpResponse.text()
    .then(t => parseCsv(t))

  const regions = regionDump
    .map(({ regionID, regionName }: any) => ({ id: parseInt(regionID), name: regionName }))

  const minorRegions = regions
    .filter(({ id }: any) => id != 10000004 && id != 10000017 && id != 10000019 && id < 11000000 && !HUB_REGION.includes(id))
    .sort((a: Region, b: Region) => {
      if(a.name == b.name) return 0
      if(a.name < b.name) return -1
      return 1
    })

  const hubRegions = HUB_REGION
    .map(hubId => {
      const region = regions.find((r: Region) => r.id == hubId)
      if(!region) throw new Error("cant find hub in region dump")
      return region
    })

  return hubRegions.concat(minorRegions)
}

export async function fetchMarketGroups(): Promise<MarketGroup[]> {
  const typeDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invTypes.csv')
  const groupDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invMarketGroups.csv')
  const iconDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/eveIcons.csv')

  if(!groupDumpResponse.ok || !iconDumpResponse.ok || !typeDumpResponse.ok) {
    throw new Error("cant fetch fuzzwork dumps")
  }

  const typeDump = await typeDumpResponse.text().then(t => parseCsv(t))
  const groupDump = await groupDumpResponse.text().then(t => parseCsv(t))
  const iconDump = await iconDumpResponse.text().then(t => parseCsv(t))

  const iconsDumpRecord = createRecord(iconDump, 'iconID')

  const groupRecord: Record<string, MarketGroup> = {}

  for(const group of groupDump) {
    if(iconsDumpRecord[group.iconID]) '7_64_15.png'

    groupRecord[group.marketGroupID] = {
      id: parseInt(group.marketGroupID),
      parentId: group.parentGroupID != 'None' ? parseInt(group.parentGroupID) : null,
      childsId: [],
      types: [],
      name: group.marketGroupName,
      description: group.description,
      iconFile: iconsDumpRecord[group.iconID] ? iconsDumpRecord[group.iconID].iconFile.split('/').at(-1) : '7_64_15.png',
      iconAlt: iconsDumpRecord[group.iconID] ? iconsDumpRecord[group.iconID].description : 'Unknown'
    }
  }

  for(const type of typeDump) {
    if(type.marketGroupID != 'None') {
      groupRecord[type.marketGroupID].types.push(parseInt(type.typeID))
    }
  }

  let parentId
  for(const groupId in groupRecord) {
    parentId = groupRecord[groupId].parentId
    if(parentId != null) {
      groupRecord[parentId].childsId.push(parseInt(groupId))
    }
  }

  return Object.values(groupRecord)
}

export async function fetchTypes(marketGroups: MarketGroup[]): Promise<Record<string, string>> {
  const typeDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invTypes.csv')

  if(!typeDumpResponse.ok) throw new Error("cant fetch fuzzwork dumps")

  const typeDump = await typeDumpResponse.text()
    .then(t => parseCsv(t))

  const typeDumpRecord: Record<string, string> = {}
  typeDump.forEach((t: any) => typeDumpRecord[t.typeID] = t.typeName)

  const types: Record<string, string> = {}
  for(const group of marketGroups) {
    for(const typeId of group.types) {
      types[typeId] = typeDumpRecord[typeId]
    }
  }

  return types
}