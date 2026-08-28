import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva('inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:pointer-events-none disabled:opacity-50', { variants: { variant: { default: 'bg-primary text-white shadow-lg shadow-blue-200 hover:bg-blue-600', secondary: 'border border-slate-200 bg-white/80 text-slate-700 hover:bg-white', ghost: 'text-slate-600 hover:bg-slate-100', danger: 'bg-red-500 text-white hover:bg-red-600' }, size: { default: 'h-10 px-4', icon: 'h-10 w-10', sm: 'h-8 px-3 text-xs' } }, defaultVariants: { variant: 'default', size: 'default' } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => { const Comp = asChild ? Slot : 'button'; return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />; });
Button.displayName = 'Button';
