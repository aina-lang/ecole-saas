import { Pressable, ActivityIndicator, type PressableProps, View } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { Text } from './text'
import { cn } from '@/lib/utils'

const variants = cva('flex-row items-center justify-center gap-2 rounded-md', {
  variants: {
    variant: {
      default: 'bg-primary active:opacity-90',
      outline: 'border border-border bg-card active:bg-muted',
      ghost: 'active:bg-muted',
      destructive: 'bg-destructive active:opacity-90',
    },
    size: { default: 'h-12 px-5', sm: 'h-10 px-4', lg: 'h-14 px-6', icon: 'h-11 w-11' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
const textVariants = cva('font-semibold', {
  variants: {
    variant: { default: 'text-primary-foreground', outline: 'text-foreground', ghost: 'text-foreground', destructive: 'text-destructive-foreground' },
    size: { default: 'text-base', sm: 'text-sm', lg: 'text-lg', icon: '' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

type Props = PressableProps & VariantProps<typeof variants> & { className?: string; label?: string; loading?: boolean; children?: React.ReactNode }

export function Button({ className, variant, size, label, loading, disabled, children, style, ...props }: Props) {
  return (
    <Pressable style={style} className={cn(variants({ variant, size }), (disabled || loading) && 'opacity-50', className)} disabled={disabled || loading} {...props}>
      {loading ? <ActivityIndicator color={variant === 'default' || variant === 'destructive' ? '#fff' : undefined} /> : (
        <View className="flex-row items-center gap-2">
          {children}
          {label ? <Text className={textVariants({ variant, size })}>{label}</Text> : null}
        </View>
      )}
    </Pressable>
  )
}
