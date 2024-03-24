import { esiStore } from "@app/.server/esiServerStore";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { MarketGroup } from "libs/esi-server-store/types";
import { createRecord } from "utils";
import "@scss/item-page.scss"
import EveIcon, { typeIconSrc } from "@components/eveIcon";
import { Tab, TabsRoot } from "@components/tabs";
import { ItemContext } from "./itemContext";
import MarketData from "./marketData";

export async function loader({ params }: LoaderFunctionArgs) {
  const regionArray = await esiStore.getRegions()
    .catch(() => {
      throw json("Can't Find Regions Data", { status: 500 })
    })

  const typeRecord = await esiStore.getTypes()
    .catch(() => {
      throw json("Can't Find Types Names", { status: 500 })
    })

  if(!params.type || !params.region) {
    throw json("Can't find type or region param", { status: 500 })
  }

  const marketGroups = await esiStore.getMarketGroups()
    .catch(() => {
      throw json("Can't Find Market Groups", { status: 500 })
    })

  const marketGroupRecord = createRecord(marketGroups, 'id')

  const type = parseInt(params.type)
  const region = parseInt(params.region)
  
  if(!typeRecord[type] || regionArray.findIndex(r => r.id == region) == -1) {
    throw json("Type or region params are not valid", { status: 500 })
  }

  function depthFirstSearch(group: MarketGroup, breadcrumbs: number[]): number[] | null {
    if(group.types.includes(type)) return breadcrumbs
    for(const gId of group.childsId) {
      const result = depthFirstSearch(marketGroupRecord[gId], [ ...breadcrumbs, gId ])
      if(result != null) return result
    }
    return null
  }

  let breadcrumbs: string[] = []
  const rootGroups = marketGroups.filter(g => !g.parentId)
  for(const g of rootGroups) {
    const result = depthFirstSearch(g, [g.id])
    if(result != null) {
      breadcrumbs = result.map(gId => marketGroupRecord[gId].name)
      break
    }
  }

  return json({
    type,
    region,
    regionArray,
    typeRecord,
    marketGroups,
    marketGroupRecord,
    breadcrumbs
  })
}

export default function Type() {
  const { type, region, regionArray, typeRecord, marketGroups, marketGroupRecord, breadcrumbs } = useLoaderData<typeof loader>()

  const tabs = [
    { value: 'marketData', label: 'Market Data' },
    { value: 'priceHistory', label: 'Price History' }
  ]

  return (
    <ItemContext.Provider value={{ type, region }}>
      <div className="item-page">
        <div className="item-header">
          <EveIcon className="item-header__icon" alt={`${typeRecord[type]} icon`} src={typeIconSrc(type)} />
          <div className="item-header__info">
            <span className="item-header__breadcrumbs">{breadcrumbs.join(' / ')}</span>
            <h2 className="item-header__name">{typeRecord[type]}</h2>
          </div>
        </div>
        <div className="item-body">
          <TabsRoot className="item-body__tabs" tabs={tabs} defaultValue="marketData">
            <Tab className="item-body__tab" value="marketData">
              <MarketData />
            </Tab>
            <Tab className="item-body__tab" value="priceHistory">
              <div className="price-history">
                Coming soon 🏗️
              </div>
            </Tab>
          </TabsRoot>
        </div>
      </div>
    </ItemContext.Provider>
  );
}