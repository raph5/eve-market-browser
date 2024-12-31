import { clamp } from "@lib/utils";
import { Graph } from "..";
import { GraphContext } from "../context";
import { Object2d, hitBox } from "../types";
import { HISTORY_HEIGHT, HISTORY_BACKGROUND, HISTORY_COLOR, HISTORY_CORNER_WIDTH, HISTORY_PADDING_TOP } from "../var";
import { createCustomTouchList } from "../lib";

export class HistoryBox implements Object2d {

  public hitBox: hitBox = [ 0, 0, 0, 0 ]
  public cursor: string = 'col-resize'

  private context: GraphContext
  private canvas: HTMLCanvasElement

  private _grabbed = false
  private _grabX = 0
  private _pinched = false
  private _pinchX = 0
  private _x = 0


  constructor(
    private graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas

    this.canvas.addEventListener('mouseup', this.dragEnd.bind(this))
    this.canvas.addEventListener('mouseout', this.dragEnd.bind(this))
    this.canvas.addEventListener('mousemove', this.dragMove.bind(this))
    this.canvas.addEventListener('touchend', this.pinchEnd.bind(this))
    this.canvas.addEventListener('touchcancel', this.pinchEnd.bind(this))
    this.canvas.addEventListener('touchmove', this.pinchMove.bind(this))
  }
  
  draw(canvasCtx: CanvasRenderingContext2D) {
    const x = this.context.startDay / (this.context.history.length-1) * this.canvas.offsetWidth
    const y = this.canvas.offsetHeight - HISTORY_HEIGHT + HISTORY_PADDING_TOP
    const width = (this.context.endDay - this.context.startDay) / (this.context.history.length-1) * this.canvas.offsetWidth
    const height = HISTORY_HEIGHT - HISTORY_PADDING_TOP
    this.hitBox = [x, y, x+width, y+height]
    this._x = x

    canvasCtx.fillStyle = HISTORY_BACKGROUND
    canvasCtx.strokeStyle = HISTORY_COLOR
    canvasCtx.lineWidth = 1
    canvasCtx.fillRect(x, y, width, height)
    canvasCtx.strokeRect(x+0.5, y+0.5, width-1, height-1)

    canvasCtx.fillStyle = HISTORY_COLOR
    canvasCtx.beginPath()
    canvasCtx.moveTo(x+1, y+1)
    canvasCtx.lineTo(x+1+HISTORY_CORNER_WIDTH, y+1)
    canvasCtx.lineTo(x+1, y+1+HISTORY_CORNER_WIDTH)
    canvasCtx.moveTo(x+width-1, y+1)
    canvasCtx.lineTo(x+width-1-HISTORY_CORNER_WIDTH, y+1)
    canvasCtx.lineTo(x+width-1, y+1+HISTORY_CORNER_WIDTH)
    canvasCtx.moveTo(x+1, y+height-1)
    canvasCtx.lineTo(x+1+HISTORY_CORNER_WIDTH, y+height-1)
    canvasCtx.lineTo(x+1, y+height-1-HISTORY_CORNER_WIDTH)
    canvasCtx.moveTo(x+width-1, y+height-1)
    canvasCtx.lineTo(x+width-1-HISTORY_CORNER_WIDTH, y+height-1)
    canvasCtx.lineTo(x+width-1, y+height-1-HISTORY_CORNER_WIDTH)
    canvasCtx.fill()

    canvasCtx.font = "14px evesansneue"
    canvasCtx.textAlign = "start"
    canvasCtx.fillText(Math.round(this.context.endDay - this.context.startDay).toString(), x+10, y+height-4)
  }

  dragStart(event: MouseEvent) {
    this.graph.cursor = 'col-resize'
    this._grabbed = true
    this._grabX = event.offsetX - this._x
  }

  dragMove(event: MouseEvent) {
    if(this._grabbed) {
      const deltaDays = this.context.endDay - this.context.startDay
      this.context.startDay = clamp(
        (event.offsetX - this._grabX) / this.canvas.offsetWidth * (this.context.history.length-1),
        0,
        this.context.history.length-1 - deltaDays
      )
      this.context.endDay = clamp(
        deltaDays + (event.offsetX - this._grabX) / this.canvas.offsetWidth * (this.context.history.length-1),
        deltaDays,
        this.context.history.length-1
      )
    }
  }

  dragEnd() {
    this.graph.cursor = undefined
    this._grabbed = false
  }

  pinchStart(event: TouchEvent) {
    const ctl = createCustomTouchList(event, event.targetTouches)
    if(ctl.length == 1) {
      this._pinched = true
      this._pinchX = ctl[0].offsetX - this._x
    }
    else {
      this._pinched = false
    }
  }

  pinchMove(event: TouchEvent) {
    const ctl = createCustomTouchList(event, event.targetTouches)
    if(this._pinched) {
      const deltaDays = this.context.endDay - this.context.startDay
      this.context.startDay = clamp(
        (ctl[0].offsetX - this._pinchX) / this.canvas.offsetWidth * (this.context.history.length-1),
        0,
        this.context.history.length-1 - deltaDays
      )
      this.context.endDay = clamp(
        deltaDays + (ctl[0].offsetX - this._pinchX) / this.canvas.offsetWidth * (this.context.history.length-1),
        deltaDays,
        this.context.history.length-1
      )
    }
  }

  pinchEnd() {
    this._pinched = false
  }

  onMouseDown(event: MouseEvent) {
    this.dragStart(event)
  }

  onTouchStart(event: TouchEvent) {
    this.pinchStart(event)
  }

}
