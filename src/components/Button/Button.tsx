import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      children,
      className,
      disabled,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={[
          styles.button,
          styles[variant],
          styles[size],
          loading ? styles.loading : '',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <span className={styles.spinner} /> : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
