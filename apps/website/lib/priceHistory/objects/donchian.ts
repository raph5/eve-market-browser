import { Object2d } from "../types"
import { Graph } from "../index"
import { GraphContext } from "../context"
import { DONCHIAN_COLOR, GRAPH_PADDING_TOP, GRAPH_PADDING_X, HISTORY_HEIGHT } from "../var"
import { getGraphCoordinates } from "../lib"

export class Donchian implements Object2d {

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

    canvasCtx.fillStyle = DONCHIAN_COLOR
    canvasCtx.beginPath()
    let [x, y] = getGraphCoordinates(this.context, this.canvas, 0, this.context.history[0].donchian_top)
    canvasCtx.moveTo(x, y)
    for(let i=1; i<this.context.history.length; i++) {
      [x, y] = getGraphCoordinates(this.context, this.canvas, i, this.context.history[i].donchian_top)
      canvasCtx.lineTo(x, y)
    }
    for(let i=this.context.history.length-1; i>=0; i--) {
      [x, y] = getGraphCoordinates(this.context, this.canvas, i, this.context.history[i].donchian_bottom)
      canvasCtx.lineTo(x, y)
    }
    canvasCtx.fill()

    canvasCtx.restore()
  }

}
