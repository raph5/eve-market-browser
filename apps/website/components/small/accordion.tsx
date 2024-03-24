import * as RadixAccordion from "@radix-ui/react-accordion"
import classNames from "classnames"
import type React from "react"
import "@scss/accordion.scss"
import { TriangleRightIcon } from '@radix-ui/react-icons';
import { useState } from "react";

const ACCORDION_KEYS = [ 'ArrowRight', 'ArrowLeft' ]

export interface AccordionProps {
  className?: string
  children?: React.ReactNode
}

export interface AccordionItemProps {
  value: string
  parent: string
  label: string
  className?: string
  children?: React.ReactNode
  startContent?: React.ReactNode
  depth?: number
}

function getChildTrigger(trigger: HTMLElement): HTMLElement | null {
  return document.querySelector(`[id="${trigger.id}"] + .accordion-li__content > .accordion-li:first-child > .accordion-li__trigger`)
}

function getParentTrigger(trigger: HTMLElement): HTMLElement | null {
  return document.querySelector(`.accordion-li__trigger:has(+ .accordion-li__content > .accordion-li > [id="${trigger.id}"])`)
}

export function Accordion({ children, className }: AccordionProps) {

  // TODO: extend accordeon keyboard navigation and accessibility

  const [accordionValue, setAccordionValue] = useState<string[]>([])

  function handleKeyDown(event: React.KeyboardEvent) {
    if(!ACCORDION_KEYS.includes(event.key)) return

    event.preventDefault()
    const target = event.target as HTMLElement
    const targetValue = target.dataset.value

    if(!targetValue) return

    switch(event.key) {
      case 'ArrowRight':
        if(!accordionValue.includes(targetValue)) {
          setAccordionValue([ targetValue, ...accordionValue ])
        } else {
          getChildTrigger(target)?.focus()
        }
        break
        case 'ArrowLeft':
        if(accordionValue.includes(targetValue)) {
          setAccordionValue(accordionValue.filter(v => v != targetValue))
        } else {
          getParentTrigger(target)?.focus()
        }
    }
  }

  return (
    <RadixAccordion.Root
      type="multiple"
      value={accordionValue}
      onValueChange={setAccordionValue}
      onKeyDown={handleKeyDown}
      className={classNames('accordion-ul', className)}
    >
      {children}
    </RadixAccordion.Root>
  )
}

export function AccordionItem({ parent, className, children, value, label, startContent, depth }: AccordionItemProps) {
  return (
    <RadixAccordion.Item value={value} className={classNames('accordion-li', className)}>
      <RadixAccordion.Trigger className="accordion-li__trigger" data-depth={depth ?? 0} data-value={value}>
        <div className="accordion-li__triangle">
          <TriangleRightIcon />
        </div>
        {startContent}
        <span className="accordion-li__label">
          {label}
        </span>
      </RadixAccordion.Trigger>
      <RadixAccordion.Content className="accordion-li__content">
        {children}
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  )
}