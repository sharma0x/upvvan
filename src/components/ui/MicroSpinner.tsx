import React from 'react'

export interface MicroSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Inline micro-spinner for buttons and active states.
 * Indicates ongoing asynchronous requests without triggering full-page layout disruption.
 */
export function MicroSpinner({ className = '', size = 'sm' }: MicroSpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'

  return (
    <svg
      className={`inline-block animate-spin text-current ${sizeClass} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
