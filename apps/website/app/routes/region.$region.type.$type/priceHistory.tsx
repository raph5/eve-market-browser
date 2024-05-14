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
  }, [])

  return (
    <div className="price-history" ref={containerRef} />
  )
}
