import Link from 'next/link';

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  target?: React.HTMLAttributeAnchorTarget;
  size?: 'md' | 'icon';
  variant?: 'primary' | 'primarySoft' | 'outline' | 'ghost';
};

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover',
  primarySoft: 'border-transparent bg-primary-soft text-primary hover:bg-primary-soft-hover',
  outline: 'border-[#d7b9aa] bg-paper text-[#7a423b] hover:border-primary hover:bg-primary hover:text-primary-foreground',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-primary-soft hover:text-primary'
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'min-h-11 px-5',
  icon: 'size-11 p-0'
};

export function Button({ariaLabel, className = '', href, children, target, size = 'md', variant = 'primary'}: ButtonProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      target={target}
      rel={target === '_blank' ? 'noreferrer' : undefined}
      className={`inline-flex items-center justify-center rounded-full border font-semibold transition ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
