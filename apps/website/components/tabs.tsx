import * as RadixTabs from '@radix-ui/react-tabs';
import classNames from 'classnames';
import type React from 'react';
import "@scss/tabs.scss"

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

export function TabsRoot({ tabs, className, children, defaultValue }: TabsRootProps) {
  return (
    <RadixTabs.Root className={classNames('tabs', className)} defaultValue={defaultValue}>
      <RadixTabs.List className="tabs__list">
        {tabs.map((tab => (
          <RadixTabs.Trigger value={tab.value} className="tabs__trigger" key={tab.value}>
            {tab.label}
          </RadixTabs.Trigger>
        )))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  )
}

export function Tab({ children, className, value }: TabProps) {
  return (
    <RadixTabs.Content className={classNames('tabs__content', className)} value={value}>
      {children}
    </RadixTabs.Content>
  )
}