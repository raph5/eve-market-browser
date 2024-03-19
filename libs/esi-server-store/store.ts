import { readCacheFile, writeCacheFile } from "./cache"
import { fetchMarketGroups, fetchRegions, fetchType } from "./fetching"
import type { MarketGroup, Region, Type } from "./types"

const REGION_CACHE = 'regions'
const MARKET_GROUP_CACHE = 'market-group'
const TYPE_CACHE = 'type'

/**
 * the esi store provide all the esi data that the backend need
 */
class EsiStore {

  constructor(
    private cacheFolder: string
  ) {}

  /**
   * fetch regions from esi
   * @return regions as unparsed json string
   */
  async updateRegions(): Promise<Record<string, Region>> {
    try {
      console.log("fetching regions")
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

  /**
   * try to find regions in cache and fetch it otherwise
   * @return regions as unparsed json string
   */
  async getRegions(): Promise<Record<string, Region>> {
    const cachedRegions = await readCacheFile(this.cacheFolder, REGION_CACHE)
    if(cachedRegions == null) return this.updateRegions()
    return JSON.parse(cachedRegions)
  }

  /**
   * fetch market group from esi
   * @return market group as unparsed json string
   */
  async updateMarketGroups(): Promise<Record<string, MarketGroup>> {
    try {
      console.log("fetching groups")
      const groups = await fetchMarketGroups()
      await writeCacheFile(this.cacheFolder, MARKET_GROUP_CACHE, JSON.stringify(groups))
      return groups
    }
    catch {
      console.warn("cant update market group data cache")
      const cachedRegions = await readCacheFile(this.cacheFolder, MARKET_GROUP_CACHE)
      if(cachedRegions == null) throw new Error("cant get market groups")
      return JSON.parse(cachedRegions)
    }
  }

  /**
   * try to find market groups in cache and fetch it otherwise
   * @return market groups as unparsed json string
   */
  async getMarketGroups(): Promise<Record<string, MarketGroup>> {
    const cachedRegions = await readCacheFile(this.cacheFolder, MARKET_GROUP_CACHE)
    if(cachedRegions == null) return this.updateMarketGroups()
    return JSON.parse(cachedRegions)
  }

  /**
   * try to find type in cache and fetch it otherwise
   * @param id type id
   * @returns { 'id': type_id, 'name' type_name }
   */
  async getType(id: number): Promise<Type> {
    const cachedType = await readCacheFile(this.cacheFolder, `${TYPE_CACHE}:${id}`)
    if(cachedType == null) {
      const type = await fetchType(id)
      writeCacheFile(this.cacheFolder, `${TYPE_CACHE}:${id}`, JSON.stringify(type))
      return type
    }
    const parsedType = JSON.parse(cachedType)
    return parsedType
  }

}

export default EsiStore