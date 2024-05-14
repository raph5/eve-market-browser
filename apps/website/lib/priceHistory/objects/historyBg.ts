import { Graph } from "..";
import { GraphContext } from "../context";
import { Object2d } from "../types";
import { GRAPH_BACKGROUND, HISTORY_BOX_HEIGHT } from "../var";

export class HistoryBg implements Object2d {

  private context: GraphContext
  private canvas: HTMLCanvasElement

  private _maxAvg: number
  private _separators: number[]

  constructor(
    graph: Graph
  ) {
    this.context = graph.context
    this.canvas = graph.canvas

    this._maxAvg = this.context.history[0].average_5d
    this._separators = []
    for(let i=0; i<this.context.history.length; i++) {
      const date = new Date(this.context.history[i].date)
      if(date.getDate() == 1) {
        this._separators.push(i)
      }
      if(this.context.history[i].average_5d > this._maxAvg) {
        this._maxAvg = this.context.history[i].average_5d
      }
    }
  }

  draw(canvasCtx: CanvasRenderingContext2D) {
    canvasCtx.fillStyle = GRAPH_BACKGROUND

    canvasCtx.beginPath()
    canvasCtx.moveTo(0, this.canvas.offsetHeight)
    let y, x = 0
    for(let i=0; i<this.context.history.length; i++) {
      y = this.canvas.offsetHeight - this.context.history[i].average_5d / this._maxAvg * HISTORY_BOX_HEIGHT
      canvasCtx.lineTo(x, y)
      x = (i+1) / this.context.history.length * this.canvas.offsetWidth
      canvasCtx.lineTo(x, y)
    }
    canvasCtx.lineTo(this.canvas.offsetWidth, this.canvas.offsetHeight)
    canvasCtx.fill()
  
    for(let i=0; i<this._separators.length; i++) {
      canvasCtx.fillRect(
        this._separators[i] / this.context.history.length * this.canvas.offsetWidth,
        this.canvas.offsetHeight - HISTORY_BOX_HEIGHT,
        1,
        HISTORY_BOX_HEIGHT
      )
    }
  }

}
