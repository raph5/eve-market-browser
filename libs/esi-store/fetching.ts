import type { Region, MarketGroup, Type, Order, HistoryDay } from "./types";
import { createRecord, stringSort } from "utils";
import { parseCsv } from "utils/server";
import esiFetch from "esi-fetch/main";

const HUB_REGION = [ 10000002, 10000043, 10000030, 10000032, 10000042 ]
const TYCOON_RANGE: Record<string, string> = {
  STATION: "Station",
  REGION: "Region",
  SOLARSYSTEM: "Solar System",
  _1: "1 Jumps",
  _2: "2 Jumps",
  _3: "3 Jumps",
  _4: "4 Jumps",
  _5: "5 Jumps",
  _10: "10 Jumps",
  _20: "20 Jumps",
  _30: "30 Jumps",
  _40: "40 Jumps"
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

export async function fetchOrders(typeId: number, regionId: number): Promise<Order[]> {
  let url = `https://evetycoon.com/api/v1/market/orders/${typeId}`
  if(regionId != 0) {
    url += `?regionId=${regionId}`
  }
  const headers = {
    'content-type': 'application/json',
    'User-Agent': 'evemarketbrowser.com - contact me at raphguyader@gmail.com'
  }

  const response = await fetch(url, { headers })
  if(!response.ok) {
    throw new Error("EveTycoon request failed")
  }
  const data = await response.json()

  const orders = data.orders
  orders.forEach((o: any) => {
    o.range = TYCOON_RANGE[o.range]
    o.location = data.stationNames[o.locationId] || data.structureNames[o.locationId] || "Unknown Structure"
    delete o.locationId
  })

  return orders as Order[]
}

export async function fetchHistory(typeId: number, regionId: number): Promise<HistoryDay[]> {
  const history = await esiFetch(`/markets/${regionId}/history`, { type_id: typeId.toString() })
  if(history.error) throw new Error(`esi error : ${history.error}`)

  // set orderCount
  for(const day of history) {
    day.orderCount = day.order_count
    delete day.order_count
  }

  // add missing days
  let d = new Date(history[0].date)
  for(let i=1; i<history.length; i++) {
    d.setDate(d.getDate() + 1)
    const dateString = d.toISOString().split('T')[0]
    if(history[i].date != dateString) {
      history.splice(i, 0, {
        ...history[i-1],
        lowest: history[i-1].average,
        highest: history[i-1].average,
        volume: 0,
        date: dateString
      })
    }
  }

  // comput rolling 5d average
  history[0].average5d = history[0].average
  history[0].average20d = history[0].average
  history[0].donchianTop = history[0].highest
  history[0].donchianBottom = history[0].lowest
  for(let i=1; i<history.length; i++) {
    history[i].average5d = (
      6 * history[i-1].average5d -
      history[Math.max(0, i-6)].average +
      history[i].average
    ) / 6

    history[i].average20d = (
      21 * history[i-1].average20d -
      history[Math.max(0, i-21)].average +
      history[i].average
    ) / 21

    if(history[i-1].donchianTop == history[Math.max(0, i-6)].highest) {
      let j = Math.max(0, i-5)
      let top = history[j].highest
      for(j++; j<=i; j++) {
        if(history[j].highest > top) top = history[j].highest
      }
      history[i].donchianTop = top
    } else {
      history[i].donchianTop = Math.max(
        history[i-1].donchianTop,
        history[i].highest
      )
    }

    if(history[i-1].donchianBottom == history[Math.max(0, i-6)].lowest) {
      let j = Math.max(0, i-5)
      let bottom = history[j].lowest
      for(j++; j<=i; j++) {
        if(history[j].lowest < bottom) bottom = history[j].lowest
      }
      history[i].donchianBottom = bottom
    } else {
      history[i].donchianBottom = Math.min(
        history[i-1].donchianBottom,
        history[i].lowest
      )
    }
  }

  return history
}
