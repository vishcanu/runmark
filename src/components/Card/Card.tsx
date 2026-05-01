import { type HTMLAttributes, type ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
  interactive?: boolean;
}

export function Card({ children, elevated, interactive, className, ...rest }: CardProps) {
  return (
    <div
      className={[
        styles.card,
        elevated ? styles.elevated : '',
        interactive ? styles.interactive : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
