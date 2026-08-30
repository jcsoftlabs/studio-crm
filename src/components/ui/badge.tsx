import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'span'> & { variant?: 'default' | 'muted' | 'destructive' }) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    muted: 'bg-muted text-muted-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
