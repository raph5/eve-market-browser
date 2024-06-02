import esiFetch from "esi-fetch"
import type { Meta, Order, HistoryDay } from "./types"


export const T1: Meta = {
  name: 'Tech 1',
  iconSrc: '',
  rarity: 1
}
export const T2: Meta = {
  name: 'Tech 2',
  iconSrc: '/meta-icons/t2.png',
  rarity: 2
}
export const FACTION_STORYLINE: Meta = {
  name: 'Faction & Storyline',
  iconSrc: '/meta-icons/faction.png',
  rarity: 3
}
export const DEADSPACE: Meta = {
  name: 'Deadspace',
  iconSrc: '/meta-icons/deadspace.png',
  rarity: 4
}
export const OFFICER: Meta = {
  name: 'Officer',
  iconSrc: '/meta-icons/officer.png',
  rarity: 5
}
export const RARITY_TO_META: Record<string, Meta> = {
  1: T1,
  2: T2,
  3: FACTION_STORYLINE,
  4: DEADSPACE,
  5: OFFICER
}

// TODO: refactor this all function
export async function getHistory(type: number, region: number): Promise<HistoryDay[]> {
  console.log(`⚙️ fetching type:${type} history from region:${region}`)
  
  const history = await esiFetch(`/markets/${region}/history`, { type_id: type.toString() })
  if(history.error) throw new Error(`esi error : ${history.error}`)

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
  history[0].average_5d = history[0].average
  history[0].average_20d = history[0].average
  history[0].donchian_top = history[0].highest
  history[0].donchian_bottom = history[0].lowest
  for(let i=1; i<history.length; i++) {
    history[i].average_5d = (
      6 * history[i-1].average_5d -
      history[Math.max(0, i-6)].average +
      history[i].average
    ) / 6

    history[i].average_20d = (
      21 * history[i-1].average_20d -
      history[Math.max(0, i-21)].average +
      history[i].average
    ) / 21

    if(history[i-1].donchian_top == history[Math.max(0, i-6)].highest) {
      let j = Math.max(0, i-5)
      let top = history[j].highest
      for(j++; j<=i; j++) {
        if(history[j].highest > top) top = history[j].highest
      }
      history[i].donchian_top = top
    } else {
      history[i].donchian_top = Math.max(
        history[i-1].donchian_top,
        history[i].highest
      )
    }

    if(history[i-1].donchian_bottom == history[Math.max(0, i-6)].lowest) {
      let j = Math.max(0, i-5)
      let bottom = history[j].lowest
      for(j++; j<=i; j++) {
        if(history[j].lowest < bottom) bottom = history[j].lowest
      }
      history[i].donchian_bottom = bottom
    } else {
      history[i].donchian_bottom = Math.min(
        history[i-1].donchian_bottom,
        history[i].lowest
      )
    }
  }

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
    case 3 : return FACTION_STORYLINE
    case 4 : return FACTION_STORYLINE
    case 5 : return DEADSPACE
    case 6 : return OFFICER
    default : return T1
  }
}
