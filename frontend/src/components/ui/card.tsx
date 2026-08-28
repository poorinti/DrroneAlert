import { cn } from '../../lib/utils';
export function Card({ className, children }: { className?: string; children: React.ReactNode }) { return <section className={cn('rounded-[22px] border border-white/80 bg-white/88 shadow-glass backdrop-blur-xl', className)}>{children}</section>; }
