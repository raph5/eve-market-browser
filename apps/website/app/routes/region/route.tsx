import { esiStore } from "@app/esiStore.server";
import { json } from "@remix-run/node";
import { MetaFunction, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import Navigation from "./navigation";
import { ErrorMessage } from "@components/errorMessage";
import { MarketGroup, Region, Type } from "@lib/esiStore/types";
import Header from "./header";
import { useQuickbar } from "@hooks/useQuickbar";
import QuickbarContext from "@contexts/quickbarContext";
import "@scss/app.scss"

export interface RegionContext {
  types: Type[]
  typeRecord: Record<string, Type>
  marketGroups: MarketGroup[]
  marketGroupsRecord: Record<string, MarketGroup>
  regions: Region[]
}

export const meta: MetaFunction = () => {
  return [
    { title: "EVE Market Browser" },
    { name: "description", content: "Explore real-time market data from EVE Online. Track current prices, trends, and trade opportunities for a wide range of commodities, ships, modules, and more." },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "https://evemarketbrowser.com/thumbnail.png" },
    { property: "og:image:type", content: "image/png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image:src", content: "https://evemarketbrowser.com/thumbnail.png" }
  ];
}

export async function loader() {
  const marketGroups = await esiStore.marketGroups
    .catch(() => {
      throw json("Can't Find Market Groups", { status: 500 })
    })

  const types = await esiStore.types
    .catch(() => {
      throw json("Can't Find Types", { status: 500 })
    })

  const regions = await esiStore.regions
    .catch(() => {
      throw json("Can't Find Regions", { status: 500 })
    })
    
  const marketGroupsRecord = await esiStore.marketGroupRecord
    .catch(() => {
      throw json("Can't Find Market Groups Record", { status: 500 })
    })

  const typeRecord = await esiStore.typeRecord
    .catch(() => {
      throw json("Can't Find Type Record", { status: 500 })
    })
  
  return json(
    { types, typeRecord, marketGroups, marketGroupsRecord, regions },
    { headers: { "Cache-Control": `public, s-maxage=${60*60*24*7}` } }
  )
}

export default function Layout() {
  const { types, typeRecord, marketGroups, marketGroupsRecord, regions } = useLoaderData<typeof loader>();
  const quickbar = useQuickbar(types, typeRecord)

  return (
    <QuickbarContext.Provider value={quickbar}>
      <div className="app">
        <Header regions={regions} />
        <Navigation types={types} typeRecord={typeRecord} marketGroups={marketGroups} marketGroupRecord={marketGroupsRecord} />
        <main>
          <Outlet context={{ types, typeRecord, marketGroups, marketGroupsRecord, regions }} />
        </main>
      </div>
    </QuickbarContext.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}
