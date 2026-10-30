interface Props {
  value: number; // 0-100
  className?: string;
  variant?: 'default' | 'thin';
  ariaLabel?: string;
}

export function ProgressBar({ value, className = '', variant = 'default', ariaLabel = 'progress' }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const height = variant === 'thin' ? 'h-1' : 'h-2';
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={`w-full ${height} bg-border-default rounded-full overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-accent-jargon rounded-full transition-all duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

