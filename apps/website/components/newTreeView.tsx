import ComposableTreeView from "react-composable-treeview"
import React from "react"

export interface TreeViewProps extends React.HTMLAttributes<HTMLUListElement> {}

export interface TreeViewGroupProps extends React.HTMLAttributes<HTMLLIElement> {
  value: string
  iconSrc: string
  iconAlt: string
  label: string
}

export interface TreeViewItemProps extends React.HTMLAttributes<HTMLLIElement> {}


export function TreeView({ children, ...props }: TreeViewProps) {

  return (
    <ComposableTreeView.Root>
      {children}
    </ComposableTreeView.Root>
  )
}

export function TreeViewGroup() {


}

export function TreeViewItem() {}