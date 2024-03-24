import { createContext } from "react"

export interface TableContextType {
  columns: string[],
  setColumns: (colums: string[]) => void,
  tableId: string
}

export const TableContext = createContext<TableContextType>({ columns: [], setColumns: () => {}, tableId: '' })