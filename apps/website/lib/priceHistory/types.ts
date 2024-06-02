
export type hitBox = [number, number, number, number]  // [ topLeftX, topLeftY, bottomRightX, bottomRightY ]

export interface Object2d {
  draw: (canvasCtx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
  destroy?: () => void
  
  hitBox?: hitBox
  cursor?: string

  onClick?: (event: MouseEvent) => void|boolean
  onMouseOver?: (event: MouseEvent) => void|boolean
  onMouseOut?:(event: MouseEvent) => void|boolean
  onMouseUp?:(event: MouseEvent) => void|boolean
  onMouseDown?:(event: MouseEvent) => void|boolean
  onWheel?:(event: WheelEvent) => void|boolean
}

export interface ObjectHtml {
  el: HTMLElement
}
