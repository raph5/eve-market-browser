import { useQuickbarHook } from "@hooks/useQuickbar"
import { createContext } from "react"

interface QuickbarContextType extends useQuickbarHook {}

const QuickbarContext = createContext<QuickbarContextType>({
  state: {},
  addItem: () => {},
  removeItem: () => {},
  clear: () => {},
  moveItem: () => {},
  createFolder: () => '',
  removeFolder: () => {},
  moveFolder: () => {},
  renameFolder: () => {},
  exportQuickbar: () => '',
  importQuickbar: () => {},
  has: () => false
})

export default QuickbarContext
