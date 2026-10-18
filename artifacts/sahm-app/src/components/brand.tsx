type BrandProps = {
  variant?: 'header' | 'rail';
  compact?: boolean;
};

export function Brand({ variant = 'header', compact = false }: BrandProps) {
  if (variant === 'rail') {
    return (
      <span className={`rail-brand-mark${compact ? ' is-compact' : ''}`} aria-hidden="true">
        <img src="/sahm-logo.png" alt="" />
      </span>
    );
  }

  return (
    <span className={`brand-mark${compact ? ' is-compact' : ''}`} aria-hidden="true">
      <img src="/sahm-logo.png" alt="" />
    </span>
  );
}
