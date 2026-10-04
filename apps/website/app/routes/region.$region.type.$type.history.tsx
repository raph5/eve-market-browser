import { DayMetric, esiStore } from "@app/esiStore.server"
import { ErrorMessage } from "@components/errorMessage"
import { Graph } from "@app/priceHistory"
import { LoaderFunctionArgs } from "@remix-run/node"
import { json, useFetcher, useLoaderData, useRouteError } from "@remix-run/react"
import { useEffect, useRef } from "react"
import type { loader as dayMetricLoader } from "./resource.day-metric";

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

  return json({ typeId, regionId })
}

export default function PriceHistory() {
  const { typeId, regionId } = useLoaderData<typeof loader>()
  const dayMetricsFetcher = useFetcher<typeof dayMetricLoader>()

  useEffect(() => {
    dayMetricsFetcher.load(`/resource/day-metric?type=${typeId}&region=${regionId}`)
  }, [typeId, regionId])

  if (dayMetricsFetcher.state == "idle" && dayMetricsFetcher.data) {
    if (dayMetricsFetcher.data.length < 2) {
      return (
        <div className="price-history__fallback">
          <p>No history data available</p>
        </div>
      );
    } else {
      return (
        <GraphComponent dayMetrics={dayMetricsFetcher.data} />
      );
    }
  } else {
    return (
      <div className="price-history__fallback">
        <p>Loading...</p>
      </div>
    );
  }
}

interface GraphComponentProps {
  dayMetrics: DayMetric[]
}

function GraphComponent({dayMetrics}: GraphComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if(containerRef.current == null) {
      console.error("cant initialize price history graph")
      return
    }
    const graph = new Graph(dayMetrics, containerRef.current)
    return graph.destroy.bind(graph)
  }, [dayMetrics])

  return (
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
