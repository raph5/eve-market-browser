import { Object2d } from "../types"
import { Graph } from "../index"
import { GraphContext } from "../context"
import { AVERAGE20D_COLOR } from "../var"
import { getGraphCoordinates } from "../lib"

export class Average20d implements Object2d {

  private context: GraphContext
  private canvas: HTMLCanvasElement

  constructor(
    graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas
  }

  draw(canvasCtx: CanvasRenderingContext2D) {
    canvasCtx.strokeStyle = AVERAGE20D_COLOR
    canvasCtx.beginPath()
    let [x, y] = getGraphCoordinates(this.context, this.canvas, 0, this.context.history[0].average_20d)
    canvasCtx.moveTo(x, y)
    for(let i=1; i<this.context.history.length; i++) {
      [x, y] = getGraphCoordinates(this.context, this.canvas, i, this.context.history[i].average_20d)
      canvasCtx.lineTo(x, y)
    }
    canvasCtx.stroke()
  }

}
