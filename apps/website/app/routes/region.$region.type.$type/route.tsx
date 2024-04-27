import { esiStore } from "@app/.server/esiServerStore";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useOutletContext, useRouteError } from "@remix-run/react";
import { removeDuplicates } from "utils";
import EveIcon, { typeIconSrc } from "@components/eveIcon";
import { Tab, TabsRoot } from "@components/tabs";
import { ErrorMessage } from "@components/errorMessage";
import { RegionContext } from "../region/route";
import { useContext, useMemo } from "react";
import { getNames, getOrders } from "esi-client-store/main";
import MarketData from "./marketData";
import { PlusIcon } from "@radix-ui/react-icons";
import QuickbarContext from "@contexts/quickbarContext";
import "@scss/item-page.scss"

export async function loader({ params }: LoaderFunctionArgs) {

  const types = await esiStore.getTypes()
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

  if(types.findIndex(t => t.id == typeId) == -1 || regions.findIndex(r => r.id == regionId) == -1) {
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

export default function Type() {
  const { typeRecord, marketGroups, marketGroupsRecord } = useOutletContext<RegionContext>()
  const { typeId, orders, locationRecord, time } = useLoaderData<typeof loader>()
  const { addToQuickbar, removeFromQuickbar, isInQuickbar } = useContext(QuickbarContext)

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

  return (
    <div className="item-page">
      <div className="item-header">
        <EveIcon className="item-header__icon" alt={`${typeRecord[typeId]} icon`} src={typeIconSrc(typeId)} />
        <div className="item-header__info">
          <span className="item-header__breadcrumbs">{breadcrumbs.join(' / ')}</span>
          <h2 className="item-header__name">{typeRecord[typeId].name}</h2>
        </div>
        <div className="item-header__action">
          {isInQuickbar(typeId) ? (
            <button className="button button--corner-left item-header__button" onClick={() => removeFromQuickbar(typeId)}>
              <span>Remove From Quickbar</span>
            </button>
          ) : (
            <button className="button button--corner-left item-header__button" onClick={() => addToQuickbar(typeId)}>
              <PlusIcon className="button__icon" />
              <span>Add To Quickbar</span>
            </button>
          )}
        </div>
      </div>
      <div className="item-body">
        <TabsRoot className="item-body__tabs" tabs={tabs} defaultValue="marketData">
          <Tab className="item-body__tab" value="marketData">
            <MarketData orders={orders} locationRecord={locationRecord} time={time} />
          </Tab>
          <Tab className="item-body__tab" value="priceHistory">
            <div className="price-history">
              Coming soon 🏗️
            </div>
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
