import { esiStore } from "@app/esiStore.server"
import { ErrorMessage } from "@components/errorMessage"
import { Graph } from "@lib/priceHistory"
import { LoaderFunctionArgs } from "@remix-run/node"
import { json, useLoaderData, useRouteError } from "@remix-run/react"
import { HistoryDay } from "libs/esi-store/types"
import { useEffect, useRef } from "react"

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

  const history = await esiStore.getHistory(typeId, regionId)

  return json({
    typeId,
    regionId,
    history
  })
}

export default function PriceHistory() {
  const { history } = useLoaderData<typeof loader>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if(history.length >= 2) {
      if(containerRef.current == null) {
        console.error("cant initialize price history graph")
        return
      }
      const graph = new Graph(history, containerRef.current)
      return graph.destroy.bind(graph)
    }
  }, [history])

  return history.length < 2 ? (
    <div className="price-history__fallback">
      <p>No history data available</p>
    </div>
  ) : (
    <div className="price-history">
      <div className="price-history__legend">
        <div className="price-history__label">
          <div className="price-history__avg-icon"></div>
          <div>Median Day Price</div>
        </div>
        <div className="price-history__label">
          <div className="price-history__minmax-icon"></div>
          <div>Min/Max</div>
        </div>
        <div className="price-history__label">
          <div className="price-history__avg5d-icon"></div>
          <div>Moving Avg. (5d)</div>
        </div>
        <div className="price-history__label">
          <div className="price-history__avg20d-icon"></div>
          <div>Moving Avg. (20d)</div>
        </div>
        <div className="price-history__label">
          <div className="price-history__donchian-icon"></div>
          <div>Donchian Channel</div>
        </div>
        <div className="price-history__label">
          <div className="price-history__volume-icon"></div>
          <div>Volume</div>
        </div>
      </div>
      <div className="price-history__container" ref={containerRef} />
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}
