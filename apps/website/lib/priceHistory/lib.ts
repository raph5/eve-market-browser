import { GraphContext } from "./context"
import { HistoryDay } from "esi-client-store/types";
import { GRAPH_PADDING_TOP, GRAPH_PADDING_X, HISTORY_HEIGHT } from "./var"
import { hitBox } from "./types"

export function isInHitBox(x: number, y: number, hitBox: hitBox) {
  return x >= hitBox[0] && x <= hitBox[2] && y >= hitBox[1] && y <= hitBox[3]
}

export function getGraphCoordinates(context: GraphContext, canvas: HTMLCanvasElement, dayIndex: number, price: number) {
  return [
    GRAPH_PADDING_X + (dayIndex - context.startDay) / (context.endDay - context.startDay) *
      (canvas.offsetWidth - 2*GRAPH_PADDING_X),
    canvas.offsetHeight - HISTORY_HEIGHT -
      (price - context.startPrice) / (context.endPrice - context.startPrice) *
      (canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP)
  ]
}

export function getGraphCoordinatesX(context: GraphContext, canvas: HTMLCanvasElement, dayIndex: number) {
  return GRAPH_PADDING_X + (dayIndex - context.startDay) / (context.endDay - context.startDay) *
    (canvas.offsetWidth - 2*GRAPH_PADDING_X)
}

export function getGraphCoordinatesY(context: GraphContext, canvas: HTMLCanvasElement, price: number) {
  return canvas.offsetHeight - HISTORY_HEIGHT -
    (price - context.startPrice) / (context.endPrice - context.startPrice) *
    (canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP)
}

export function formatPrice(price: number) {
  if(price < 1e2) {
    return price.toFixed(2)
  }
  if(price < 1e4) {
    return (price / 1e3).toFixed(2) + 'K'
  }
  if(price < 1e8) {
    return (price / 1e6).toFixed(2) + 'M'
  }
  if(price < 1e11) {
    return (price / 1e9).toFixed(2) + 'B'
  }
  return (price / 1e12).toFixed(2) + 'T'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatMonth(date: Date) {
  return MONTHS[date.getMonth()]
}

export function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

export function getMinMaxPrice(history: HistoryDay[], startDay: number, endDay: number) {
  let min = history[startDay].lowest
  let max = history[startDay].highest
  for(let i=startDay+1; i<endDay; i++) {
    if(history[i].lowest < min) min = history[i].lowest
    if(history[i].highest > max) max = history[i].highest
  }
  return [min, max]
}
