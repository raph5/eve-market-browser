import { formatDate, formatPrice } from "../lib";
import { ObjectHtml } from "../types";

export class Tooltip implements ObjectHtml {

  public el: HTMLElement

  private _date = ''

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'price-history__tooltip'
  }

  display(x: number, y: number, price: number, date: string) {
    if(this._date != date) {
      this.el.classList.add('price-history__tooltip--active')
      this.el.innerHTML = `${formatDate(new Date(date))}<br>${formatPrice(price)}`
      this.el.style.left = `${x}px`
      this.el.style.top = `${y}px`
      this._date = date
    }
  }

  hide() {
    if(this._date != '') {
      this.el.classList.remove('price-history__tooltip--active')
      this._date = ''
    }
  }

}
