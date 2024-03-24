import classNames from "classnames"
import { TriangleDownIcon, TriangleUpIcon } from '@radix-ui/react-icons';
import { TableContext } from "./tableContext";
import React, { Children, useContext, useId, useState } from "react";

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  className?: string
}

export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  columns: { value: string, label: string }[]
  className?: string
}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  className?: string
  row: Record<string, string|number>
}


export function Table({ children, className, ...props }: TableProps) {
  const [columns, _setColumns] = useState<string[]>([])
  const tableId = useId()

  // TODO: fix infinit loop
  function setColumns(value: string[]) {}
  
  return (
    <TableContext.Provider value={{ columns, setColumns, tableId }}>
      <table className={classNames('table', className)} id={tableId} {...props} >
        {children}
      </table>
    </TableContext.Provider>
  )
}

export function TableHead({ columns, className, ...props }: TableHeadProps) {
  const { setColumns, tableId } = useContext(TableContext)

  setColumns(columns.map(c => c.value))

  return (
    <thead className="table__head" {...props} >
      <tr className="table__row table__row--head">
        {columns.map(c => (
          <th key={c.value} className="table__header" scope="col" abbr={c.label} id={`${c.value}-${tableId}`}>
            <TriangleDownIcon />
            <span>{c.label}</span>
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function TableBody({ children, className, ...props }: TableBodyProps) {
  return (
    <tbody className={classNames('table__body', className)} {...props}>
      {children}
    </tbody>
  )
}

export function TableRow({ row, className, ...props }: TableRowProps) {
  const { columns, tableId } = useContext(TableContext)
  
  return (
    <tr className={classNames('table__row', className)} {...props}>
      {columns.map(col => (
        <td key={col} className="table__data" headers={`${col}-${tableId}`}>
          {row[col]}
        </td>
      ))}
    </tr>
  )
}