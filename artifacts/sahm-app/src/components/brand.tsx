type BrandProps = {
  variant?: 'header' | 'rail';
  compact?: boolean;
};

export function Brand({ variant = 'header', compact = false }: BrandProps) {
  if (variant === 'rail') {
    return (
      <>
        <span className="rail-brand-mark" aria-hidden="true">
          <img src="/brand-mark.svg" alt="" />
        </span>
        {!compact && <span className="brand-lockup-copy"><b lang="ar">سهم</b><small>SAHM</small></span>}
      </>
    );
  }

  return (
    <>
      <span className="brand-mark" aria-hidden="true"><img src="/brand-mark.svg" alt="" /></span>
      {!compact && <><span className="brand-ar" lang="ar">سهم</span><span className="brand-name">SAHM</span></>}
    </>
  );
}
