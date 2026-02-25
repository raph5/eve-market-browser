import { HistoryDay } from "@app/esiStore/types";
import { Tooltip } from "./objects/tooltip";

export class GraphContext {

  history: HistoryDay[] = []  

  startDay = 0
  endDay = 0
  startPrice = 0
  endPrice = 0

  // @ts-ignore
  tooltip: Tooltip = {}

}
