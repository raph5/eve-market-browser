import { Graph } from "..";
import { Object2d, hitBox } from "../types";

export class Square implements Object2d {

  public hitBox: hitBox
  public cursor = 'grab'

  private _initColor: string
  private _grabX = 0
  private _grabY = 0
  private _grabbed = false

  constructor(
    private graph: Graph,
    public x: number,
    public y: number,
    public width: number,
    public heigth: number,
    public color: string
  ) {
    this.hitBox = [ x, y, x + width, y + heigth ]
    this._initColor = color
    this.graph.canvas.addEventListener('mouseup', this.dragEnd.bind(this))
    this.graph.canvas.addEventListener('mouseout', this.dragEnd.bind(this))
    this.graph.canvas.addEventListener('mousemove', this.dragMove.bind(this))
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.hitBox = [ this.x, this.y, this.x + this.width, this.y + this.heigth ]
    ctx.fillStyle = this.color
    ctx.fillRect(this.x, this.y, this.width, this.heigth)
  }

  dragStart(event: MouseEvent) {
    if(!this._grabbed) {
      this._grabX = event.offsetX - this.x
      this._grabY = event.offsetY - this.y
      this.graph.cursor = 'grabbing'
      this._grabbed = true
    }
  }

  dragEnd() {
    this._grabbed = false
    this.graph.cursor = undefined
  }

  dragMove(event: MouseEvent) {
    if(this._grabbed) {
      this.x = event.offsetX - this._grabX
      this.y = event.offsetY - this._grabY
    }
  }

  onMouseDown(event: MouseEvent) {
    this.dragStart(event)
  }
  
  onMouseOver() {
    this.color = "#00f"
  }

  onMouseOut() {
    this.color = this._initColor
  }

}
