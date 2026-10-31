import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

/** Modal decision dialog. Not dismissible by backdrop: the player must choose. */
export function Dialog({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className={styles.backdrop}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={styles.dialog}
      >
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
