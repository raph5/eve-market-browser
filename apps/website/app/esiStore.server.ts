import type { HistoryDay } from "@app/esiStore/types"
import { readFile } from "node:fs/promises"
import { unixSocketFetch } from "./utils";

export interface Type {
  id: number
  name: string
  meta: number
}

export interface Region {
  id: number
  name: string
}

export interface MarketGroup {
  id: number
  parentId: number | null
  childsId: number[]
  name: string
  description: string
  types: number[]
  iconId: number
  iconAlt: string
}

export interface Location {
  Id: number,
  TypeId: number,
  OwnerId: number,
  SystemId: number,
  RegionId: number,
  Security: number,
  Name: string,
}

export interface Order {
  IsBuyOrder: boolean,
  Range: number,
  Duration: number,
  Issued: number,
  MinVolume: number,
  VolumeRemain: number,
  VolumeTotal: number,
  LocationId: number,
  SystemId: number,
  TypeId: number,
  RegionId: number,
  OrderId: number,
  Price: number,
}

export interface OrderDump {
  location: Record<string, Location>
  order: Order[]
  validity: number
}

const socketPath = "/tmp/emb.sock"

class EsiStore {

  public regions: Promise<Region[]>
  public marketGroups: Promise<MarketGroup[]>
  public types: Promise<Type[]>

  constructor(cacheFolder: string) {
    this.regions = readFile(`${cacheFolder}/regions.json`, { encoding: 'utf8' })
      .then(r => JSON.parse(r))
    this.marketGroups = readFile(`${cacheFolder}/market-group.json`, { encoding: 'utf8' })
      .then(mg => JSON.parse(mg))
    this.types = readFile(`${cacheFolder}/types.json`, { encoding: 'utf8' })
      .then(t => JSON.parse(t))
  }

  async getRegionName(regionId: number): Promise<string|null> {
    const regions = await this.regions
    for(let i=0; i<regions.length; i++) {
      if(regions[i].id == regionId) {
        return regions[i].name
      }
    }
    return null
  }

  async getTypeName(typeId: number): Promise<string|null> {
    const types = await this.types
    for(let i=0; i<types.length; i++) {
      if(types[i].id == typeId) {
        return types[i].name
      }
    }
    return null
  }

  async getOrderDump(typeId: number, regionId: number): Promise<OrderDump> {
    return unixSocketFetch(socketPath, `/order?region=${regionId}&type=${typeId}`)
      .then(res => JSON.parse(res))
  }

  async getHistory(typeId: number, regionId: number): Promise<HistoryDay[]> {
    return unixSocketFetch(socketPath, `/day-metric?region=${regionId}&type=${typeId}`)
      .then(res => JSON.parse(res))
  }
  
}

if(process.env.ESI_CACHE == undefined) {
  throw new Error("environnement variable ESI_CACHE is not defined")
}

export const esiStore = new EsiStore(process.env.ESI_CACHE as string)
