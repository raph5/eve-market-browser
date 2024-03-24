import type { MarketGroup } from "esi-server-store/types";
import { createContext } from "react";

export interface NavContextType {
  marketGroupRecord: Record<string, MarketGroup>
  typeRecord: Record<string, string>
}

export const NavContext = createContext<NavContextType>({
  marketGroupRecord: {},
  typeRecord: {}
})