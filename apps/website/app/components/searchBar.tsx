import classNames from "classnames";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import React, { KeyboardEventHandler, useEffect, useRef } from "react";
import "@scss/search-bar.scss";

export interface SearchBarProps extends React.HTMLAttributes<HTMLDivElement> {
  placeholder?: string
  value: string
  onValueChange: (value: string) => void,
  focusShortcut?: boolean
}

export function SearchBar({ placeholder, value, onValueChange, className, focusShortcut=false }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  
  function handleChange(event: React.ChangeEvent) {
    const target = event.target as HTMLInputElement
    onValueChange(target.value)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if(e.key == 'k' && e.ctrlKey) {
      e.preventDefault()
      inputRef.current?.focus()
    }
  }
  
  // bind ctrl-k to input focus 
  useEffect(() => {
    if(!focusShortcut) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  return (
    <div className={classNames('search-bar', className)}>
      <MagnifyingGlassIcon className="search-bar__icon" />
      <input
        type="text"
        className="search-bar__input"
        placeholder={placeholder ?? ''}
        value={value}
        onChange={handleChange}
        ref={inputRef}
      />
    </div>
  )
}