import classNames from 'classnames';
import type React from 'react';
import "@scss/tabs.scss"
import { createContext, forwardRef, useContext, useImperativeHandle, useRef, useState } from 'react';

export interface TabsRootProps {
  className?: string
  children?: React.ReactNode
  tabs: { value: string, label: string }[]
  defaultValue?: string
}

export interface TabProps {
  className?: string
  children?: React.ReactNode
  value: string
}

export interface TabRef {
  blink: (tab: string) => void
  open: (tab: string) => void
}

const TabsContext = createContext("");

export const TabsRoot = forwardRef<TabRef, TabsRootProps>(({ tabs, className, children, defaultValue }, ref) => {
  const [selection, setSelection] = useState(defaultValue ?? tabs[0].value);
  const tabsRef = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({})
  for(const tab of tabs) {
    tabsRef.current[tab.value] = useRef<HTMLButtonElement>(null)
  }

  useImperativeHandle(ref, () => ({
    blink(tab: string) {
      tabsRef.current[tab].current?.classList.add('tabs__trigger--blink')
      setTimeout(() => tabsRef.current[tab].current?.classList.remove('tabs__trigger--blink'), 300)
    },
    open(tab: string) {
      setSelection(tab)
    }
  }))

  return (
    <TabsContext.Provider value={selection}>
      <div className={classNames('tabs', className)} defaultValue={defaultValue}>
        <div className="tabs__list">
          {tabs.map((tab => (
            <button
              ref={tabsRef.current[tab.value]}
              className="tabs__trigger"
              key={tab.value}
              onClick={() => setSelection(tab.value)}
              data-state={tab.value == selection ? "active" : ""}
            >
              {tab.label}
            </button>
          )))}
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  )
})

export function Tab({ children, className, value }: TabProps) {
  const selection = useContext(TabsContext);

  return (
    <div
      className={classNames('tabs__content', className)}
      style={{display: value == selection ? undefined : 'none'}}
    >
      {children}
    </div>
  )
}
