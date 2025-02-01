import * as RadixTabs from '@radix-ui/react-tabs';
import classNames from 'classnames';
import type React from 'react';
import "@scss/tabs.scss"
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

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
}

export const TabsRoot = forwardRef<TabRef, TabsRootProps>(({ tabs, className, children, defaultValue }, ref) => {
  const pageAsLoaded = useRef(false)
  const tabsRef = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({})
  for(const tab of tabs) {
    tabsRef.current[tab.value] = useRef<HTMLButtonElement>(null)
  }

  useImperativeHandle(ref, () => ({
    blink(tab: string) {
      if(!pageAsLoaded.current) return
      tabsRef.current[tab].current?.classList.add('tabs__trigger--blink')
      setTimeout(() => tabsRef.current[tab].current?.classList.remove('tabs__trigger--blink'), 500)
    }
  }))

  useEffect(() => {
    setTimeout(() => pageAsLoaded.current = true, 1000)
  }, [])

  return (
    <RadixTabs.Root className={classNames('tabs', className)} defaultValue={defaultValue}>
      <RadixTabs.List className="tabs__list">
        {tabs.map((tab => (
          <RadixTabs.Trigger ref={tabsRef.current[tab.value]} value={tab.value} className="tabs__trigger" key={tab.value}>
            {tab.label}
          </RadixTabs.Trigger>
        )))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  )
})

export function Tab({ children, className, value }: TabProps) {

  return (
    <RadixTabs.Content className={classNames('tabs__content', className)} value={value}>
      {children}
    </RadixTabs.Content>
  )
}
