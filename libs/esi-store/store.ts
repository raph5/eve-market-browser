import { createRecord } from "utils"
import { readCacheFile, writeCacheFile } from "./cache"
import { fetchHistory, fetchMarketGroups, fetchOrders, fetchRegions, fetchTypes } from "./fetching"
import type { MarketGroup, Region, Type, Order, HistoryDay } from "./types"
import { requestStoreHistory, requestStoreOrders } from "./goStore"

const REGION_CACHE = 'regions'
const MARKET_GROUP_CACHE = 'market-group'
const TYPE_CACHE = 'types'


class EsiStore {

  public regions: Promise<Region[]>
  public marketGroups: Promise<MarketGroup[]>
  public types: Promise<Type[]>
  public marketGroupRecord: Promise<Record<string, MarketGroup>>
  public typeRecord: Promise<Record<string, Type>>

  constructor(
    private cacheFolder: string
  ) {
    this.regions = readCacheFile(this.cacheFolder, REGION_CACHE)
      .then(r => r ? JSON.parse(r) : this.updateRegions())

    this.marketGroups = readCacheFile(this.cacheFolder, MARKET_GROUP_CACHE)
      .then(mg => mg ? JSON.parse(mg) : this.updateMarketGroups())

    this.types = readCacheFile(this.cacheFolder, TYPE_CACHE)
      .then(t => t ? JSON.parse(t) : this.updateTypes())

    this.marketGroupRecord = this.marketGroups
      .then(mg => createRecord(mg, "id"))

    this.typeRecord = this.types
      .then(t => createRecord(t, "id"))
  }

  private async updateRegions(): Promise<Region[]> {
    console.log("⚙️ fetching regions")
    const regions = await fetchRegions()
    await writeCacheFile(this.cacheFolder, REGION_CACHE, JSON.stringify(regions))
    return regions
  }

  private async updateMarketGroups(): Promise<MarketGroup[]> {
    console.log("⚙️ fetching market groups")
    const groups = await fetchMarketGroups()
    await writeCacheFile(this.cacheFolder, MARKET_GROUP_CACHE, JSON.stringify(groups))
    return groups
  }

  private async updateTypes(): Promise<Type[]> {
    console.log("⚙️ fetching types")
    const marketGroups = await this.marketGroups
    const types = await fetchTypes(Object.values(marketGroups))
    await writeCacheFile(this.cacheFolder, TYPE_CACHE, JSON.stringify(types))
    return types
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
    const typeRecord = await this.typeRecord
    return typeRecord[typeId]?.name || null
  }

  async getOrders(typeId: number, regionId: number): Promise<Order[]> {
    try {
      return await requestStoreOrders(typeId, regionId)
    } catch(error) {
      console.log(error)
      return await fetchOrders(typeId, regionId)
    }
  }

  async getHistory(typeId: number, regionId: number): Promise<HistoryDay[]> {
    try {
      return await requestStoreHistory(typeId, regionId)
    } catch(error) {
      console.log(error)
      if(regionId != 0) {
        return await fetchHistory(typeId, regionId)
      } 
      throw error
    }
  }
  
}

export default EsiStore
