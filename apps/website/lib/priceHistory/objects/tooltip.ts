import { ObjectHtml } from "../types";

export class Tooltip implements ObjectHtml {

  public el: HTMLElement

  private visible = false

  constructor(canvas: HTMLCanvasElement) {
    this.el = document.createElement('div')
    this.el.className = 'price-history__tooltip'

    canvas.addEventListener('beforerender', () => this.visible = false)
    canvas.addEventListener('afterrender', () => {
      if(this.visible) {
        this.el.classList.add('price-history__tooltip--active')
      } else {
        this.el.classList.remove('price-history__tooltip--active')
      }
    })
  }

  display(x: number, y: number, innerHtml: string) {
    this.visible = true
    this.el.innerHTML = innerHtml
    this.el.style.left = `${x - this.el.offsetWidth/2}px`
    this.el.style.top = `${y - this.el.offsetHeight - 10}px`
  }

}
