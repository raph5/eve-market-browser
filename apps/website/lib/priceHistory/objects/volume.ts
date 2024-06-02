import { Object2d } from "../types"
import { Graph } from "../index"
import { GraphContext } from "../context"
import { VOLUME_COLOR, GRAPH_PADDING_TOP, GRAPH_PADDING_X, HISTORY_HEIGHT, VOLUME_HEIGHT } from "../var"
import { getGraphCoordinatesX } from "../lib"

export class Volume implements Object2d {

  private context: GraphContext
  private canvas: HTMLCanvasElement

  constructor(
    graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas
  }

  draw(canvasCtx: CanvasRenderingContext2D) {
    const startDay = Math.floor(this.context.startDay)
    const endDay = Math.ceil(this.context.endDay)
    let maxVolume = this.context.history[startDay].volume
    for(let i=startDay+1; i<endDay; i++) {
      if(this.context.history[i].volume > maxVolume) {
        maxVolume = this.context.history[i].volume
      }
    }
    const width = (this.canvas.offsetWidth - 2*GRAPH_PADDING_X) /
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

    canvasCtx.fillStyle = VOLUME_COLOR
    let x, height
    for(let i=startDay; i<endDay; i++) {
      x = getGraphCoordinatesX(this.context, this.canvas, i) - width/2
      height = (this.context.history[i].volume / maxVolume) * VOLUME_HEIGHT
      canvasCtx.fillRect(
        x,
        this.canvas.offsetHeight - HISTORY_HEIGHT - height,
        width,
        height
      )
    }

    canvasCtx.restore()
  }

}
