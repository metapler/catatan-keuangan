"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input p-0.5 shadow-xs transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[checked]:bg-primary dark:bg-input/60 dark:data-[checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-xs transition-transform data-[checked]:translate-x-4 data-[unchecked]:translate-x-0 dark:bg-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
