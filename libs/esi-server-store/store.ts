import { createRecord } from "utils"
import { readCacheFile, writeCacheFile } from "./cache"
import { fetchMarketGroups, fetchRegions, fetchTypes } from "./fetching"
import type { MarketGroup, Region, Type } from "./types"

const REGION_CACHE = 'regions'
const MARKET_GROUP_CACHE = 'market-group'
const TYPE_CACHE = 'types'

class EsiStore {

  public regions: null|Region[] = null
  public marketGroups: null|MarketGroup[] = null
  public types: null|Type[] = null

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
    try {
      console.log("⚙️ fetching regions")
      const regions = await fetchRegions()
      await writeCacheFile(this.cacheFolder, REGION_CACHE, JSON.stringify(regions))
      return regions
    }
    catch {
      console.warn("cant update region data cache")
      const cachedRegions = await readCacheFile(this.cacheFolder, REGION_CACHE)
      if(cachedRegions == null) throw new Error("cant get regions")
      return JSON.parse(cachedRegions)
    }
  }

  async getRegions(): Promise<Region[]> {
    if(this.regions == null) {
      const cachedRegions = await readCacheFile(this.cacheFolder, REGION_CACHE)
      if(cachedRegions == null) return this.updateRegions()
      this.regions = JSON.parse(cachedRegions) as Region[]
    }
    return this.regions
  }

  async updateMarketGroups(): Promise<MarketGroup[]> {
    console.log("⚙️ fetching groups")
    const groups = await fetchMarketGroups()
    await writeCacheFile(this.cacheFolder, MARKET_GROUP_CACHE, JSON.stringify(groups))
    return groups
  }

  async getMarketGroups(): Promise<MarketGroup[]> {
    if(this.marketGroups == null) {
      const cachedRegions = await readCacheFile(this.cacheFolder, MARKET_GROUP_CACHE)
      if(cachedRegions == null) return this.updateMarketGroups()
      this.marketGroups = JSON.parse(cachedRegions) as MarketGroup[]
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
      const jsonTypes = await readCacheFile(this.cacheFolder, TYPE_CACHE)
      if(jsonTypes == null) return this.updateTypes()
      this.types = JSON.parse(jsonTypes) as Type[]
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

}

export default EsiStore