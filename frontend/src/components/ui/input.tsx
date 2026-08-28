import * as React from 'react';
import { cn } from '../../lib/utils';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn('h-10 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100', className)} {...props} />);
Input.displayName = 'Input';
