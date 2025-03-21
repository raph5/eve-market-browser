import { HistoryDay } from "@app/esiStore/types"
import { GraphContext } from "./context"
import { HistoryBox } from "./objects/historyBox"
import { Object2d, ObjectHtml, hitBox } from "./types"
import { createCustomTouchList, getStartEndPrice, isInHitBox } from "./lib"
import { HistoryHandle } from "./objects/historyHandle"
import { HistoryBg } from "./objects/historyBg"
import { Average } from "./objects/average"
import { Average5d } from "./objects/average5d"
import { Average20d } from "./objects/average20d"
import { Donchian } from "./objects/donchian"
import { MinMax } from "./objects/minMax"
import { GraphBg } from "./objects/graphBg"
import { Volume } from "./objects/volume"
import { Tooltip } from "./objects/tooltip"

export class Graph {

  public canvas: HTMLCanvasElement
  public cursor: string|undefined
  public context: GraphContext

  private canvasCtx: CanvasRenderingContext2D
  private object2dStack: Object2d[]
  private objectHtmlStack: ObjectHtml[]

  private _isRuning = false
  private _resize: () => void
  private _mouseIn: boolean[]
  private _mouseX = 0
  private _mouseY = 0
  private _actualCursor = 'unset'

  constructor(
    history: HistoryDay[],
    private container: HTMLElement,
    autoStart: boolean = true
  ) {
    this.canvas = document.createElement('canvas')
    this.container.appendChild(this.canvas)

    // 2d context init
    const context = this.canvas.getContext('2d')
    if(context == null) throw new Error("can't get canvas context")
    this.canvasCtx = context

    // canvas size and style
    this.canvas.style.userSelect = "none"
    this.canvas.style.touchAction = "none"
    this.canvas.width = this.container.offsetWidth
    this.canvas.height = this.container.offsetHeight
    this._resize = this.handleResize.bind(this)
    window.addEventListener('resize', this._resize)

    // canvas event listener
    this.canvas.onmousemove = this.handleMouseMove.bind(this)
    this.canvas.onmouseout = this.handleMouseOut.bind(this)
    this.canvas.onclick = this.handleClick.bind(this)
    this.canvas.onmouseup = this.handleMouseUp.bind(this)
    this.canvas.onmousedown = this.handleMouseDown.bind(this)
    this.canvas.onwheel = this.handleWheel.bind(this)
    this.canvas.ontouchstart = this.handleTouchStart.bind(this)

    // html objects init
    const tooltip = new Tooltip(this.canvas)
    this.objectHtmlStack = [ tooltip ]
    for(const o of this.objectHtmlStack) {
      this.container.appendChild(o.el)
    }

    // context setup
    this.context = new GraphContext()
    this.context.history = history
    this.context.tooltip = tooltip
    this.context.startDay = Math.max(0, this.context.history.length-1 -
      Math.min(Math.ceil(0.1 * this.canvas.offsetWidth), 80))
    this.context.endDay = this.context.history.length-1
    const [startPrice, endPrice] = getStartEndPrice(history, this.context.startDay, this.context.endDay)
    this.context.startPrice = startPrice * 0.8
    this.context.endPrice = endPrice * 1.1

    // scene init
    this.object2dStack = [
      new GraphBg(this),
      new HistoryBg(this),
      new HistoryBox(this),
      new HistoryHandle(this, 'start'),
      new HistoryHandle(this, 'end'),
      new Volume(this),
      new Donchian(this),
      new Average20d(this),
      new Average5d(this),
      new MinMax(this),
      new Average(this),
    ]
    this._mouseIn = new Array(this.object2dStack.length).fill(false)

    // auto start
    if(autoStart) {
      this.start()
    }
  }

  setHistory(history: HistoryDay[]) {
    this.context.history = history
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
    this.objectHtmlStack.forEach(obj => obj.el.remove())
    this.object2dStack.forEach(obj => obj.destroy?.bind(obj))
    window.removeEventListener('resize', this._resize)
  }

