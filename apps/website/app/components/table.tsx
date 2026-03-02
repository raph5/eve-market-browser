/*
 * One dimensional table that lists orders
 */

import { assert } from "@app/utils";
import "@scss/table.scss"
import classNames from "classnames"
import { Children, isValidElement, createContext, useContext, useState, useRef } from "react"
import { TriangleDownIcon, TriangleUpIcon } from "@radix-ui/react-icons"

export interface Sorting {
  column: string
  direction: 'ascending'|'descending'
}

const SortingContext = createContext<any>(null)
const ColumnTypeContext = createContext<Record<string, 'number'|'string'>>({});

export interface RootProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
  defaultSorting: Sorting,
  values: Record<string, Record<string, any>>
  columnType: Record<string, 'number'|'string'>
}

export function Root({children, defaultSorting, values, columnType, className, ...props}: RootProps) {
  const [sorting, setSorting] = useState(defaultSorting)

  const [head, ...rows] = Children.toArray(children)
  assert(isValidElement(head))
  rows.forEach(el => assert(isValidElement(el)))

  rows.sort((aRow, bRow) => {
    if (!isValidElement(aRow) || !isValidElement(bRow)) return 0;
    const aValue = values[aRow.props.rowId][sorting.column]
    const bValue = values[bRow.props.rowId][sorting.column]
    if (columnType[sorting.column] == 'number' && sorting.direction == 'ascending') {
      return aValue - bValue;
    } else if (columnType[sorting.column] == 'number' && sorting.direction == 'descending') {
      return bValue - aValue;
    } else if (columnType[sorting.column] == 'string' && sorting.direction == 'ascending') {
      return aValue.localeCompare(bValue);
    } else if (columnType[sorting.column] == 'string' && sorting.direction == 'descending') {
      return bValue.localeCompare(aValue);
    }
  })

  return (
    <SortingContext.Provider value={[sorting, setSorting]}>
      <ColumnTypeContext.Provider value={columnType}>
        <table className={classNames(className, "table")} {...props}>
          <thead>
            {head}
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </ColumnTypeContext.Provider>
    </SortingContext.Provider>
  )
}

export interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode
  rowId?: number
}

export function Row({children, rowId, className, ...props}: RowProps) {
  return (
    <tr className={classNames(className, "table__row")} {...props}>
      {children}
    </tr>
  )
}

export interface HeadProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
  column: string  // column id
}

export function Head({children, column, className, ...props}: HeadProps) {
  const [sorting, setSorting] = useContext(SortingContext);

  return (
    <th className={classNames(className, "table__cell table__cell--head")} {...props}>
      <div>
        {children}
        {sorting.column == column && sorting.direction == 'descending' &&
          <div className="table__head-icon">
            <TriangleDownIcon />
          </div>
        }
        {sorting.column == column && sorting.direction == 'ascending' &&
          <div className="table__head-icon">
            <TriangleUpIcon />
          </div>
        }
      </div>
    </th>
  )
}

export interface CellProps extends React.HTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
  column: string
}

export function Cell({children, column, className, ...props}: CellProps) {
  const columnType = useContext(ColumnTypeContext)
  const type = columnType[column]

  return (
    <td className={classNames(className, "table__cell", type == 'number' && "table__cell--number")} {...props}>
      {children}
    </td>
  )
}
