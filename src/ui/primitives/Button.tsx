import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'default' | 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
}

export function Button({
  variant = 'default',
  active = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [styles.button, styles[variant], active ? styles.active : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} aria-pressed={active || undefined} {...rest} />;
}
