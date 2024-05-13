import { hitBox } from "./types"

export function isInHitBox(x: number, y: number, hitBox: hitBox) {
  return x >= hitBox[0] && x <= hitBox[2] && y >= hitBox[1] && y <= hitBox[3]
}
