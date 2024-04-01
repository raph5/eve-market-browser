import classNames from "classnames";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import React from "react";
import "@scss/search-bar.scss";

export interface SearchBarProps extends React.HTMLAttributes<HTMLDivElement> {
  placeholder?: string
  value: string
  onValueChange: (value: string) => void
}

export function SearchBar({ placeholder, value, onValueChange, className }: SearchBarProps) {
  function handleChange(event: React.ChangeEvent) {
    const target = event.target as HTMLInputElement
    onValueChange(target.value)
  }
  
  return <div className={classNames('search-bar', className)}>
    <MagnifyingGlassIcon className="search-bar__icon" />
    <input
      type="text"
      className="search-bar__input"
      placeholder={placeholder ?? ''}
      value={value}
      onChange={handleChange}
    />
  </div>
}