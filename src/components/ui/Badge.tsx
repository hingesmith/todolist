import React from 'react'
import { TodoStatus, TodoPriority } from '../../types/todo'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: TodoStatus
  priority?: TodoPriority
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', status, priority, children, ...props }, ref) => {
    let styles = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
    
    if (status) {
      if (status === 'todo') styles += ' bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900 dark:text-blue-100'
      if (status === 'in_progress') styles += ' bg-red-100 text-red-800 border-transparent dark:bg-red-900 dark:text-red-100'
      if (status === 'done') styles += ' bg-green-100 text-green-800 border-transparent dark:bg-green-900 dark:text-green-100'
    } else if (priority) {
      if (priority === 'low') styles += ' bg-green-100 text-green-800 border-transparent dark:bg-green-900 dark:text-green-100'
      if (priority === 'medium') styles += ' bg-yellow-100 text-yellow-800 border-transparent dark:bg-yellow-900 dark:text-yellow-100'
      if (priority === 'high') styles += ' bg-red-100 text-red-800 border-transparent dark:bg-red-900 dark:text-red-100'
    } else {
      styles += ' bg-gray-100 text-gray-800 border-transparent dark:bg-gray-800 dark:text-gray-100'
    }

    return (
      <div ref={ref} className={`${styles} ${className}`} {...props}>
        {children}
      </div>
    )
  }
)
Badge.displayName = 'Badge'
