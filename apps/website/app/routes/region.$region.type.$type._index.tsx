import { esiStore } from "@app/esiStore.server"
import { ErrorMessage } from "@components/errorMessage"
import Table, { Cell, Column } from "@components/table"
import { LoaderFunctionArgs } from "@remix-run/node"
import { json, useLoaderData, useRouteError } from "@remix-run/react"
import { numberSort, stringSort } from "@app/utils"

const DAY = 60*60*24
const HOUR = 60*60
const MINUTE = 60
const SECOND = 1

const formater = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 })
export function formatIsk(isk: number) {
  return `${formater.format(isk)} ISK`
}

function formatExpiresIn(issued: number, duration: number, now: number) {
  let diffTime = issued + duration * DAY - now
  if (diffTime < 0) return 'expired'
  
  const days = Math.floor(diffTime / DAY)
  diffTime -= days * DAY
  const hours = Math.floor(diffTime / HOUR)
  diffTime -= hours * HOUR
  const minutes = Math.floor(diffTime / MINUTE)
  diffTime -= minutes * MINUTE
  const seconds = Math.floor(diffTime / SECOND)

  return `${days}d ${hours}h ${minutes}m ${seconds}s`
}

function formatRange(range: number): string {
  switch (range) {
    case -2: return "Station"
    case -1: return "Solar System"
    case 0: return "Region"
    case 1: return "1 Jump"
    case 2: return "2 Jump"
    case 3: return "3 Jump"
    case 4: return "4 Jump"
    case 5: return "5 Jump"
    case 10: return "10 Jump"
    case 20: return "20 Jump"
    case 30: return "30 Jump"
    case 40: return "40 Jump"
    default: return "Unknown"
  }
}

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

  const orderDump = await esiStore.getOrderDump(typeId, regionId)
  const now = Date.now() / 1000

  return json({
    typeId,
    regionId,
    orderDump,
    now
  })
}

export default function MarketData() {
  const { orderDump, now } = useLoaderData<typeof loader>()

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

  const sellData: Record<string, Cell>[] = orderDump.order.filter(o => !o.IsBuyOrder).map(order => {
    const location = orderDump.location[order.LocationId]
    return {
      quantity: [ order.VolumeRemain, order.VolumeRemain ],
      price: [ order.Price, formatIsk(order.Price) ],
      location: [
        `${location.Security} ${location.Name}`,
        `${location.Name} (${Math.round(location.Security * 10) / 10})`
      ],
      expires: [
        order.Issued - now + order.Duration*DAY,
        formatExpiresIn(order.Issued, order.Duration, now)
      ]
    }
  })
  const buyData: Record<string, Cell>[] = orderDump.order.filter(o => o.IsBuyOrder).map(order => {
    const location = orderDump.location[order.LocationId]
    return {
      quantity: [ order.VolumeRemain, order.VolumeRemain ],
      price: [ order.Price, formatIsk(order.Price) ],
      location: [
        `${location.Security} ${location.Name}`,
        `${location.Name} (${Math.round(location.Security * 10) / 10})`
      ],
      expires: [
        order.Issued - now + order.Duration*DAY,
        formatExpiresIn(order.Issued, order.Duration, now)
      ],
      range: [ order.Range, formatRange(order.Range) ],
      minVolume: [ order.MinVolume, order.MinVolume ]
    }
  })

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
