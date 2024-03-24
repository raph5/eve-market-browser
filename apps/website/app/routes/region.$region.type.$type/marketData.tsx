import { Suspense, useContext, useMemo } from "react"
import { ItemContext } from "./itemContext"
import { Table, TableBody, TableHead, TableRow } from "@components/table/table"
import { Order } from "esi-client-store/types"
import { getOrders } from "esi-client-store"
import { Await } from "@remix-run/react"

const SELL_COLUMNS = [
  { value: 'quantity', label: 'Quantity' },
  { value: 'price', label: 'Price' },
  { value: 'location', label: 'Location' },
  { value: 'expires', label: 'Expires in' },
]

export default function MarketData() {
  const { type, region } = useContext(ItemContext)

  const marketOrderPromise: Promise<Order[]> = useMemo(() => {
    if(!type || !region || typeof document === "undefined") return new Promise((resolve) => resolve([]))
    return getOrders(type, region)
  }, [type, region])

  return (
    <div className="market-data">
      <div className="market-data__section">
        <h3 className="market-data__heading">Sellers</h3>
        <Table>
          <TableHead columns={SELL_COLUMNS} />
          <TableBody>
            
            <Suspense>
              <Await resolve={marketOrderPromise}>

                {(marketOrders) => marketOrders.map(order => (
                  <TableRow key={order.order_id} row={{
                    quantity: order.volume_remain,
                    price: order.price,
                    location: "somewhere",
                    expires: "sometime"
                  }} />
                ))}

              </Await>
            </Suspense>

          </TableBody>
        </Table>
      </div>
      <div className="market-data__separator" role="separator"></div>
      <div className="market-data__section">
        <h3 className="market-data__heading">Buyers</h3>
      </div>
    </div>
  )
}