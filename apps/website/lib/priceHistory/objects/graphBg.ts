import { clamp } from "utils/main";
import { Graph } from "..";
import { GraphContext } from "../context";
import { Object2d, hitBox } from "../types";
import { GRAPH_COLOR, GRAPH_LABEL_SPACING, GRAPH_LINE, GRAPH_LINE_ZERO, GRAPH_PADDING_TOP, GRAPH_PADDING_X, HISTORY_HEIGHT } from "../var";
import { createCustomTouchList, formatMonth, formatPrice } from "../lib";

const SCROLLX_SENSIVITY = 1 as const
const SCROLLY_SENSIVITY = 0.001 as const

const _LOG_OF_3SQRT_OF_1_OVER_10 = Math.log(0.1 ** (1/3))

export class GraphBg implements Object2d {

  public hitBox: hitBox = [0, 0, 0, 0]

  private context: GraphContext
  private canvas: HTMLCanvasElement

  private _maxPrice: number
  private _separators: [number, string][]
  private _grabX = 0
  private _grabY = 0
  private _grabStartDay = 0
  private _grabEndDay = 0
  private _grabStartPrice = 0
  private _grabEndPrice = 0
  private _grabbed = false
  private _pinchX1 = 0
  private _pinchY1 = 0
  private _pinchX2 = 0
  private _pinchY2 = 0
  private _pinchStartDay = 0
  private _pinchEndDay = 0
  private _pinchStartPrice = 0
  private _pinchEndPrice = 0
  private _pinched = 0  // the number of touches

  constructor(
    private graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas

    this._separators = []
    this._maxPrice = this.context.history[0].highest
    for(let i=0; i<this.context.history.length; i++) {
      const date = new Date(this.context.history[i].date)
      if(date.getDate() == 1) {
        this._separators.push([i, formatMonth(date)])
      }
      if(this.context.history[i].highest > this._maxPrice) {
        this._maxPrice = this.context.history[i].highest
      }
    }

    this.graph.canvas.addEventListener('mouseup', this.dragEnd.bind(this))
    this.graph.canvas.addEventListener('mouseout', this.dragEnd.bind(this))
    this.graph.canvas.addEventListener('mousemove', this.dragMove.bind(this))
    this.graph.canvas.addEventListener('touchend', this.pinchEnd.bind(this))
    this.graph.canvas.addEventListener('touchcancel', this.pinchEnd.bind(this))
    this.graph.canvas.addEventListener('touchmove', this.pinchMove.bind(this))
  }

  draw(canvasCtx: CanvasRenderingContext2D) {
    const deltaDays = this.context.endDay - this.context.startDay
    const deltaPrice = this.context.endPrice - this.context.startPrice
    const graphWidth = this.canvas.offsetWidth - 2*GRAPH_PADDING_X
    const graphHeight = this.canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP

    this.hitBox = [0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight - HISTORY_HEIGHT]

    // computation of scale
    const desiredLabelNumber = graphHeight / GRAPH_LABEL_SPACING
    const n = Math.round( Math.log(desiredLabelNumber / deltaPrice) / _LOG_OF_3SQRT_OF_1_OVER_10 )
    const scale = 2 ** Math.floor((n+2)/3) * 2 ** Math.floor((n+1)/3) * 2.5 ** Math.floor(n/3)

    canvasCtx.font = "14px evesansneue"
    canvasCtx.textAlign = "end"
    let gradPrice = Math.max(scale * Math.ceil(this.context.startPrice / scale), 0)
    let gradY
    while(gradPrice < this.context.endPrice) {
      if(gradPrice != 0 || this.context.startPrice < 0) {
        gradY = Math.floor(GRAPH_PADDING_TOP + (this.context.endPrice - gradPrice) / deltaPrice * graphHeight)
        canvasCtx.fillStyle = gradPrice == 0 ? GRAPH_LINE_ZERO : GRAPH_LINE
        canvasCtx.fillRect(GRAPH_PADDING_X, gradY, graphWidth, 1)
        canvasCtx.fillStyle = GRAPH_COLOR
        canvasCtx.fillText(formatPrice(gradPrice), GRAPH_PADDING_X-4, gradY+7)
      }
      gradPrice += scale
    }

    canvasCtx.textAlign = "center"
    let x
    for(let i=0; i<this._separators.length; i++) {
      if(this._separators[i][0] < this.context.startDay || this._separators[i][0] > this.context.endDay) continue
      x = Math.floor(GRAPH_PADDING_X + (this._separators[i][0] - this.context.startDay) / deltaDays * graphWidth)
      canvasCtx.fillStyle = GRAPH_LINE
      canvasCtx.fillRect(x, GRAPH_PADDING_TOP, 1, graphHeight)
      canvasCtx.fillStyle = GRAPH_COLOR
      canvasCtx.fillText(this._separators[i][1], x, GRAPH_PADDING_TOP - 4)
    }
  }

