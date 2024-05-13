
export type hitBox = [number, number, number, number]  // [ topLeftX, topLeftY, bottomRightX, bottomRightY ]

export interface Object2d {
  draw: (canvasCtx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
  destroy?: () => void
  
  hitBox?: hitBox
  cursor?: string

  onClick?: (event: MouseEvent) => void
  onMouseOver?: (event: MouseEvent) => void
  onMouseOut?:(event: MouseEvent) => void 
  onMouseUp?:(event: MouseEvent) => void 
  onMouseDown?:(event: MouseEvent) => void 
}
