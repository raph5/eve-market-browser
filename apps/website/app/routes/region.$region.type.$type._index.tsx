import { esiStore } from "@app/esiStore.server"
import { ErrorMessage } from "@components/errorMessage"
import * as Table from "@components/table"
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

function formatSecurity(sec: number): string {
  return sec.toFixed(1);
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
  const sellOrder = orderDump.order.filter(o => !o.IsBuyOrder)
  const buyOrder = orderDump.order.filter(o => o.IsBuyOrder)

  const sellOrderValues: Record<string, Record<string, any>> = {}
  for (const o of sellOrder) {
    const location = orderDump.location[o.LocationId]
    sellOrderValues[o.OrderId] = {
      quantity: o.VolumeRemain,
      price: o.Price,
      location: `${location.Security} ${location.Name}`,
      expires: o.Issued - now + o.Duration*DAY,
    }
  }
  const buyOrderValues: Record<string, Record<string, any>> = {}
  for (const o of buyOrder) {
    const location = orderDump.location[o.LocationId]
    buyOrderValues[o.OrderId] = {
      quantity: o.VolumeRemain,
      price: o.Price,
      range: `${location.Security} ${location.Name}`,
      location: o.Issued - now + o.Duration*DAY,
      min: o.Range,
      expires: o.MinVolume,
    }
  }

  const buyColumnType: Record<string, 'number'|'string'> = {
    quantity: 'number',
    price: 'number',
    range: 'number',
    location: 'string',
    min: 'number',
    expires: 'number',
  }
  const sellColumnType: Record<string, 'number'|'string'> = {
    quantity: 'number',
    price: 'number',
    location: 'string',
    expires: 'number',
  }

  return (
    <div className="market-data">
      <div className="market-data__section">
        <h3 className="market-data__heading">Sellers</h3>
        <div className="market-data__table">
          <Table.Root
            columnType={sellColumnType}
            values={sellOrderValues}
            defaultSorting={{column: 'price', direction: 'ascending'}}
          >
            <Table.Row>
              <Table.Head column="quantity">Quantity</Table.Head>
              <Table.Head column="price">Price</Table.Head>
              <Table.Head column="location">Location</Table.Head>
              <Table.Head column="expires">Expires</Table.Head>
            </Table.Row>
            {sellOrder.map(o => {
              const location = orderDump.location[o.LocationId]
              return <Table.Row key={o.OrderId} rowId={o.OrderId}>
                <Table.Cell column="quantity">{o.VolumeRemain}</Table.Cell>
                <Table.Cell column="price">{formatIsk(o.Price)}</Table.Cell>
                <Table.Cell column="location">{`${location.Name} (${Math.round(location.Security * 10) / 10})`}</Table.Cell>
                <Table.Cell column="expires">{formatExpiresIn(o.Issued, o.Duration, now)}</Table.Cell>
              </Table.Row>
            })}
          </Table.Root>
        </div>
      </div>
      <div className="market-data__separator" role="separator"></div>
      <div className="market-data__section">
        <h3 className="market-data__heading">Buyers</h3>
        <div className="market-data__table">
          <Table.Root
            columnType={buyColumnType}
            values={buyOrderValues}
            defaultSorting={{column: 'price', direction: 'descending'}}
          >
            <Table.Row>
              <Table.Head column="quantity">Quantity</Table.Head>
              <Table.Head column="price">Price</Table.Head>
              <Table.Head column="range">Range</Table.Head>
              <Table.Head column="location">Location</Table.Head>
              <Table.Head column="min">Min</Table.Head>
              <Table.Head column="expires">Expires</Table.Head>
            </Table.Row>
            {buyOrder.map(o => {
              const location = orderDump.location[o.LocationId]
              return <Table.Row key={o.OrderId} rowId={o.OrderId}>
                <Table.Cell column="quantity">{o.VolumeRemain}</Table.Cell>
                <Table.Cell column="price">{formatIsk(o.Price)}</Table.Cell>
                <Table.Cell column="location">
                  <span className="security" data-sec={formatSecurity(location.Security)}>{formatSecurity(location.Security)}</span>                  
                  {location.Name}
                </Table.Cell>
                <Table.Cell column="range">{formatRange(o.Range)}</Table.Cell>
                <Table.Cell column="min">{o.MinVolume}</Table.Cell>
                <Table.Cell column="expires">{formatExpiresIn(o.Issued, o.Duration, now)}</Table.Cell>
              </Table.Row>
            })}
          </Table.Root>
        </div>
      </div>
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}
