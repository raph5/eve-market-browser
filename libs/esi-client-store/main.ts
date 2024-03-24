import esiFetch from "esi-fetch"
import { Order } from "./types"


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