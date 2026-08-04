import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-signal text-base-950 hover:bg-signal-soft active:translate-y-px shadow-press font-bold',
  secondary: 'raised border text-[color:var(--app-text)] hover:border-signal/50',
  ghost: 'bg-transparent hover:bg-base-800/60 text-[color:var(--app-text)]',
  outline: 'border-2 border-signal/70 text-signal hover:bg-signal/10',
  danger: 'bg-alert text-base-950 hover:brightness-110 font-bold shadow-press',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-[0.95rem] rounded-xl',
  lg: 'h-14 px-6 text-base rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    fullWidth,
    icon,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'tap inline-flex items-center justify-center gap-2 font-semibold transition-all',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon}
      {children}
    </button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces
// ─────────────────────────────────────────────────────────────────────────────

export function Card({
  className,
  children,
  as: Tag = 'div',
  ...rest
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={clsx('surface rounded-2xl border shadow-card', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'raised border',
    success: 'bg-signal/15 text-signal border border-signal/30',
    warn: 'bg-warn/15 text-warn border border-warn/30',
    danger: 'bg-alert/15 text-alert border border-alert/30',
    info: 'bg-info/15 text-info border border-info/30',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback
// ─────────────────────────────────────────────────────────────────────────────

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

export function ProgressBar({
  value,
  max = 1,
  className,
  tone = 'signal',
  label,
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: 'signal' | 'warn' | 'info';
  label?: string;
}) {
  const percent = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const tones = { signal: 'bg-signal', warn: 'bg-warn', info: 'bg-info' };
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={clsx('h-2.5 w-full overflow-hidden rounded-full bg-base-800/80', className)}
    >
      <div
        className={clsx(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          tones[tone],
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="text-5xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="muted max-w-sm text-sm">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm"
    >
      <p className="text-alert">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-base-800/70', className)} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form controls
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={clsx(
          'raised h-12 rounded-xl border px-4 text-base outline-none transition-colors',
          'placeholder:text-base-400 focus:border-signal',
          error && 'border-alert',
          className,
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="muted text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-alert">
          {error}
        </p>
      )}
    </div>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="tap flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="muted block text-xs">{description}</span>}
      </span>
      <span
        className={clsx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-signal' : 'bg-base-700',
        )}
      >
        <span
          className={clsx(
            'absolute top-1 h-5 w-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </span>
    </button>
  );
}

/** Bottom sheet used for lesson feedback and confirmations. */
export function Sheet({
  open,
  children,
  tone = 'neutral',
  labelledBy,
}: {
  open: boolean;
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'danger';
  labelledBy?: string;
}) {
  if (!open) return null;
  const tones = {
    neutral: 'surface border-t',
    success: 'border-t border-signal/40 bg-signal/10 backdrop-blur',
    danger: 'border-t border-alert/40 bg-alert/10 backdrop-blur',
  };
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      className={clsx(
        'safe-bottom fixed inset-x-0 bottom-0 z-40 animate-slide-up px-4 pt-4',
        tones[tone],
      )}
    >
      <div className="mx-auto w-full max-w-lg">{children}</div>
    </div>
  );
}
