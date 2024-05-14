import { GraphContext } from "./context"
import { HISTORY_BOX_HEIGHT } from "./var"

export function getGraphCoordinates(context: GraphContext, canvas: HTMLCanvasElement, dayIndex: number, price: number) {
  return [
    (dayIndex - context.startDay) / (context.endDay - context.startDay) * canvas.offsetWidth,
    canvas.offsetHeight - HISTORY_BOX_HEIGHT - (price - context.startPrice) / (context.endPrice - context.startPrice) * (canvas.offsetHeight - HISTORY_BOX_HEIGHT)
  ]
}
