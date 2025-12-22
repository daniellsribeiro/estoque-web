"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "22rem"
const SIDEBAR_WIDTH_ICON = "4rem"

type SidebarContextValue = {
  isMobile: boolean
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  toggleSidebar: () => void
  state: "expanded" | "collapsed"
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const listener = () => setIsMobile(media.matches)
    listener()
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [breakpoint])

  return isMobile
}

export function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider")
  }
  return ctx
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openState, setOpenState] = React.useState(defaultOpen)
  const [openMobile, setOpenMobile] = React.useState(false)

  const open = openProp ?? openState
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (openProp === undefined) {
        setOpenState(value)
      }
      onOpenChange?.(value)
    },
    [openProp, onOpenChange]
  )

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev)
    } else {
      setOpen(!open)
    }
  }, [isMobile, open, setOpen])

  const state: SidebarContextValue["state"] = open ? "expanded" : "collapsed"

  return (
    <SidebarContext.Provider
      value={{
        isMobile,
        open,
        setOpen,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        state,
      }}
    >
      <div
        className={cn("flex h-[100dvh] w-full overflow-hidden", className)}
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

const sidebarVariants = cva(
  "group/sidebar peer hidden md:flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear",
  {
    variants: {
      side: {
        left: "border-r border-sidebar-border",
        right: "border-l border-sidebar-border",
      },
      collapsible: {
        icon: "data-[state=expanded]:w-[var(--sidebar-width)] data-[state=collapsed]:w-[var(--sidebar-width-icon)]",
        none: "w-[var(--sidebar-width)]",
      },
    },
    defaultVariants: {
      side: "left",
      collapsible: "icon",
    },
  }
)

export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"aside"> &
    VariantProps<typeof sidebarVariants> & {
      side?: "left" | "right"
      collapsible?: "icon" | "none"
    }
>(({ className, side = "left", collapsible = "icon", children, ...props }, ref) => {
  const { isMobile, openMobile, setOpenMobile, state } = useSidebar()

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent side={side} className="w-[min(var(--sidebar-width-mobile),92vw)] p-0 overflow-hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      ref={ref}
      data-state={state}
      data-collapsible={collapsible}
      data-side={side}
      className={cn(sidebarVariants({ side, collapsible }), className)}
      {...props}
    >
      <div className="flex h-full w-full flex-col">{children}</div>
    </aside>
  )
})
Sidebar.displayName = "Sidebar"

export const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex h-full min-w-0 flex-1 flex-col overflow-y-auto", className)} {...props} />
  )
)
SidebarInset.displayName = "SidebarInset"

export const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", className)}
        onClick={(event) => {
          props.onClick?.(event)
          toggleSidebar()
        }}
        {...props}
      >
        <PanelLeft className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    )
  }
)
SidebarTrigger.displayName = "SidebarTrigger"

export const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex shrink-0 flex-col gap-2 p-3", className)} {...props} />
  )
)
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-y-auto overflow-x-hidden p-2 scroll-soft", className)} {...props} />
  )
)
SidebarContent.displayName = "SidebarContent"

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("shrink-0 border-t border-sidebar-border p-2", className)} {...props} />
  )
)
SidebarFooter.displayName = "SidebarFooter"

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1", className)} {...props} />
  )
)
SidebarGroup.displayName = "SidebarGroup"

export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70 group-data-[state=collapsed]/sidebar:sr-only",
        className
      )}
      {...props}
    />
  )
)
SidebarGroupLabel.displayName = "SidebarGroupLabel"

export const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1", className)} {...props} />
  )
)
SidebarGroupContent.displayName = "SidebarGroupContent"

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("space-y-1", className)} {...props} />
  )
)
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => <li ref={ref} className={cn("list-none", className)} {...props} />
)
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition " +
    "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground " +
    "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
  {
    variants: {
      size: {
        default: "h-9",
        sm: "h-8 text-xs",
        lg: "h-10 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof sidebarMenuButtonVariants> & {
      asChild?: boolean
      isActive?: boolean
    }
>(({ className, size, asChild = false, isActive, ...props }, ref) => {
  const { isMobile, setOpenMobile } = useSidebar()
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      ref={ref}
      data-active={isActive}
      onClick={(event) => {
        props.onClick?.(event)
        if (isMobile && !event.defaultPrevented) {
          setOpenMobile(false)
        }
      }}
      className={cn(
        sidebarMenuButtonVariants({ size }),
        "group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-2 group-data-[state=collapsed]/sidebar:[&>span:last-child]:sr-only",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

export const SidebarRail = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()
    return (
      <button
        ref={ref}
        className={cn(
          "absolute inset-y-0 -right-3 hidden w-3 cursor-col-resize bg-transparent md:block",
          className
        )}
        onClick={toggleSidebar}
        {...props}
      />
    )
  }
)
SidebarRail.displayName = "SidebarRail"
