import { Graph } from "@lib/priceHistory/index"
import { useEffect, useMemo, useRef } from "react"

export interface PriceHistoryProps {}

export function PriceHistory({}: PriceHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if(containerRef.current == null) {
      console.error("cant initialize price history graph")
      return
    }

    const graph = new Graph(containerRef.current)
    return graph.destroy.bind(graph)
  }, [])

  return (
    <div className="price-history" ref={containerRef} />
  )
}
