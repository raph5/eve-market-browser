import { GraphContext } from "./context"
import { HistoryDay } from "esi-store/types";
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
    return (price / 1e3).toFixed(2) + 'k'
  }
  if(price < 1e8) {
    return (price / 1e6).toFixed(2) + 'M'
  }
  if(price < 1e11) {
    return (price / 1e9).toFixed(2) + 'B'
  }
  return (price / 1e12).toFixed(2) + 'T'
}

export function formatInt(int: number) {
  if(int < 1e6) {
    return int
  }
  if(int < 1e9) {
    return Math.round(int / 1e3).toString() + 'k'
  }
  if(int < 1e12) {
    return Math.round(int / 1e6).toString() + 'M'
  }
  if(int < 1e15) {
    return Math.round(int / 1e9).toString() + 'B'
  }
  return Math.round(int / 1e12).toString() + 'T'
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

export function getStartEndPrice(history: HistoryDay[], startDay: number, endDay: number) {
  console.assert(startDay < endDay)
  const margin = Math.floor(0.1 * (endDay - startDay))
  // return the margin-th lowest and highest prices as start and end prices
  let highest = []
  let lowest = []
  for(let i=startDay; i<endDay; i++) {
    lowest.push(history[i].lowest)
    highest.push(history[i].highest)
  }
  highest = highest.sort((a, b) => b - a)
  lowest = lowest.sort((a, b) => a - b)
  return [lowest[margin], highest[margin]]
}

// As explained here, the JS api do not provide offsetX and offsetY properties
// on Touch objects. So I have to create my own TouchList
// https://github.com/w3c/touch-events/issues/62
export interface CustomTouch {
  offsetX: number
  offsetY: number
}
export function createCustomTouchList(event: TouchEvent, touchList: TouchList): CustomTouch[] {
  // @ts-ignore
  if(!event.target || !event.target.getBoundingClientRect) {
    throw new Error(`custom touchlist: event.target.getBoundingClientRect does not exist`)
  }
  // @ts-ignore
  const rect = event.target.getBoundingClientRect()
  if(!rect || !rect.left || !rect.top) {
    throw new Error(`custom touchlist: invalid bounding client rect`)
  }
  const customTouchList: CustomTouch[] = []
  for(let i = 0; i < touchList.length; i++) {
    customTouchList.push({
      offsetX: touchList[i].pageX - rect.left - window.scrollX,
      offsetY: touchList[i].pageY - rect.top - window.scrollY,
    })
  }
  return customTouchList
}
