import { HistoryDay } from "esi-client-store/types";
import { AverageTooltip } from "./objects/averageTooltip";

export class GraphContext {

  history: HistoryDay[] = []  

  startDay = 0
  endDay = 0
  startPrice = 0
  endPrice = 0

  // @ts-ignore
  tooltip: AverageTooltip = {}

}
