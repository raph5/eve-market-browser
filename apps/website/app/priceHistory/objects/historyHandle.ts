import { clamp } from '@app/utils'
import { GraphContext } from '../context'
import { Graph } from '../index'
import { Object2d, hitBox } from '../types'
import { HISTORY_BACKGROUND, HISTORY_HEIGHT, HISTORY_HANDLE_WIDTH, HISTORY_PADDING_TOP, GRAPH_MIN_WIDTH, HISTORY_HANDLE_HITBOX_WIDTH, HISTORY_HANDLE_COLOR } from '../var'
import { createCustomTouchList } from '../lib'

export class HistoryHandle implements Object2d {
  
  public hitBox: hitBox = [ 0, 0, 0, 0 ]
  public cursor: string = 'col-resize'
  
  private canvas: HTMLCanvasElement
  private context: GraphContext
  private color: string = 'transparent'

  private _grabbed = false
  private _grabX = 0
  private _pinched = false
  private _pinchX = 0
  private _x = 0
  private _mouseOver = false

  constructor(
    private graph: Graph,
    public side: 'start'|'end'
  ) {
    this.canvas = graph.canvas
    this.context = graph.context

    this.canvas.addEventListener('mouseup', this.dragEnd.bind(this))
    this.canvas.addEventListener('mouseout', this.dragEnd.bind(this))
    this.canvas.addEventListener('mousemove', this.dragMove.bind(this))
    this.canvas.addEventListener('touchend', this.pinchEnd.bind(this))
    this.canvas.addEventListener('touchcancel', this.pinchEnd.bind(this))
    this.canvas.addEventListener('touchmove', this.pinchMove.bind(this))
  }

  draw(canvasCtx: CanvasRenderingContext2D) {
    const y = this.canvas.offsetHeight - HISTORY_HEIGHT + HISTORY_PADDING_TOP
    const x = this.side == 'start'
      ? this.context.startDay / (this.context.history.length-1) * this.canvas.offsetWidth
      : this.context.endDay / (this.context.history.length-1) * this.canvas.offsetWidth - HISTORY_HANDLE_WIDTH
    this._x = x

    this.hitBox[0] = x
    this.hitBox[1] = y
    this.hitBox[2] = x+HISTORY_HANDLE_HITBOX_WIDTH
    this.hitBox[3] = y+HISTORY_HEIGHT-HISTORY_PADDING_TOP

    if(this.color != 'transparent') {
      canvasCtx.fillStyle = this.color
      canvasCtx.fillRect(x, y, HISTORY_HANDLE_WIDTH, HISTORY_HEIGHT-HISTORY_PADDING_TOP)
    }
  }

  dragStart(event: MouseEvent) {
    this.graph.cursor = 'col-resize'
    this._grabbed = true
    this._grabX = event.offsetX - this._x
  }

  dragMove(event: MouseEvent) {
    if(this._grabbed) {
      if(this.side == 'start') {
        this.context.startDay = clamp(
          (event.offsetX - this._grabX) / this.canvas.offsetWidth * (this.context.history.length-1),
          0,
          Math.max( this.context.endDay - GRAPH_MIN_WIDTH, 0 )
        )
      }
      else {
        this.context.endDay = clamp(
          (event.offsetX - this._grabX + HISTORY_HANDLE_WIDTH) / this.canvas.offsetWidth * (this.context.history.length-1),
          Math.min( this.context.startDay + GRAPH_MIN_WIDTH, this.context.history.length-1 ),
          this.context.history.length-1
        )
      }
    }
  }

  dragEnd() {
    this.graph.cursor = undefined
    this._grabbed = false
    if(!this._mouseOver) {
      this.color = 'transparent'
    }
  }

  pinchStart(event: TouchEvent) {
    const ctl = createCustomTouchList(event, event.targetTouches)
    if(ctl.length == 1) {
      this._pinched = true
      this._pinchX = ctl[0].offsetX - this._x
      this.color = HISTORY_HANDLE_COLOR
    }
  }

  pinchMove(event: TouchEvent) {
    const ctl = createCustomTouchList(event, event.targetTouches)
    if(this._pinched) {
      if(this.side == 'start') {
        this.context.startDay = clamp(
          (ctl[0].offsetX - this._pinchX) / this.canvas.offsetWidth * (this.context.history.length-1),
          0,
          Math.max( this.context.endDay - GRAPH_MIN_WIDTH, 0 )
        )
      }
      else {
        this.context.endDay = clamp(
          (ctl[0].offsetX - this._pinchX + HISTORY_HANDLE_WIDTH) / this.canvas.offsetWidth * (this.context.history.length-1),
          Math.min( this.context.startDay + GRAPH_MIN_WIDTH, this.context.history.length-1 ),
          this.context.history.length-1
        )
      }
    }
  }

  pinchEnd() {
    this._pinched = false
    this.color = 'transparent'
  }

  onMouseDown(event: MouseEvent) {
    this.dragStart(event)
    return false
  }

  onMouseUp() {
    this.dragEnd()
  }

  onMouseOver() {
    this.color = HISTORY_HANDLE_COLOR 
    this._mouseOver = true
  }

  onMouseOut() {
    this._mouseOver = false
    if(!this._grabbed) {
      this.color = 'transparent'
    }
  }

  onTouchStart(event: TouchEvent) {
    this.pinchStart(event)
    return false
  }

}
