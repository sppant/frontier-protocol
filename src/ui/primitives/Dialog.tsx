import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  children: ReactNode;
  /** If given, the dialog can be dismissed (Esc, close button, backdrop). Omit for forced decisions. */
  onClose?: () => void;
}

export function Dialog({ title, children, onClose }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={styles.dialog}
        onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
      >
        {onClose && (
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
        <h2 className={styles.title}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
