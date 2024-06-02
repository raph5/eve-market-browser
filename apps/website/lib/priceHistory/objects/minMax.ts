import { Object2d } from "../types"
import { Graph } from "../index"
import { GraphContext } from "../context"
import { MINMAX_COLOR, GRAPH_PADDING_TOP, GRAPH_PADDING_X, HISTORY_HEIGHT } from "../var"
import { getGraphCoordinates, getGraphCoordinatesY } from "../lib"

export class MinMax implements Object2d {

  private context: GraphContext
  private canvas: HTMLCanvasElement

  constructor(
    graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas
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

    canvasCtx.fillStyle = MINMAX_COLOR
    let x, y1, y2
    for(let i=1; i<this.context.history.length; i++) {
      [x, y1] = getGraphCoordinates(this.context, this.canvas, i, this.context.history[i].highest)
      y2 = getGraphCoordinatesY(this.context, this.canvas, this.context.history[i].lowest)
      canvasCtx.fillRect(x, y1, 1, y2-y1)
    }

    canvasCtx.restore()
  }

}
