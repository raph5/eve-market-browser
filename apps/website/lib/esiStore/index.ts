import { readCacheFile } from "./cache"
import type { MarketGroup, Region, Type, Order, HistoryDay } from "./types"
import { requestStoreHistory, requestStoreOrders } from "./goStore"

const REGION_CACHE = 'regions'
const MARKET_GROUP_CACHE = 'market-group'
const TYPE_CACHE = 'types'

class EsiStore {

  public regions: Promise<Region[]>
  public marketGroups: Promise<MarketGroup[]>
  public types: Promise<Type[]>

  constructor(
    private cacheFolder: string
  ) {
    this.regions = readCacheFile(this.cacheFolder, REGION_CACHE)
      .then(r => JSON.parse(r))
    this.marketGroups = readCacheFile(this.cacheFolder, MARKET_GROUP_CACHE)
      .then(mg => JSON.parse(mg))
    this.types = readCacheFile(this.cacheFolder, TYPE_CACHE)
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

  async getOrders(typeId: number, regionId: number): Promise<Order[]> {
    return await requestStoreOrders(typeId, regionId)
  }

  async getHistory(typeId: number, regionId: number): Promise<HistoryDay[]> {
    return await requestStoreHistory(typeId, regionId)
  }
  
}

export default EsiStore
