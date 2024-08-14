import { esiStore } from "@app/.server/esiServerStore"
import { ErrorMessage } from "@components/errorMessage"
import Table, { Cell, Column } from "@components/table"
import { LoaderFunctionArgs } from "@remix-run/node"
import { Link, json, useLoaderData, useRouteError } from "@remix-run/react"
import { getNames, getOrders } from "esi-client-store/main"
import { DAY, expiresIn, formatIsk, numberSort, removeDuplicates, stringSort } from "utils"

export async function loader({ params }: LoaderFunctionArgs) {
  // TODO: dont import all the typeRecord just to get one name !
  const typeRecord = await esiStore.getTypeRecord()
    .catch(() => {
      throw json("Can't Find Types", { status: 500 })
    })

  // TODO: dont import all regions just to get validate one input !
  const regions = await esiStore.getRegions()
    .catch(() => {
      throw json("Can't Find Regions", { status: 500 })
    })
  
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

  const typeName = typeRecord[typeId]?.name
  const regionName = regions.find((r: any)=> r.id == regionId)?.name

  if(!typeName || !regionName) {
    throw json("Type or Region Not Found", { status: 404 })
  }

  const orders = await getOrders(typeId, regionId)
  const locationRecord = await getNames(removeDuplicates(orders.map(o => o.location_id).filter(l => 60000000 < l && l < 64000000)))

  const time = Date.now()

  return json({
    typeId,
    regionId,
    orders,
    locationRecord,
    time
  })
}

export default function MarketData() {
  const { typeId, regionId, orders, locationRecord, time } = useLoaderData<typeof loader>()

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

  const sellData: Record<string, Cell>[] = orders.filter(order => order.order_type == 'sell').map(order => ({
    quantity: [ order.volume_remain, order.volume_remain ],
    price: [ order.price, formatIsk(order.price) ],
    location: [
      locationRecord[order.location_id] ?? 'Player Owned Structure',
      locationRecord[order.location_id] ?? 'Player Owned Structure'
    ],
    expires: [
      Date.parse(order.issued) - time + order.duration*DAY,
      expiresIn(order.issued, order.duration, time)
    ]
  }))
  const buyData: Record<string, Cell>[] = orders.filter(order => order.order_type == 'buy').map(order => ({
    quantity: [ order.volume_remain, order.volume_remain ],
    price: [ order.price, formatIsk(order.price) ],
    location: [
      locationRecord[order.location_id] ?? 'Player Owned Structure',
      locationRecord[order.location_id] ?? 'Player Owned Structure'
    ],
    expires: [
      Date.parse(order.issued) - time + order.duration*DAY,
      expiresIn(order.issued, order.duration, time)
    ],
    range: [ order.range, order.range ],
    minVolume: [ order.min_volume, order.min_volume ]
  }))

  return (
    <div className="tabs">
      <div className="tabs__list">
        <Link to={`/region/${regionId}/type/${typeId}/order`} className="tabs__trigger">Market Data</Link>
        <Link to={`/region/${regionId}/type/${typeId}/history`} className="tabs__trigger">Price History</Link>
      </div>
      <div className="tabs__content">
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
      </div>
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}
