'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Choisir',
  className,
  disabled,
}: TimePickerProps) {
  const [hours, minutes] = (value || '').split(':').map(Number)
  const isValid = !isNaN(hours) && !isNaN(minutes)

  function setHours(h: number) {
    const clamped = Math.min(23, Math.max(0, h))
    const m = isValid ? minutes : 0
    onChange?.(`${String(clamped).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  function setMinutes(m: number) {
    const clamped = Math.min(59, Math.max(0, m))
    const h = isValid ? hours : 0
    onChange?.(`${String(h).padStart(2, '0')}:${String(clamped).padStart(2, '0')}`)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !isValid && 'text-muted-foreground',
            className,
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4 shrink-0" />
          {isValid ? value : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setHours((isValid ? hours : 0) + 1)}
              className="flex h-7 w-10 items-center justify-center rounded hover:bg-secondary text-xs"
            >
              ▲
            </button>
            <input
              type="number"
              min={0}
              max={23}
              value={isValid ? hours : 0}
              onChange={(e) => setHours(parseInt(e.target.value) || 0)}
              className="h-9 w-10 rounded-md border bg-background text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setHours((isValid ? hours : 0) - 1)}
              className="flex h-7 w-10 items-center justify-center rounded hover:bg-secondary text-xs"
            >
              ▼
            </button>
          </div>
          <span className="text-lg font-medium">:</span>
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setMinutes((isValid ? minutes : 0) + 10)}
              className="flex h-7 w-10 items-center justify-center rounded hover:bg-secondary text-xs"
            >
              ▲
            </button>
            <input
              type="number"
              min={0}
              max={59}
              step={10}
              value={isValid ? minutes : 0}
              onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
              className="h-9 w-10 rounded-md border bg-background text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setMinutes((isValid ? minutes : 0) - 10)}
              className="flex h-7 w-10 items-center justify-center rounded hover:bg-secondary text-xs"
            >
              ▼
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