  dragStart(event: MouseEvent) {
    if(!this._grabbed) {
      this._grabX = event.offsetX
      this._grabY = event.offsetY
      this._grabStartDay = this.context.startDay
      this._grabEndDay = this.context.endDay
      this._grabStartPrice = this.context.startPrice
      this._grabEndPrice = this.context.endPrice
      this.graph.cursor = 'grabbing'
      this._grabbed = true
    }
  }

  dragEnd() {
    this._grabbed = false
    this.graph.cursor = undefined
  }

  dragMove(event: MouseEvent) {
    if(this._grabbed) {
      const deltaDays = this.context.endDay - this.context.startDay
      const grabDeltaDays = - (event.offsetX - this._grabX) /
        (this.canvas.offsetWidth - 2*GRAPH_PADDING_X) * deltaDays
      this.context.startDay = clamp(
        this._grabStartDay + grabDeltaDays,
        0,
        this.context.history.length-1 - deltaDays
      )
      this.context.endDay = clamp(
        this._grabEndDay + grabDeltaDays,
        deltaDays,
        this.context.history.length-1
      )

      const deltaPrice = this.context.endPrice - this.context.startPrice
      const grabDeltaPrice = (event.offsetY - this._grabY) /
        (this.canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP) * deltaPrice
      this.context.startPrice = clamp(
        this._grabStartPrice + grabDeltaPrice,
        -this._maxPrice,
        this._maxPrice*2 - deltaPrice
      )
      this.context.endPrice = clamp(
        this._grabEndPrice + grabDeltaPrice,
        -this._maxPrice + deltaPrice,
        this._maxPrice*2
      )
    }
  }

  pinchStart(event: TouchEvent) {
    const ctl = createCustomTouchList(event, event.targetTouches)
    if(ctl.length == 1) {
      this._pinchX1 = ctl[0].offsetX
      this._pinchY1 = ctl[0].offsetY
      this._pinchStartDay = this.context.startDay
      this._pinchEndDay = this.context.endDay
      this._pinchStartPrice = this.context.startPrice
      this._pinchEndPrice = this.context.endPrice
      this._pinched = 1
    }
    else if(ctl.length == 2) {
      this._pinchX1 = ctl[0].offsetX
      this._pinchY1 = ctl[0].offsetY
      this._pinchX2 = ctl[1].offsetX
      this._pinchY2 = ctl[1].offsetY
      this._pinchStartDay = this.context.startDay
      this._pinchEndDay = this.context.endDay
      this._pinchStartPrice = this.context.startPrice
      this._pinchEndPrice = this.context.endPrice
      this._pinched = 2
    }
    else {
      this._pinched = 0
    }
  }

  pinchEnd(event: TouchEvent) {
    if(event.targetTouches.length == 0) {
      this._pinched = 0
    }
  }

