import { MarketTreeRef } from "@app/routes/region/marketTree"
import { createContext } from "react"

export type MarketTreeContextType = MarketTreeRef

const MarketTreeContext = createContext<MarketTreeContextType>({
  openGroup: () => {},
  openType: () => {},
})

export default MarketTreeContext
