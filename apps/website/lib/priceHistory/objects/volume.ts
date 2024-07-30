import { Object2d } from "../types"
import { Graph } from "../index"
import { GraphContext } from "../context"
import { VOLUME_HOVER_COLOR, VOLUME_COLOR, GRAPH_PADDING_TOP, GRAPH_PADDING_X, HISTORY_HEIGHT, VOLUME_HEIGHT } from "../var"
import { formatDate, formatInt, getGraphCoordinatesX } from "../lib"

export class Volume implements Object2d {

  private context: GraphContext
  private canvas: HTMLCanvasElement
  private focusedDay = -1
  private tooltipX = -1
  private tooltipY = -1
  private tooltipHtml = ''
  private _maxVolume = -1
  private _width = -1

  constructor(
    graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas

    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this))
  }

  draw(canvasCtx: CanvasRenderingContext2D) {
    const startDay = Math.floor(this.context.startDay)
    const endDay = Math.ceil(this.context.endDay)+1
    this._maxVolume = this.context.history[startDay].volume
    for(let i=startDay+1; i<endDay; i++) {
      if(this.context.history[i].volume > this._maxVolume) {
        this._maxVolume = this.context.history[i].volume
      }
    }
    this._width = (this.canvas.offsetWidth - 2*GRAPH_PADDING_X) /
      (this.context.endDay - this.context.startDay) * 0.9

    canvasCtx.save()
    canvasCtx.beginPath()
    canvasCtx.rect(
      GRAPH_PADDING_X,
      GRAPH_PADDING_TOP,
      this.canvas.offsetWidth - 2*GRAPH_PADDING_X,
      this.canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP
    )
    canvasCtx.clip()

    let x, height
    for(let i=startDay; i<endDay; i++) {
      canvasCtx.fillStyle = this.focusedDay == i ? VOLUME_HOVER_COLOR : VOLUME_COLOR
      x = getGraphCoordinatesX(this.context, this.canvas, i) - this._width/2
      height = (this.context.history[i].volume / this._maxVolume) * VOLUME_HEIGHT
      canvasCtx.fillRect(
        x,
        this.canvas.offsetHeight - HISTORY_HEIGHT - height,
        this._width,
        height
      )
    }

    canvasCtx.restore()

    if(this.focusedDay != -1) {
      this.context.tooltip.display(this.tooltipX, this.tooltipY, this.tooltipHtml)
    }
  }

  onMouseMove(event: MouseEvent) {
    const day = Math.round(this.context.startDay + (event.offsetX - GRAPH_PADDING_X) /
        (this.canvas.offsetWidth - 2*GRAPH_PADDING_X) * (this.context.endDay - this.context.startDay))

    if(day < 0 || day > this.context.history.length-1) {
      this.focusedDay = -1
      return
    }

    const barX = getGraphCoordinatesX(this.context, this.canvas, day)
    const barY = this.canvas.offsetHeight - HISTORY_HEIGHT -
      (this.context.history[day].volume / this._maxVolume) * VOLUME_HEIGHT

    if(
      Math.abs(event.offsetX - barX) <= this._width/2 &&
      this.canvas.offsetHeight - HISTORY_HEIGHT >= event.offsetY &&
      barY <= event.offsetY
    ) {
      const { date, volume, orderCount } = this.context.history[day]
      this.focusedDay = day
      this.tooltipX = barX,
      this.tooltipY = barY,
      this.tooltipHtml = `
        ${formatDate(new Date(date))}<br>
        Volume : ${formatInt(volume)}<br>
        Orders : ${formatInt(orderCount)}
      `
    }
    else {
      this.focusedDay = -1
    }
  }

}
