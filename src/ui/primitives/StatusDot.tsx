import styles from './StatusDot.module.css';

export type Status = 'ok' | 'warn' | 'danger' | 'idle';

export function StatusDot({ status, label }: { status: Status; label: string }) {
  return <span className={`${styles.dot} ${styles[status]}`} role="img" aria-label={label} />;
}
