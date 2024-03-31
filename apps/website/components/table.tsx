import classNames from "classnames"
import React, { useId, useRef } from "react"
import { TriangleDownIcon, TriangleUpIcon } from "@radix-ui/react-icons"
import "@scss/table.scss"
import { Sorting, useTableSort } from "../hooks/useTableSort"

export interface Column {
  value: string
  label: string
  sorting: (a: any, b: any) => number
}

export type Cell = [ any, string|number ]

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  columns: Column[]
  data: Record<string, Cell>[]
  columnTemplate: string
  defaultSorting?: Sorting|null
}

export default function Table({ columns, data, columnTemplate, className, defaultSorting }: TableProps) {
  const tableId = useId()
  const [sort, sorting, setSorting] = useTableSort(columns, defaultSorting ?? null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const talbeRef = useRef<HTMLTableElement>(null)

  function handleHeaderClick(column: string) {
    if(sorting == null || sorting.column != column) {
      setSorting({ column, direction: 'descending' })
    }
    else {
      setSorting({ column, direction: sorting.direction == 'descending' ? 'ascending' : 'descending' })
    }
  }

  function handleMouseMove(event: React.MouseEvent) {
    const table = talbeRef.current
    const highlight = highlightRef.current
    if(table == null || highlight == null) return

    if(event.pageY - table.offsetTop < 22) {
      highlight.style.opacity = '0'
    }
    else if(event.pageY - table.offsetTop < 44) {
      const height = 22 - (table.scrollTop % 22)
      highlight.style.opacity = `1`
      highlight.style.transform = `translateY(${table.scrollTop + 22}px) scaleY(${height/22})`
    }
    else {
      const row = Math.floor((event.pageY - table.offsetTop + table.scrollTop) / 22)
      highlight.style.opacity = `1`
      highlight.style.transform = `translateY(${22*row}px)`
    }
  }

  function handleMouseOut() {
    if(highlightRef.current) {
      highlightRef.current.style.opacity = '0'
    }
  }

  return (
    <div
      role="table"
      className={classNames('table', className)}
      style={{ gridTemplateColumns: columnTemplate }}
      id={tableId}
      ref={talbeRef}
      onMouseMove={handleMouseMove}
      onMouseOut={handleMouseOut}
      onScroll={handleMouseOut}
    >

      <div className="table__highlight" ref={highlightRef}></div>
      
      {columns.map(col => (
        <span
          id={`${tableId}-${col.value}`}
          className="table__cell table__cell--header"
          onClick={() => handleHeaderClick(col.value)}
          key={col.value}
        >
          {col.label}
          {sorting && sorting.column == col.value && 
            <div className="table__head-icon">
              {sorting.direction == 'ascending' ? <TriangleUpIcon /> : <TriangleDownIcon />}
            </div>
          }
        </span>
      ))}

      {sort(data).map((row, index) => columns.map(col => (
        <span
          key={`${tableId}-${col.value}-${index}`}
          className="table__cell"
          data-type={typeof row[col.value][1]}
        >
          {row[col.value][1]}
        </span>
      )))}

    </div>
  )
}