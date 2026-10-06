import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'success' | 'error' | 'warning';
  className?: string;
}

export const Badge = ({ children, variant = 'primary', className }: BadgeProps) => {
  const variants = {
    primary: "bg-primary/10 text-primary-container",
    secondary: "bg-secondary/10 text-secondary",
    tertiary: "bg-tertiary/10 text-tertiary",
    outline: "border border-outline-variant text-outline",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    error: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center justify-center whitespace-nowrap",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};
