import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) { return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-[2000] bg-slate-950/35 backdrop-blur-sm data-[state=open]:animate-in" /><DialogPrimitive.Content className={cn('fixed left-1/2 top-1/2 z-[2001] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-white/80 bg-white/95 p-6 shadow-2xl outline-none', className)}>{children}<DialogPrimitive.Close className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500"><X size={16} /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>; }
export const DialogTitle = ({ children }: { children: React.ReactNode }) => <DialogPrimitive.Title className="text-lg font-bold text-ink">{children}</DialogPrimitive.Title>;
export const DialogDescription = ({ children }: { children: React.ReactNode }) => <DialogPrimitive.Description className="mt-1 text-xs text-muted">{children}</DialogPrimitive.Description>;
