import { esiStore } from "@app/esiStore.server"
import { ErrorMessage } from "@components/errorMessage"
import Table, { Cell, Column } from "@components/table"
import { LoaderFunctionArgs } from "@remix-run/node"
import { Link, json, useLoaderData, useRouteError } from "@remix-run/react"
import { DAY, expiresIn, formatIsk, numberSort, stringSort } from "@app/utils"

export async function loader({ params }: LoaderFunctionArgs) {
  if(!params.type || !params.region) {
    throw json("Type or Region Not Found", { status: 404 })
  }

  let typeId: number
  let regionId: number
  try {
    typeId = parseInt(params.type)
    regionId = parseInt(params.region)
  } catch {
    throw json("Type or Region Not Found", { status: 404 })
  }

  const typeName = await esiStore.getTypeName(typeId)
  const regionName = regionId != 0 ? await esiStore.getRegionName(regionId) : "All Regions"
  if(!typeName || !regionName) {
    throw json("Type or Region Not Found", { status: 404 })
  }

  const orders = await esiStore.getOrders(typeId, regionId)
  const time = Date.now()

  return json({
    typeId,
    regionId,
    orders,
    time
  })
}

export default function MarketData() {
  const { orders, time } = useLoaderData<typeof loader>()

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

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}
