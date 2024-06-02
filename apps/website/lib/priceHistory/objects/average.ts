import { Object2d, hitBox } from "../types"
import { Graph } from "../index"
import { GraphContext } from "../context"
import { AVERAGE_COLOR, GRAPH_PADDING_TOP, GRAPH_PADDING_X, HISTORY_HEIGHT } from "../var"
import { getGraphCoordinates } from "../lib"

export class Average implements Object2d {

  public hitBox: hitBox = [0, 0, 0, 0]

  private context: GraphContext
  private canvas: HTMLCanvasElement
  private focusedDay = -1

  constructor(
    graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas

    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this))
  }

  draw(canvasCtx: CanvasRenderingContext2D) {
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
    for(let i=1; i<this.context.history.length; i++) {
      [x, y] = getGraphCoordinates(this.context, this.canvas, i, this.context.history[i].average)
      canvasCtx.beginPath()
      if(this.focusedDay == i) {
        canvasCtx.fillStyle = '#fff'
        canvasCtx.arc(x, y, 4, 0, 2*Math.PI)
        canvasCtx.fill()
        canvasCtx.fillStyle = AVERAGE_COLOR
      } else {
        canvasCtx.arc(x, y, 3, 0, 2*Math.PI)
        canvasCtx.fill()
      }
    }

    canvasCtx.restore()
  }

  onMouseMove(event: MouseEvent) {
    const day = Math.round(this.context.startDay + (event.offsetX - GRAPH_PADDING_X) /
        (this.canvas.offsetWidth - 2*GRAPH_PADDING_X) * (this.context.endDay - this.context.startDay))

    if(day < 0 || day > this.context.history.length-1) {
      this.context.tooltip.hide()
      this.focusedDay = -1
      return
    }

    const [dotX, dotY] = getGraphCoordinates(this.context, this.canvas, day, this.context.history[day].average)
    const distanceToDot = Math.sqrt((event.offsetX - dotX)**2 + (event.offsetY - dotY)**2)
    if(distanceToDot < 6) {
      this.context.tooltip.display(dotX-46, dotY-70, this.context.history[day].average, this.context.history[day].date)
      this.focusedDay = day
      return
    }

    this.context.tooltip.hide()
    this.focusedDay = -1
  }
  
}
