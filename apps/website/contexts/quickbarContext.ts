import { useQuickbarHook } from "@hooks/useQuickbar"
import { createContext } from "react"

interface QuickbarContextType extends useQuickbarHook {}

const QuickbarContext = createContext<QuickbarContextType>({
  quickbar: {},
  addToQuickbar: () => {},
  removeFromQuickbar: () => {},
  clearQuickbar: () => {},
  moveToFolder: () => {},
  createFolder: () => {},
  removeFolder: () => {},
  isInQuickbar: () => false
})

export default QuickbarContext
