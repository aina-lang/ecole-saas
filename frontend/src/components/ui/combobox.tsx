'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  allowCustom?: boolean
}

export function Combobox({
  options: rawOptions,
  value,
  onValueChange,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  emptyText = 'Aucun résultat',
  disabled = false,
  className,
  allowCustom = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const options = React.useMemo(
    () => rawOptions.filter((o) => o.value != null && o.value !== ''),
    [rawOptions]
  )

  const selectedLabel = options.find((o) => o.value === value)?.label

  const noMatch = allowCustom && search && !options.some((o) => o.value.toLowerCase() === search.toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !selectedLabel && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  keywords={[opt.label]}
                  onSelect={() => {
                    onValueChange(opt.value === value ? '' : opt.value)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opt.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span>{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandEmpty>
              {allowCustom && search ? (
                <CommandItem
                  value={search}
                  onSelect={() => {
                    onValueChange(search)
                    setOpen(false)
                    setSearch('')
                  }}
                  className="justify-center text-primary"
                >
                  + Utiliser &ldquo;{search}&rdquo;
                </CommandItem>
              ) : (
                <span>{emptyText}</span>
              )}
            </CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
