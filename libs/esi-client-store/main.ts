import esiFetch from "esi-fetch"
import type { Meta, Order } from "./types"

export const T1: Meta = { name: 'Tech 1', iconSrc: '' }
export const T2: Meta = { name: 'Tech 2', iconSrc: '/meta-icon/t2.png' }
export const STORYLINE: Meta = { name: 'Storyline', iconSrc: '/meta-icon/storyline.png' }
export const FACTION: Meta = { name: 'Faction', iconSrc: '/meta-icon/faction.png' }
export const DEADSPACE: Meta = { name: 'Deadspace', iconSrc: '/meta-icon/deadspace.png' }
export const OFFICER: Meta = { name: 'Officer', iconSrc: '/meta-icon/officer.png' }

export async function getHistory(type: number, region: number): Promise<History> {
  console.log(`⚙️ fetching type:${type} history from region:${region}`)
  
  const history = await esiFetch(`/markets/${region}/history`, { type_id: type.toString() })
  if(history.error) throw new Error(`esi error : ${history.error}`)
  return history
}

export async function getOrders(type: number, region: number): Promise<Order[]> {
  console.log(`⚙️ fetching type:${type} orders from region:${region}`)

  let orders: any[] = []

  let page = 1
  while(true) {
    const ord = await esiFetch(`/markets/${region}/orders`, {
      type_id: type.toString(),
      order_type: 'all',
      page: page.toString()
    })

    if(ord.error) break
    orders = orders.concat(ord)
    if(ord.length != 1000) break
    page += 1
  }

  for(const o of orders) {
    o.order_type = o.is_buy_order ? 'buy' : 'sell'
    delete o.is_buy_order
  }

  return orders
}

export async function getNames(types: number[]): Promise<Record<string, string>> {
  const nameRecord: Record<string, string> = {}
  for(let i=0; i<types.length; i+=1000) {
    const namesChunk = await esiFetch('/universe/names', {}, types.slice(i, i+1000), 'POST')
    if(namesChunk.error) throw Error("Names fetching error : " + namesChunk.error)
    for(const { id, name } of namesChunk) {
      nameRecord[id] = name
    }
  }
  return nameRecord
}

export function getMeta(metaType: number): Meta {
  switch(metaType) {
    case 1 : return T1
    case 2 : return T2
    case 3 : return STORYLINE
    case 4 : return FACTION
    case 5 : return DEADSPACE
    case 6 : return OFFICER
    default : return T1
  }
}