import { cn } from '../../lib/utils';
export function Card({ className, children }: { className?: string; children: React.ReactNode }) { return <section className={cn('rounded-[22px] border border-slate-200/90 bg-white shadow-glass backdrop-blur-xl', className)}>{children}</section>; }
