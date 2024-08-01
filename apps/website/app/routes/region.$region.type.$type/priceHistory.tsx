import { Graph } from "@lib/priceHistory/index"
import { useNavigate, useParams } from "@remix-run/react"
import { HistoryDay } from "esi-store/types"
import { useEffect, useRef } from "react"

export interface PriceHistoryProps {
  history: HistoryDay[]
  regionId: number
}

export function PriceHistory({ history, regionId }: PriceHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const params = useParams()
  const navigate = useNavigate()

  function setRegion(region: string) {
    navigate(params.type ? `/region/${region}/type/${params.type}` : `/region/${region}`)
  }

  useEffect(() => {
    if(regionId != 0) {
      if(containerRef.current == null) {
        console.error("cant initialize price history graph")
        return
      }
      const graph = new Graph(history, containerRef.current)
      return graph.destroy.bind(graph)
    }
  }, [history])

  return regionId == 0 ? (
    <div className="price-history__fallback">
      <p>Can't display the price history for All Regions</p>
      <button className="button button--corner-right" onClick={() => setRegion('10000002')}>Display The Forge</button>
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
