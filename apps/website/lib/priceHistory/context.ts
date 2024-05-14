import { HistoryDay } from "esi-client-store/types";

export class GraphContext {

  history: HistoryDay[] = []  

  startDay = 0
  endDay = 0
  startPrice = 0
  endPrice = 0

}
