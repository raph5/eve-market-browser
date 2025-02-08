import * as RadixSelect from '@radix-ui/react-select';
import { TriangleDownIcon, TriangleUpIcon } from '@radix-ui/react-icons';
import classNames from 'classnames'
import "@scss/select.scss"

interface Item {
  key: string
  name: string
}

export interface SelectProps {
  id?: string,
  items: Item[]
  placeholder: string,
  className?: string,
  value?: string,
  onValueChange?: (value: string) => void
}

export function Select({ id, placeholder, items, className, value, onValueChange }: SelectProps) {

  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger className={classNames('select', className)} id={id}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="select__icon">
          <TriangleDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content position="popper" className="select__content">
          <RadixSelect.ScrollUpButton className="select__scroll-button select__scroll-button--top">
            <TriangleUpIcon />
          </RadixSelect.ScrollUpButton>

          <RadixSelect.Viewport>
            {items.map(({ key, name }) => (
              <RadixSelect.Item value={key} key={key} className="select__item">
                <RadixSelect.ItemText>{name}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>

          <RadixSelect.ScrollDownButton className="select__scroll-button select__scroll-button--bottom">
            <TriangleDownIcon />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
