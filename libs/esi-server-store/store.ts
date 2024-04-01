import { readCacheFile, writeCacheFile } from "./cache"
import { fetchMarketGroups, fetchRegions, fetchTypes } from "./fetching"
import type { MarketGroup, Region, Type } from "./types"

const REGION_CACHE = 'regions'
const MARKET_GROUP_CACHE = 'market-group'
const TYPE_CACHE = 'types'

class EsiStore {

  private typesPromise: null|Promise<Record<string, Type>> = null
  private regionsPromise: null|Promise<Region[]> = null
  private marketGroupsPromise: null|Promise<MarketGroup[]> = null

  constructor(
    private cacheFolder: string
  ) {}

  async updateRegions(): Promise<Region[]> {
    try {
      if(this.regionsPromise == null) {
        console.log("⚙️ fetching regions")
        this.regionsPromise = fetchRegions()
      }
      const regions = await this.regionsPromise
      this.regionsPromise = null
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
    const cachedRegions = await readCacheFile(this.cacheFolder, REGION_CACHE)
    if(cachedRegions == null) return this.updateRegions()
    return JSON.parse(cachedRegions)
  }

  async updateMarketGroups(): Promise<MarketGroup[]> {
    if(this.marketGroupsPromise == null) {
      console.log("⚙️ fetching groups")
      this.marketGroupsPromise = fetchMarketGroups()
    }
    const groups = await this.marketGroupsPromise
    this.marketGroupsPromise = null
    await writeCacheFile(this.cacheFolder, MARKET_GROUP_CACHE, JSON.stringify(groups))
    return groups
  }

  async getMarketGroups(): Promise<MarketGroup[]> {
    const cachedRegions = await readCacheFile(this.cacheFolder, MARKET_GROUP_CACHE)
    if(cachedRegions == null) return this.updateMarketGroups()
    return JSON.parse(cachedRegions)
  }

  async updateTypes(): Promise<Record<string, Type>> {
    const marketGroups = await this.getMarketGroups()
    if(this.typesPromise == null) {
      console.log("⚙️ fetching types")
      this.typesPromise = fetchTypes(Object.values(marketGroups))
    }
    const types = await this.typesPromise
    this.typesPromise = null 
    await writeCacheFile(this.cacheFolder, TYPE_CACHE, JSON.stringify(types))
    return types
  }

  async getTypes(): Promise<Record<string, Type>> {
    const jsonTypes = await readCacheFile(this.cacheFolder, TYPE_CACHE)
    if(jsonTypes == null) return this.updateTypes()
    return JSON.parse(jsonTypes)
  }

}

export default EsiStore