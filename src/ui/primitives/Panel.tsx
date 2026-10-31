import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  title: string;
  actions?: ReactNode;
}

export function Panel({ title, actions, children, className, ...rest }: PanelProps) {
  return (
    <section className={`${styles.panel} ${className ?? ''}`} aria-label={title} {...rest}>
      <header className={styles.header}>
        <h2 className={`label ${styles.title}`}>{title}</h2>
        {actions}
      </header>
      <div className={styles.body} tabIndex={0}>
        {children}
      </div>
    </section>
  );
}
