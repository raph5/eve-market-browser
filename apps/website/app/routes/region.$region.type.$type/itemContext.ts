import { createContext } from "react"

export interface ItemContextType {
  type: number|null
  region: number|null
}

export const ItemContext = createContext<ItemContextType>({ type: null, region: null })