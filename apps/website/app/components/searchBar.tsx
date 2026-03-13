import classNames from "classnames";
import React, { useEffect, useRef } from "react";
import "@scss/search-bar.scss";
import magnifyingGlass from "@assets/magnifying-glass.png"
import closeIcon from "@assets/close.png"

export interface SearchBarProps extends React.HTMLAttributes<HTMLDivElement> {
  placeholder?: string
  value: string
  onValueChange: (value: string) => void,
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>
  focusShortcut?: boolean
}

export function SearchBar({
  placeholder,
  value,
  onValueChange,
  onKeyDown,
  className,
  focusShortcut=false
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  
  function handleChange(event: React.ChangeEvent) {
    const target = event.target as HTMLInputElement
    onValueChange(target.value)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key == 'k' && e.ctrlKey || e.key == 'k' && e.metaKey) {
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
      <img src={magnifyingGlass} className="search-bar__icon" />
      <input
        type="text"
        className="search-bar__input"
        placeholder={placeholder ?? ''}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        ref={inputRef}
      />
      {value.length > 1 &&
        <button className="search-bar__close" onClick={() => onValueChange('')}>
          <img src={closeIcon} className="search-bar__icon" />
        </button>
      }
    </div>
  )
}
