type SectionCardProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'aside';
  ariaLabel?: string;
  ariaLabelledby?: string;
};

export function SectionCard({children, className = '', as: Component = 'section', ariaLabel, ariaLabelledby}: SectionCardProps) {
  return (
    <Component
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      className={`rounded-2xl border border-line/80 bg-paper/90 shadow-warm ${className}`}
    >
      {children}
    </Component>
  );
}
