import { type LucideIcon } from 'lucide-react';
import styles from './Icon.module.css';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ icon: LucideIconComponent, size = 20, color, className, strokeWidth = 2 }: IconProps) {
  return (
    <span
      className={[styles.icon, className ?? ''].filter(Boolean).join(' ')}
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      <LucideIconComponent size={size} strokeWidth={strokeWidth} />
    </span>
  );
}
