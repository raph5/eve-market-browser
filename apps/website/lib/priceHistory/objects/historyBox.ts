import { Graph } from "..";
import { GraphContext } from "../context";
import { Object2d, hitBox } from "../types";
import { HISTORY_BOX_HEIGHT, HISTORY_BOX_BACKGROUND, HISTORY_BOX_COLOR, HISTORY_CORNER_WIDTH } from "../var";

export class HistoryBox implements Object2d {

  private context: GraphContext
  private canvas: HTMLCanvasElement

  constructor(
    graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas
  }
  
  draw(canvasCtx: CanvasRenderingContext2D) {
    const x = this.context.startDay / (this.context.history.length-1) * this.canvas.offsetWidth
    const y = this.canvas.offsetHeight - HISTORY_BOX_HEIGHT
    const width = (this.context.endDay - this.context.startDay) / (this.context.history.length-1) * this.canvas.offsetWidth
    const height = HISTORY_BOX_HEIGHT

    canvasCtx.fillStyle = HISTORY_BOX_BACKGROUND
    canvasCtx.strokeStyle = HISTORY_BOX_COLOR
    canvasCtx.lineWidth = 1
    canvasCtx.fillRect(x, y, width, height)
    canvasCtx.strokeRect(x+0.5, y+0.5, width-1, height-1)

    canvasCtx.fillStyle = HISTORY_BOX_COLOR
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
  }

}
