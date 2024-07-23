import { Object2d } from "../types"
import { Graph } from "../index"
import { GraphContext } from "../context"
import { AVERAGE_COLOR, AVERAGE_HOVER_COLOR, GRAPH_PADDING_TOP, GRAPH_PADDING_X, HISTORY_HEIGHT } from "../var"
import { formatDate, formatPrice, getGraphCoordinates } from "../lib"

export class Average implements Object2d {

  private context: GraphContext
  private canvas: HTMLCanvasElement
  private focusedDay = -1
  private tooltipX = -1
  private tooltipY = -1
  private tooltipHtml = ''

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

    canvasCtx.save()
    canvasCtx.beginPath()
    canvasCtx.rect(
      GRAPH_PADDING_X,
      GRAPH_PADDING_TOP,
      this.canvas.offsetWidth - 2*GRAPH_PADDING_X,
      this.canvas.offsetHeight - HISTORY_HEIGHT - GRAPH_PADDING_TOP
    )
    canvasCtx.clip()

    canvasCtx.fillStyle = AVERAGE_COLOR
    let x, y
    for(let i=startDay; i<endDay; i++) {
      [x, y] = getGraphCoordinates(this.context, this.canvas, i, this.context.history[i].average)
      canvasCtx.beginPath()
      if(this.focusedDay == i) {
        canvasCtx.fillStyle = AVERAGE_HOVER_COLOR
        canvasCtx.arc(x, y, 4, 0, 2*Math.PI)
        canvasCtx.fill()
        canvasCtx.fillStyle = AVERAGE_COLOR
      } else {
        canvasCtx.arc(x, y, 3, 0, 2*Math.PI)
        canvasCtx.fill()
      }
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

    const [dotX, dotY] = getGraphCoordinates(this.context, this.canvas, day, this.context.history[day].average)
    const distanceToDot = Math.sqrt((event.offsetX - dotX)**2 + (event.offsetY - dotY)**2)
    if(distanceToDot < 6) {
      const { date, average } = this.context.history[day]
      this.focusedDay = day
      this.tooltipX = dotX,
      this.tooltipY = dotY,
      this.tooltipHtml = `${formatDate(new Date(date))}<br>${formatPrice(average)}`
    }
    else {
      this.focusedDay = -1
    }
  }
  
}
