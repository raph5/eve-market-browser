import esiFetch from "esi-fetch"
import { Order } from "./types"


export async function getHistory(type: number, region: number): Promise<History> {
  const history = await esiFetch(`/markets/${region}/history`, { type_id: type.toString() })
  if(history.error) throw new Error(`esi error : ${history.error}`)
  return history
}

export async function getOrders(type: number, region: number): Promise<Order[]> {
  let orders: any[] = []

  let page = 1
  while(true) {
    const o = await esiFetch(`/markets/${region}/orders`, {
      type_id: type.toString(),
      order_type: 'all',
      page: page.toString()
    })

    if(o.error) break
    orders = orders.concat(o)
    if(o.length != 1000) break
    page += 1
  }

  for(const o of orders) {
    o.order_type = o.is_buy_order ? 'buy' : 'sell'
    delete o.is_buy_order
  }

  return orders
}