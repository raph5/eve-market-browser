import * as RadixLabel from '@radix-ui/react-label';
import classNames from 'classnames';
import "@scss/label.scss"

export interface LabelProps {
  value: string
  htmlFor: string
  className?: string
}

export default function Label({ value, className, htmlFor }: LabelProps) {
  return (
    <RadixLabel.Root className={classNames('label', className)} htmlFor={htmlFor}>
      {value}
    </RadixLabel.Root>
  )
}