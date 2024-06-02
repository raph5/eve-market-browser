import { clamp } from 'utils/main'
import { GraphContext } from '../context'
import { Graph } from '../index'
import { Object2d, hitBox } from '../types'
import { HISTORY_BACKGROUND, HISTORY_HEIGHT, HISTORY_HANDLE_WIDTH, HISTORY_PADDING_TOP } from '../var'

export class HistoryHandle implements Object2d {
  
  public hitBox: hitBox = [ 0, 0, 0, 0 ]
  public cursor: string = 'col-resize'
  
  private canvas: HTMLCanvasElement
  private context: GraphContext
  private color: string = 'transparent'

  private _grabbed = false
  private _grabX = 0
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
  }

  draw(canvasCtx: CanvasRenderingContext2D) {
    const width = HISTORY_HANDLE_WIDTH
    const height = HISTORY_HEIGHT - HISTORY_PADDING_TOP
    const y = this.canvas.offsetHeight - HISTORY_HEIGHT + HISTORY_PADDING_TOP
    const x = this.side == 'start'
      ? this.context.startDay / (this.context.history.length-1) * this.canvas.offsetWidth
      : this.context.endDay / (this.context.history.length-1) * this.canvas.offsetWidth - HISTORY_HANDLE_WIDTH
    this._x = x

    this.hitBox[0] = x
    this.hitBox[1] = y
    this.hitBox[2] = x+width
    this.hitBox[3] = y+height

    if(this.color != 'transparent') {
      canvasCtx.fillStyle = this.color
      canvasCtx.fillRect(x, y, width, height)
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
          Math.max( this.context.endDay - 24, 0 )
        )
      }
      else {
        this.context.endDay = clamp(
          (event.offsetX - this._grabX + HISTORY_HANDLE_WIDTH) / this.canvas.offsetWidth * (this.context.history.length-1),
          Math.min( this.context.startDay + 24, this.context.history.length-1 ),
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

  onMouseDown(event: MouseEvent) {
    this.dragStart(event)
    return false
  }

  onMouseUp() {
    this.dragEnd()
  }

  onMouseOver() {
    this.color = HISTORY_BACKGROUND
    this._mouseOver = true
  }

  onMouseOut() {
    this._mouseOver = false
    if(!this._grabbed) {
      this.color = 'transparent'
    }
  }

}
