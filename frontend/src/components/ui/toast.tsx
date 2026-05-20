"use client"

import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { cn } from "@/lib/utils"
import { XIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon, InfoIcon } from "lucide-react"

const typeIcons: Record<string, React.ReactNode> = {
  success: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
  error: <XCircleIcon className="h-4 w-4 text-red-500" />,
  warning: <AlertTriangleIcon className="h-4 w-4 text-yellow-500" />,
  info: <InfoIcon className="h-4 w-4 text-blue-500" />,
}

const typeStyles: Record<string, string> = {
  success: "border-l-green-500",
  error: "border-l-red-500",
  warning: "border-l-yellow-500",
  info: "border-l-blue-500",
}

function ToastViewport({ className, ...props }: Toast.Viewport.Props) {
  return (
    <Toast.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed bottom-0 right-0 z-[100] flex flex-col gap-2 p-4 max-w-sm w-full",
        className
      )}
      {...props}
    />
  )
}

function ToastRoot({
  className,
  type = "info",
  children,
  ...rest
}: { type?: string; className?: string; children?: React.ReactNode }) {
  const icon = typeIcons[type] || typeIcons.info

  return (
    <div
      data-slot="toast"
      data-type={type}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border bg-white p-4 pr-10 shadow-lg",
        "border-l-4",
        typeStyles[type] || typeStyles.info,
        "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-right-full",
        "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-right-full",
        className
      )}
      {...rest}
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">{children}</div>
      <button
        className="absolute top-2 right-2 p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Close"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  )
}

function ToastTitle({ className, ...props }: Toast.Title.Props) {
  return (
    <Toast.Title
      data-slot="toast-title"
      className={cn("text-sm font-medium text-gray-900", className)}
      {...props}
    />
  )
}

function ToastDescription({ className, ...props }: Toast.Description.Props) {
  return (
    <Toast.Description
      data-slot="toast-description"
      className={cn("text-xs text-gray-500 mt-0.5", className)}
      {...props}
    />
  )
}

export { ToastViewport, ToastRoot, ToastTitle, ToastDescription }
