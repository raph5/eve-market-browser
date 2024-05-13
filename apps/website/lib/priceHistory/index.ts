import { GraphContext } from "./context"
import { HistoryBox } from "./objects/historyBox"
import { Square } from "./objects/square"
import { Object2d, hitBox } from "./types"
import { isInHitBox } from "./utils"

export class Graph {

  public canvas: HTMLCanvasElement
  public cursor: string|undefined
  public context: GraphContext

  private canvasCtx: CanvasRenderingContext2D
  private objectStack: Object2d[]

  private _isRuning = false
  private _resize: () => void
  private _mouseIn: boolean[]
  private _mouseX = 0
  private _mouseY = 0
  private _actualCursor = 'unset'

  constructor(
    private container: HTMLElement,
    autoStart: boolean = true
  ) {
    this.canvas = document.createElement('canvas')
    this.container.appendChild(this.canvas)

    // 2d context init
    const context = this.canvas.getContext('2d')
    if(context == null) throw new Error("can't get canvas context")
    this.canvasCtx = context

    // canvas size
    this.canvas.width = this.container.offsetWidth
    this.canvas.height = this.container.offsetHeight
    this._resize = (() => {
      this.canvas.width = this.container.offsetWidth
      this.canvas.height = this.container.offsetHeight
    }).bind(this)
    window.addEventListener('resize', this._resize)

    // canvas event listener
    this.canvas.onmousemove = this.handleMouseMove.bind(this)
    this.canvas.onmouseout = this.handleMouseOut.bind(this)
    this.canvas.onclick = this.handleClick.bind(this)
    this.canvas.onmouseup = this.handleMouseUp.bind(this)
    this.canvas.onmousedown = this.handleMouseDown.bind(this)

    // scene init
    this.context = new GraphContext()
    this.objectStack = [
      new HistoryBox(this),
      new Square(this, 100, 100, 50, 50, 'grey')
    ]
    this._mouseIn = new Array(this.objectStack.length).fill(false)

    // auto start
    if(autoStart) {
      this.start()
    }
  }

  start() {
    this._isRuning = true
    this.render()
  }

  stop() {
    this._isRuning = false
  }

  destroy() {
    this.stop()
    this.canvas.remove()
    this.objectStack.forEach(obj => obj.destroy?.bind(obj))
    window.removeEventListener('resize', this._resize)
  }

  private render() {
    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    let cursor: string|undefined
    
    for(let i=0; i<this.objectStack.length; i++) {
      this.objectStack[i].draw(this.canvasCtx, this.canvas)

      if(
        this.cursor == undefined &&
        this.objectStack[i].hitBox != undefined &&
        isInHitBox(this._mouseX, this._mouseY, this.objectStack[i].hitBox as hitBox)
      ) {
        cursor = this.objectStack[i].cursor
      }
    }

    if(this.cursor != undefined) {
      if(this.cursor != this._actualCursor) {
        this.canvas.style.cursor = this.cursor
        this._actualCursor = this.cursor
      }
    }
    else if(cursor != undefined) {
      if(cursor != this._actualCursor) {
        this.canvas.style.cursor = cursor
        this._actualCursor = cursor
      }
    }
    else {
      if(this._actualCursor != 'unset') {
        this.canvas.style.cursor = 'unset'
        this._actualCursor = 'unset'
      }
    }

    requestAnimationFrame(() => {
      if(this._isRuning) {
        this.render()
      }
    })
  }

  private handleMouseMove(event: MouseEvent) {
    this._mouseX = event.offsetX
    this._mouseY = event.offsetY
    
    let inHitBox: boolean
    for(let i=this.objectStack.length-1; i>=0; i--) {
      if(this.objectStack[i].hitBox == undefined) continue

      inHitBox = isInHitBox(event.offsetX, event.offsetY, this.objectStack[i].hitBox as hitBox)

      if(inHitBox && this._mouseIn[i] == false) {
        this.objectStack[i].onMouseOver?.(event)
        this._mouseIn[i] = true
      }
      else if(!inHitBox && this._mouseIn[i] == true) {
        this.objectStack[i].onMouseOut?.(event)
        this._mouseIn[i] = false
      }
    }
  }

  private handleMouseOut(event: MouseEvent) {
    for(let i=0; i<this.objectStack.length; i++) {
      this.objectStack[i].onMouseOut?.(event)
      this.objectStack[i].onMouseUp?.(event)
      this._mouseIn[i] = false
    }
  }

  private handleClick(event: MouseEvent) {
    for(let i=0; i<this.objectStack.length; i++) {
      if(
        this.objectStack[i].hitBox != undefined &&
        this.objectStack[i].onClick != undefined &&
        isInHitBox(event.offsetX, event.offsetY, this.objectStack[i].hitBox as hitBox)
      ) {
        // @ts-ignore
        this.objectStack[i].onClick(event)
      }
    }
  }

  private handleMouseUp(event: MouseEvent) {
    for(let i=0; i<this.objectStack.length; i++) {
      if(
        this.objectStack[i].hitBox != undefined &&
        this.objectStack[i].onMouseUp != undefined &&
        isInHitBox(event.offsetX, event.offsetY, this.objectStack[i].hitBox as hitBox)
      ) {
        // @ts-ignore
        this.objectStack[i].onMouseUp(event)
      }
    }
  }

  private handleMouseDown(event: MouseEvent) {
    for(let i=0; i<this.objectStack.length; i++) {
      if(
        this.objectStack[i].hitBox != undefined &&
        this.objectStack[i].onMouseDown != undefined &&
        isInHitBox(event.offsetX, event.offsetY, this.objectStack[i].hitBox as hitBox)
      ) {
        // @ts-ignore
        this.objectStack[i].onMouseDown(event)
      }
    }
  }

}
