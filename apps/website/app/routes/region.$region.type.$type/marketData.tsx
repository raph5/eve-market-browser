import Table, { Cell, Column } from "@components/table"
import { Order } from "esi-store/types"
import { DAY, expiresIn, formatIsk, numberSort, stringSort } from "utils"

export interface MarketDataProps {
  orders: Order[]
  time: number
}

export default function MarketData({ orders, time }: MarketDataProps) {
  const sellColumns: Column[] = [
    { value: 'quantity', label: 'Quantity', sorting: numberSort() },
    { value: 'price', label: 'Price', sorting: numberSort() },
    { value: 'location', label: 'Location', sorting: stringSort() },
    { value: 'expires', label: 'Expires in', sorting: numberSort() },
  ]
  const buyColumns: Column[] = [
    { value: 'quantity', label: 'Quantity', sorting: numberSort() },
    { value: 'price', label: 'Price', sorting: numberSort() },
    { value: 'range', label: 'Range', sorting: stringSort() },
    { value: 'location', label: 'Location', sorting: stringSort() },
    { value: 'minVolume', label: 'Min Volume', sorting: numberSort() },
    { value: 'expires', label: 'Expires in', sorting: numberSort() },
  ]

  const sellData: Record<string, Cell>[] = orders.filter(order => !order.isBuyOrder).map(order => ({
    quantity: [ order.volumeRemain, order.volumeRemain ],
    price: [ order.price, formatIsk(order.price) ],
    location: [ order.location, order.location ],
    expires: [
      Date.parse(order.issued) - time + order.duration*DAY,
      expiresIn(order.issued, order.duration, time)
    ]
  }))
  const buyData: Record<string, Cell>[] = orders.filter(order => order.isBuyOrder).map(order => ({
    quantity: [ order.volumeRemain, order.volumeRemain ],
    price: [ order.price, formatIsk(order.price) ],
    location: [ order.location, order.location ],
    expires: [
      Date.parse(order.issued) - time + order.duration*DAY,
      expiresIn(order.issued, order.duration, time)
    ],
    range: [ order.range, order.range ],
    minVolume: [ order.minVolume, order.minVolume ]
  }))

  return (
    <div className="market-data">
      <div className="market-data__section">
        <h3 className="market-data__heading">Sellers</h3>
        <Table
          className="market-data__table"
          columns={sellColumns}
          data={sellData}
          columnTemplate="max-content max-content max-content max-content"
          defaultSorting={{ column: 'price', direction: 'ascending' }}
        />
      </div>
      <div className="market-data__separator" role="separator"></div>
      <div className="market-data__section">
        <h3 className="market-data__heading">Buyers</h3>
        <Table
          className="market-data__table"
          columns={buyColumns}
          data={buyData}
          columnTemplate="max-content max-content max-content max-content max-content max-content"
          defaultSorting={{ column: 'price', direction: 'descending' }}
        />
      </div>
    </div>
  )
}
