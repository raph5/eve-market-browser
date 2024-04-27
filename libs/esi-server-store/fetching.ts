import type { Region, MarketGroup, Type } from "./types";
import { createRecord, stringSort } from "utils";
import { parseCsv } from "utils/server";

const HUB_REGION = [ 10000002, 10000043, 10000030, 10000032, 10000042 ]

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
  const typeNameRecord: Record<string, string> = {}

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
    typeNameRecord[type.typeID] = type.typeName
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

  for(const groupId in groupRecord) {
    groupRecord[groupId].types = groupRecord[groupId].types.sort(stringSort(t => typeNameRecord[t]))
    groupRecord[groupId].childsId = groupRecord[groupId].childsId.sort(stringSort(g => groupRecord[g].name))
  }

  return Object.values(groupRecord)
}

export async function fetchTypes(marketGroups: MarketGroup[]): Promise<Type[]> {
  const typeDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invTypes.csv')
  const metaTypeDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invMetaTypes.csv')

  if(!typeDumpResponse.ok || !metaTypeDumpResponse.ok) throw new Error("cant fetch fuzzwork dumps")

  const typeDump = await typeDumpResponse.text()
    .then(t => parseCsv(t))
  const metaTypeDump = await metaTypeDumpResponse.text()
    .then(t => parseCsv(t))

  const nameRecord: Record<string, string> = {}
  const metaRecord: Record<string, number> = {}
  typeDump.forEach((t: any) => nameRecord[t.typeID] = t.typeName)
  metaTypeDump.forEach((t: any) => {
    const metaGroup = parseInt(t.metaGroupID)
    if(metaGroup == 14) metaRecord[t.typeID] = 2
    else if(metaGroup > 6) metaRecord[t.typeID] = 1
    else metaRecord[t.typeID] = metaGroup
  })

  const types: Type[] = []
  for(const group of marketGroups) {
    for(const typeId of group.types) {
      types.push({
        id: typeId,
        name: nameRecord[typeId] ?? 'Unknown',
        metaLevel: metaRecord[typeId] ?? 1
      })
    }
  }

  const sortedTypes = types.sort(stringSort(t => t.name))

  return sortedTypes
}
