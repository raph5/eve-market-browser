import { esiStore } from "@app/esiStore.server";
import { MetaFunction, json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useOutletContext, useRouteError } from "@remix-run/react";
import EveIcon, { typeIconSrc } from "@components/eveIcon";
import { Tab, TabsRoot } from "@components/tabs";
import { ErrorMessage } from "@components/errorMessage";
import { RegionContext } from "../region/route";
import { useContext, useEffect, useMemo, useState } from "react";
import MarketData from "./marketData";
import { PlusIcon } from "@radix-ui/react-icons";
import QuickbarContext from "@contexts/quickbarContext";
import "@scss/item-page.scss"
import { PriceHistory } from "./priceHistory";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if(!data || !data.regionName || !data.typeName) {
    return []
  }

  return [
    { title: `${data.typeName} in ${data.regionName} - EVE Market Browser` },
    { name: "description", content: `Explore real-time market data for ${data.typeName} in ${data.regionName} region of EVE Online. Track current prices, trends, and trade opportunities for a wide range of commodities, ships, modules, and more.` },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "https://evemarketbrowser.com/thumbnail.png" },
    { property: "og:image:type", content: "image/png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image:src", content: "https://evemarketbrowser.com/thumbnail.png" }
  ]
}

export async function loader({ params }: LoaderFunctionArgs) {
  const typeRecord = await esiStore.getTypeRecord()
    .catch(() => {
      throw json("Can't Find Types", { status: 500 })
    })

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
  const regionName = regionId == 0 ? "All Regions" : regions.find(r => r.id == regionId)?.name

  if(!typeName || !regionName) {
    throw json("Type or Region Not Found", { status: 404 })
  }

  const ordersPromise = esiStore.getOrders(typeId, regionId)
  const history = regionId == 0 ? [] : await esiStore.getHistory(typeId, regionId)
  const orders = await ordersPromise

  const time = Date.now()

  return json({
    typeId,
    typeName,
    regionId,
    regionName,
    orders,
    history,
    time
  })
}

export default function Type() {
  const { typeRecord, marketGroups, marketGroupsRecord } = useOutletContext<RegionContext>()
  const { regionId, typeId, orders, time, history } = useLoaderData<typeof loader>()
  const quickbar = useContext(QuickbarContext)
  const [inQuickbar, setInQuickbar] = useState(false)

  const breadcrumbs = useMemo(() => {
    const bc: string[] = []
    let group = marketGroups.find(g => g.types.includes(typeId))
    if(!group) return []
    while(group.parentId) {
      bc.unshift(group.name)
      group = marketGroupsRecord[group.parentId]
    }
    bc.unshift(group.name)
    return bc
  }, [typeId])

  const tabs = [
    { value: 'marketData', label: 'Market Data' },
    { value: 'priceHistory', label: 'Price History' }
  ]

  // To avoid hydration errors. I will never use react again
  useEffect(() => {
    setInQuickbar(quickbar.has(typeId))
  }, [quickbar.state])

  return (
    <div className="item-page">
      <div className="item-header">
        <EveIcon className="item-header__icon" alt={`${typeRecord[typeId]} icon`} src={typeIconSrc(typeId)} />
        <div className="item-header__info">
          <span className="item-header__breadcrumbs">{breadcrumbs.join(' / ')}</span>
          <h2 className="item-header__name">{typeRecord[typeId].name}</h2>
        </div>
        <div className="item-header__action">
          {inQuickbar ? (
            <button className="button button--corner-left item-header__button" onClick={() => quickbar.removeItem(typeId)}>
              <span>Remove From Quickbar</span>
            </button>
          ) : (
            <button className="button button--corner-left item-header__button" onClick={() => quickbar.addItem(typeId)}>
              <PlusIcon className="button__icon" />
              <span>Add To Quickbar</span>
            </button>
          )}
        </div>
      </div>
      <div className="item-body">
        <TabsRoot className="item-body__tabs" tabs={tabs} defaultValue="marketData">
          <Tab className="item-body__tab" value="marketData">
            <MarketData orders={orders} time={time} />
          </Tab>
          <Tab className="item-body__tab" value="priceHistory">
            <PriceHistory history={history} regionId={regionId} />
          </Tab>
        </TabsRoot>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}
