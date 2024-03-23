import { readCacheFile, writeCacheFile } from "./cache"
import { fetchMarketGroups, fetchRegions, fetchType, fetchTypes } from "./fetching"
import type { MarketGroup, Region, Type } from "./types"

const REGION_CACHE = 'regions'
const MARKET_GROUP_CACHE = 'market-group'
const TYPE_CACHE = 'types'

class EsiStore {

  constructor(
    private cacheFolder: string
  ) {}

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
    const cachedRegions = await readCacheFile(this.cacheFolder, REGION_CACHE)
    if(cachedRegions == null) return this.updateRegions()
    return JSON.parse(cachedRegions)
  }

  async updateMarketGroups(): Promise<MarketGroup[]> {
    console.log("⚙️ fetching groups")
    const groups = await fetchMarketGroups()
    await writeCacheFile(this.cacheFolder, MARKET_GROUP_CACHE, JSON.stringify(groups))
    return groups
  }

  async getMarketGroups(): Promise<MarketGroup[]> {
    const cachedRegions = await readCacheFile(this.cacheFolder, MARKET_GROUP_CACHE)
    if(cachedRegions == null) return this.updateMarketGroups()
    return JSON.parse(cachedRegions)
  }

  async updateTypes(): Promise<Record<string, string>> {
    console.log("⚙️ fetching types")
    const marketGroups = await this.getMarketGroups()
    const types = await fetchTypes(Object.values(marketGroups))
    await writeCacheFile(this.cacheFolder, TYPE_CACHE, JSON.stringify(types))
    return types
  }

  async getTypes(): Promise<Record<string, string>> {
    const jsonTypes = await readCacheFile(this.cacheFolder, TYPE_CACHE)
    if(jsonTypes == null) return this.updateTypes()
    return JSON.parse(jsonTypes)
  }

  async getTypeName(id: number): Promise<string> {
    const jsonTypes = await readCacheFile(this.cacheFolder, TYPE_CACHE)
    const types = jsonTypes ? JSON.parse(jsonTypes) : null
    if(!types || !types[id]) {
      const type = await fetchType(id)
      return type.name
    }
    return types[id]
  }

}

export default EsiStore