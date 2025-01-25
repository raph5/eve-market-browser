import { Cell, Column } from "@components/table";
import { useState } from "react";

export interface Sorting {
  column: string
  direction: 'ascending'|'descending'
}

export type useTableSortHook = [
  (rows: Record<string, Cell>[]) => Record<string, Cell>[],  // sort function
  Sorting|null,  // sorting state
  (sort: Sorting|null) => void  // setSorting
]

export function useTableSort(columns: Column[], defaultSorting: Sorting|null = null): useTableSortHook {
  const [sorting, setSorting] = useState(defaultSorting)

  function sort(rows: Record<string, Cell>[]) {
    if(sorting == null) return rows
    const columnSort = columns.find(col => col.value == sorting.column)?.sorting as (a: any, b: any) => number
    return rows.sort((rowa: Record<string, Cell>, rowb: Record<string, Cell>) => (
      columnSort(rowa[sorting.column][0], rowb[sorting.column][0]) * (sorting.direction == 'descending' ? -1 : 1)
    ))
  }

  return [sort, sorting, setSorting]
}