  pinchMove(event: TouchEvent) {
    event.preventDefault()
    const ctl = createCustomTouchList(event, event.targetTouches)
    if(this._pinched == 1 && ctl.length == 1) {
      const deltaDays = this.context.endDay - this.context.startDay
      const pinchDeltaDays = - (ctl[0].offsetX - this._pinchX1) /
        (this.canvas.offsetWidth - 2*GRAPH_PADDING_X) * deltaDays
      this.context.startDay = clamp(
        this._pinchStartDay + pinchDeltaDays,
        0,
        this.context.history.length-1 - deltaDays
      )
      this.context.endDay = clamp(
        this._pinchEndDay + pinchDeltaDays,
        deltaDays,
        this.context.history.length-1
      )

      const deltaPrice = this.context.endPrice - this.context.startPrice
      const pinchDeltaPrice = (ctl[0].offsetY - this._pinchY1) /
        (this.canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP) * deltaPrice
      this.context.startPrice = clamp(
        this._pinchStartPrice + pinchDeltaPrice,
        -this._maxPrice,
        this._maxPrice*2 - deltaPrice
      )
      this.context.endPrice = clamp(
        this._pinchEndPrice + pinchDeltaPrice,
        -this._maxPrice + deltaPrice,
        this._maxPrice*2
      )
    }
    else if(this._pinched == 2 && ctl.length == 2) {
      const minDeltaPrice = this._maxPrice / 200
      const deltaPricePinch = this._pinchEndPrice - this._pinchStartPrice
      const graphHeight = this.canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP
      const centerPrice = this._pinchEndPrice -
        ((this._pinchY1 + this._pinchY2)/2 - GRAPH_PADDING_TOP) / graphHeight * deltaPricePinch
      const ctlDist = Math.sqrt(
        (ctl[0].offsetX - ctl[1].offsetX)**2 +
        (ctl[0].offsetY - ctl[1].offsetY)**2
      )
      const pinchDist = Math.sqrt(
        (this._pinchX1 - this._pinchX2)**2 +
        (this._pinchY1 - this._pinchY2)**2
      )
      const gamma = pinchDist / ctlDist
      this.context.startPrice = clamp(
        centerPrice + (this._pinchStartPrice - centerPrice) * gamma,
        -this._maxPrice,
        centerPrice + (this._pinchStartPrice - centerPrice) / deltaPricePinch * minDeltaPrice
      )
      this.context.endPrice = clamp(
        centerPrice + (this._pinchEndPrice - centerPrice) * gamma,
        centerPrice + (this._pinchEndPrice - centerPrice) / deltaPricePinch * minDeltaPrice,
        2*this._maxPrice
      )
    }
    else {
      this._pinched = 0
    }
  }

  onWheel(event: WheelEvent) {
    const minDeltaPrice = this._maxPrice / 200
    const deltaPrice = this.context.endPrice - this.context.startPrice
    const graphHeight = this.canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP
    const mousePrice = this.context.endPrice - (event.offsetY - GRAPH_PADDING_TOP) / graphHeight * deltaPrice
    this.context.startPrice = clamp(
      mousePrice + (this.context.startPrice - mousePrice) * Math.exp(event.deltaY * SCROLLY_SENSIVITY),
      -this._maxPrice,
      mousePrice + (this.context.startPrice - mousePrice) / deltaPrice * minDeltaPrice
    )
    this.context.endPrice = clamp(
      mousePrice + (this.context.endPrice - mousePrice) * Math.exp(event.deltaY * SCROLLY_SENSIVITY),
      mousePrice + (this.context.endPrice - mousePrice) / deltaPrice * minDeltaPrice,
      2*this._maxPrice
    )

    const deltaDays = this.context.endDay - this.context.startDay
    const graphWidth = this.canvas.offsetWidth - 2*GRAPH_PADDING_X
    const wheelDeltaDays = event.deltaX / graphWidth * deltaDays * SCROLLX_SENSIVITY
    this.context.startDay = clamp(
      this.context.startDay + wheelDeltaDays,
      0,
      this.context.history.length-1 - deltaDays
    )
    this.context.endDay = clamp(
      this.context.endDay + wheelDeltaDays,
      deltaDays,
      this.context.history.length-1
    )
  }

  onMouseDown(event: MouseEvent) {
    this.dragStart(event)
  }

  onTouchStart(event: TouchEvent) {
    this.pinchStart(event)
  }

}
