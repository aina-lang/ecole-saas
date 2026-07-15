'use client'

import * as React from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  value?: Date | string | null
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  max?: Date
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  className,
  disabled,
  max,
}: DatePickerProps) {
  const date = React.useMemo(() => {
    if (!value) return undefined
    if (value instanceof Date) return value
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : undefined
  }, [value])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP", { locale: fr }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          initialFocus
          locale={fr}
          disabled={(day) => max ? day > max : false}
        />
      </PopoverContent>
    </Popover>
  )
}