  private render() {
    this.canvas.dispatchEvent(new Event('beforerender'))

    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    let cursor: string|undefined
    
    for(let i=0; i<this.object2dStack.length; i++) {
      this.object2dStack[i].draw(this.canvasCtx, this.canvas)

      if(
        this.cursor == undefined &&
        this.object2dStack[i].hitBox != undefined &&
        isInHitBox(this._mouseX, this._mouseY, this.object2dStack[i].hitBox as hitBox)
      ) {
        cursor = this.object2dStack[i].cursor
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

    this.canvas.dispatchEvent(new Event('afterrender'))

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
    let runMouseOverHandler = true
    let runMouseOutHandler = true
    for(let i=this.object2dStack.length-1; i>=0; i--) {
      if(this.object2dStack[i].hitBox == undefined) continue

      inHitBox = isInHitBox(event.offsetX, event.offsetY, this.object2dStack[i].hitBox as hitBox)

      if(inHitBox && this._mouseIn[i] == false) {
        if(runMouseOverHandler) {
          const rep = this.object2dStack[i].onMouseOver?.(event)
          if(rep == false) runMouseOverHandler = false
        }
        this._mouseIn[i] = true
      }
      else if(!inHitBox && this._mouseIn[i] == true) {
        if(runMouseOutHandler) {
          const rep = this.object2dStack[i].onMouseOut?.(event)
          if(rep == false) runMouseOutHandler = false
        }
        this._mouseIn[i] = false
      }
    }
  }

  private handleMouseOut(event: MouseEvent) {
    for(let i=this.object2dStack.length-1; i>=0; i--) {
      this.object2dStack[i].onMouseOut?.(event)
      this.object2dStack[i].onMouseUp?.(event)
      this._mouseIn[i] = false
    }
  }

  private handleClick(event: MouseEvent) {
    for(let i=this.object2dStack.length-1; i>=0; i--) {
      if(
        this.object2dStack[i].hitBox != undefined &&
        this.object2dStack[i].onClick != undefined &&
        isInHitBox(event.offsetX, event.offsetY, this.object2dStack[i].hitBox as hitBox)
      ) {
        // @ts-ignore
        const rep = this.object2dStack[i].onClick(event)
        if(rep == false) return
      }
    }
  }

  private handleMouseUp(event: MouseEvent) {
    for(let i=this.object2dStack.length-1; i>=0; i--) {
      if(
        this.object2dStack[i].hitBox != undefined &&
        this.object2dStack[i].onMouseUp != undefined &&
        isInHitBox(event.offsetX, event.offsetY, this.object2dStack[i].hitBox as hitBox)
      ) {
        // @ts-ignore
        const rep = this.object2dStack[i].onMouseUp(event)
        if(rep == false) return
      }
    }
  }

  private handleMouseDown(event: MouseEvent) {
    for(let i=this.object2dStack.length-1; i>=0; i--) {
      if(
        this.object2dStack[i].hitBox != undefined &&
        this.object2dStack[i].onMouseDown != undefined &&
        isInHitBox(event.offsetX, event.offsetY, this.object2dStack[i].hitBox as hitBox)
      ) {
        // @ts-ignore
        const rep = this.object2dStack[i].onMouseDown(event)
        if(rep == false) return
      }
    }
  }

  private handleWheel(event: WheelEvent) {
    event.preventDefault()
    for(let i=this.object2dStack.length-1; i>=0; i--) {
      if(
        this.object2dStack[i].hitBox != undefined &&
        this.object2dStack[i].onWheel != undefined &&
        isInHitBox(event.offsetX, event.offsetY, this.object2dStack[i].hitBox as hitBox)
      ) {
        // @ts-ignore
        const rep = this.object2dStack[i].onWheel(event)
        if(rep == false) return
      }
    }
  }

  private handleTouchStart(event: TouchEvent) {
    const ctl = createCustomTouchList(event, event.targetTouches)
    for(let i=this.object2dStack.length-1; i>=0; i--) {
      if(
        this.object2dStack[i].hitBox != undefined &&
        this.object2dStack[i].onTouchStart != undefined &&
        // NOTE: this condition could be improved by reimplementing a
        // targetTouches like api for graph elements. However for now I will
        // check if the first touch is in hitbox.
        isInHitBox(ctl[0].offsetX, ctl[0].offsetY, this.object2dStack[i].hitBox as hitBox)
      ) {
        // @ts-ignore
        const rep = this.object2dStack[i].onTouchStart(event)
        if(rep == false) return
      }
    }
  }

  private handleResize() {
    this.canvas.width = this.container.offsetWidth
    this.canvas.height = this.container.offsetHeight
  }

}
