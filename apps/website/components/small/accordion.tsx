import * as RadixAccordion from "@radix-ui/react-accordion"
import classNames from "classnames"
import type React from "react"
import "@scss/accordion.scss"

export interface AccordionUlProps {
  className?: string
  children?: React.ReactNode
  type: 'single' | 'multiple'
}

export interface AccordionLiProps {
  className?: string
  children?: React.ReactNode
  value: string,
  label: string,
  image? : string
}

export function AccordionUl({ children, className, type }: AccordionUlProps) {
  return (
    <RadixAccordion.Root type={type} className={classNames('accordion-ul', className)}>
      {children}
    </RadixAccordion.Root>
  )
}

export function AccordionLi({ className, children, value, label }: AccordionLiProps) {
  return (
    <RadixAccordion.Item value={value} className={classNames('accordion-li', className)}>
      <RadixAccordion.Trigger className="accordion-li__trigger">
        {label}
      </RadixAccordion.Trigger>
      <RadixAccordion.Content>
        {children}
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  )
}