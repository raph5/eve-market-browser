import { createRecord } from "utils"
import { readCacheFile, writeCacheFile } from "./cache"
import { fetchHistory, fetchMarketGroups, fetchOrders, fetchRegions, fetchTypes } from "./fetching"
import type { MarketGroup, Region, Type, Order, HistoryDay } from "./types"

const REGION_CACHE = 'regions'
const MARKET_GROUP_CACHE = 'market-group'
const TYPE_CACHE = 'types'


class EsiStore {

  public regions: null|Region[]|Promise<Region[]> = null
  public marketGroups: null|MarketGroup[]|Promise<MarketGroup[]> = null
  public types: null|Type[]|Promise<Type[]> = null

  public marketGroupRecord: null|Record<string, MarketGroup> = null
  public typeRecord: null|Record<string, Type> = null

  constructor(
    private cacheFolder: string
  ) {
    this.getRegions()
    this.getMarketGroups()
    this.getTypes()
  }

  async updateRegions(): Promise<Region[]> {
    console.log("⚙️ fetching regions")
    const regions = await fetchRegions()
    await writeCacheFile(this.cacheFolder, REGION_CACHE, JSON.stringify(regions))
    return regions
  }

  async getRegions(): Promise<Region[]> {
    if(this.regions == null) {
      const cachedRegions = await readCacheFile(this.cacheFolder, REGION_CACHE)
      if(cachedRegions == null) {
        this.regions = this.updateRegions()
        return this.regions
      }
      this.regions = JSON.parse(cachedRegions) as Region[]
    }
    return this.regions
  }

  async updateMarketGroups(): Promise<MarketGroup[]> {
    console.log("⚙️ fetching market groups")
    const groups = await fetchMarketGroups()
    await writeCacheFile(this.cacheFolder, MARKET_GROUP_CACHE, JSON.stringify(groups))
    return groups
  }

  async getMarketGroups(): Promise<MarketGroup[]> {
    if(this.marketGroups == null) {
      const cachedGroups = await readCacheFile(this.cacheFolder, MARKET_GROUP_CACHE)
      if(cachedGroups == null) {
        this.marketGroups = this.updateMarketGroups()
        return this.marketGroups
      }
      this.marketGroups = JSON.parse(cachedGroups) as MarketGroup[]
    }
    return this.marketGroups
  }

  async updateTypes(): Promise<Type[]> {
    console.log("⚙️ fetching types")
    const marketGroups = await this.getMarketGroups()
    const types = await fetchTypes(Object.values(marketGroups))
    await writeCacheFile(this.cacheFolder, TYPE_CACHE, JSON.stringify(types))
    return types
  }

  async getTypes(): Promise<Type[]> {
    if(this.types == null) {
      const cachedTypes = await readCacheFile(this.cacheFolder, TYPE_CACHE)
      if(cachedTypes == null) {
        this.types = this.updateTypes()
        return this.types
      }
      this.types = JSON.parse(cachedTypes) as Type[]
    }
    return this.types
  }

  async getMarketGroupRecord(): Promise<Record<string, MarketGroup>> {
    if(this.marketGroupRecord == null) {
      this.marketGroupRecord = createRecord(await this.getMarketGroups(), 'id')
    }
    return this.marketGroupRecord
  }

  async getTypeRecord(): Promise<Record<string, Type>> {
    if(this.typeRecord == null) {
      this.typeRecord = createRecord(await this.getTypes(), 'id')
    }
    return this.typeRecord
  }

  async getOrders(typeId: number, regionId: number): Promise<Order[]> {
    return fetchOrders(typeId, regionId)
  }

  async getHistory(typeId: number, regionId: number): Promise<HistoryDay[]> {
    return fetchHistory(typeId, regionId)
  }
  
}

export default EsiStore
