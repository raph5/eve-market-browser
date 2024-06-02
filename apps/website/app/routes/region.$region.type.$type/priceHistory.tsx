import { Graph } from "@lib/priceHistory/index"
import { HistoryDay } from "esi-client-store/types"
import { useEffect, useMemo, useRef } from "react"

export interface PriceHistoryProps {
  history: HistoryDay[]
}

export function PriceHistory({ history }: PriceHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if(containerRef.current == null) {
      console.error("cant initialize price history graph")
      return
    }
    const graph = new Graph(history, containerRef.current)
    return graph.destroy.bind(graph)
  }, [history])

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
