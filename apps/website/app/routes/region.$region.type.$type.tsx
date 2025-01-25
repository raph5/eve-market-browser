import { esiStore } from "@app/esiStore.server";
import { MetaFunction, json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation, useMatches, useOutletContext, useRouteError } from "@remix-run/react";
import EveIcon, { typeIconSrc } from "@components/eveIcon";
import { ErrorMessage } from "@components/errorMessage";
import { RegionContext } from "./region/route";
import { useContext, useEffect, useMemo, useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import QuickbarContext from "@contexts/quickbarContext";
import "@scss/item-page.scss"
import { MarketGroup, Type as EsiType } from "@lib/esiStore/types";

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

  return json(
    { typeId, typeName, regionId, regionName },
  )
}

export default function Type() {
  const { marketGroups, types } = useOutletContext<RegionContext>()
  const { typeId, regionId } = useLoaderData<typeof loader>()
  const quickbar = useContext(QuickbarContext)
  const [inQuickbar, setInQuickbar] = useState(false)
  const matches = useMatches()
  const type = getType(types, typeId)

  const breadcrumbs = useMemo(() => computeBreadcrumbs(marketGroups, typeId), [marketGroups, typeId])

  // To avoid hydration errors
  useEffect(() => {
    console.log("ma man")
    setInQuickbar(quickbar.has(typeId))
  }, [typeId, quickbar.state])

  const dataTabState = (matches.at(-1)?.id == "routes/region.$region.type.$type._index") ? "active" : ""
  const historyTabState = (matches.at(-1)?.id == "routes/region.$region.type.$type.history") ? "active" : ""

  return (
    <div className="item-page">
      <div className="item-header">
        <EveIcon className="item-header__icon" alt={`${type.name} icon`} src={typeIconSrc(typeId)} />
        <div className="item-header__info">
          <span className="item-header__breadcrumbs">{breadcrumbs.join(' / ')}</span>
          <h2 className="item-header__name">{type.name}</h2>
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
        <div className="tabs item-body__tabs">
          <div className="tabs__list">
            <Link to={`/region/${regionId}/type/${typeId}`} className="tabs__trigger" data-state={dataTabState}>
              Market Data
            </Link>
            <Link to={`/region/${regionId}/type/${typeId}/history`} className="tabs__trigger" data-state={historyTabState}>
              Price History
            </Link>
          </div>
          <div className="tabs__content item-body__tab">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}

function computeBreadcrumbs(marketGroups: MarketGroup[], typeId: number): string[] {
  const bc: string[] = []

  let group = marketGroups.find(g => g.types.includes(typeId))
  if(group === undefined) return []

  while(group.parentId) {
    bc.unshift(group.name)
    // @ts-ignore
    group = marketGroups.find(g => g.id === group.parentId)
    if(group === undefined) return []
  }
  bc.unshift(group.name)

  return bc
}

function getType(types: EsiType[], typeId: number): EsiType {
  for(let i=0; i<types.length; i++) {
    if(types[i].id == typeId) {
      return types[i]
    }
  }
  throw Error(`Cant find type ${typeId} in types`)
}
