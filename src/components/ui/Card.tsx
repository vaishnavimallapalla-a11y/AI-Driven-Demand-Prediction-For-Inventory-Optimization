import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'glass' | 'insight';
  children?: React.ReactNode;
}

export const Card = ({ children, className, variant = 'default', ...props }: CardProps) => {
  return (
    <div 
      className={cn(
        "rounded-xl transition-all duration-300",
        variant === 'default' && "bg-surface-container-lowest shadow-[0_12px_40px_rgba(0,82,255,0.06)] p-6",
        variant === 'glass' && "bg-white/70 backdrop-blur-xl border border-white/30 p-6",
        variant === 'insight' && "insight-glass p-8 relative overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
