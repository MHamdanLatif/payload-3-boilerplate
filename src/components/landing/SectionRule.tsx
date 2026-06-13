import { cn } from '@/utilities/cn'

export function SectionRule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block h-[2px] w-14 rounded-sm bg-teal', className)}
    />
  )
}
