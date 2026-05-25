import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white hover:bg-brand-strong shadow-sm',
        destructive: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
        outline: 'border border-border bg-transparent hover:bg-surface-soft hover:text-ink',
        secondary: 'bg-surface-muted text-ink hover:bg-surface-muted/80',
        ghost: 'hover:bg-surface-soft hover:text-ink',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[var(--field-height,40px)] px-4 py-2',
        sm: 'h-[calc(var(--field-height,40px)-8px)] rounded-md px-3 text-xs',
        lg: 'h-[calc(var(--field-height,40px)+8px)] rounded-md px-8',
        icon: 'h-[var(--field-height,40px)] w-[var(--field-height,40px)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
