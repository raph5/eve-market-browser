import { DayMetric } from "@app/esiStore.server";
import { Tooltip } from "./objects/tooltip";

export class GraphContext {

  history: DayMetric[] = []  

  startDay = 0
  endDay = 0
  startPrice = 0
  endPrice = 0

  // @ts-ignore
  tooltip: Tooltip = {}

}
