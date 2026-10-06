import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children?: React.ReactNode;
}

export const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: ButtonProps) => {
  const variants = {
    primary: "bg-primary text-on-primary hover:opacity-90",
    secondary: "bg-surface-container-highest text-on-surface hover:bg-surface-container-high",
    outline: "border-2 border-primary text-primary hover:bg-primary/5",
    ghost: "text-outline hover:text-on-surface hover:bg-surface-container/50",
    gradient: "hero-gradient text-on-primary shadow-lg shadow-primary/20 hover:opacity-90",
  };

  const sizes = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
    icon: "p-2",
  };

  return (
    <button 
      className={cn(
        "rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
