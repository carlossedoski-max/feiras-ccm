import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Número com animação de contagem (curta e leve). */
export function CountUp({ value, className, duration = 600 }: { value: number; className?: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    const delta = value - initial;
    if (delta === 0) { setDisplay(value); return; }
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(initial + delta * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); from.current = value; };
  }, [value, duration]);

  return <span className={cn("tabular-nums", className)}>{display}</span>;
}

/** Divisor com traço inspirado em pincel japonês. */
export function BrushDivider({ className }: { className?: string }) {
  return <div aria-hidden className={cn("ccm-brush my-4", className)} />;
}

/** Wrapper de transição suave entre páginas/abas. */
export function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <div className={cn("ccm-rise", className)} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/** Spinner discreto com referência sutil ao sol nascente. */
export function CcmSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-5 w-5 rounded-full border-2 border-border border-t-primary ccm-spin-slow",
        className,
      )}
    />
  );
}

/** Estado de carregamento com skeleton + mensagem curta. */
export function LoadingState({ message = "Carregando informações...", rows = 4 }: { message?: string; rows?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CcmSpinner className="h-4 w-4" /> {message}
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 rounded-md ccm-shimmer" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  );
}

/** Skeleton de cards (dashboard, listas em grade). */
export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[86px] rounded-lg border ccm-shimmer" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

/** Estado vazio explicativo, com traço japonês minimalista. */
export function EmptyState({
  icon, title, description, action, className,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("ccm-fade flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <div className="relative grid h-14 w-14 place-items-center rounded-full border border-primary/25 bg-primary/5 text-primary ccm-hinomaru">
        {icon}
      </div>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div aria-hidden className="ccm-brush w-24" />
      {action}
    </div>
  );
}

/** Barra de progresso com atualização suave. */
export function ProgressBar({ value, tone = "primary", className }: { value: number; tone?: "primary" | "success" | "warning"; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const bar = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
