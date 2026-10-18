type BrandProps = {
  variant?: 'header' | 'rail';
  compact?: boolean;
  language?: 'en' | 'ar';
};

export function Brand({ variant = 'header', compact = false, language = 'ar' }: BrandProps) {
  const logo = language === 'ar' ? '/sahm-logo-ar.png' : '/sahm-logo-en.png';

  if (variant === 'rail') {
    return (
      <span className={`rail-brand-mark${compact ? ' is-compact' : ''}`} aria-hidden="true">
        <img src={logo} alt="" />
      </span>
    );
  }

  return (
    <span className={`brand-mark${compact ? ' is-compact' : ''}`} aria-hidden="true">
      <img src={logo} alt="" />
    </span>
  );
}
