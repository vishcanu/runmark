import { NavLink } from 'react-router-dom';
import { Map, Activity, Shield, User } from 'lucide-react';
import styles from './BottomNav.module.css';

const NAV_ITEMS = [
  { to: '/',        icon: Map,      label: 'Map'      },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/arena',   icon: Shield,   label: 'Arena'    },
  { to: '/profile', icon: User,     label: 'Profile'  },
] as const;

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            [styles.item, isActive ? styles.active : ''].filter(Boolean).join(' ')
          }
          aria-label={label}
        >
          <span className={styles.iconWrap}>
            <Icon size={22} strokeWidth={2} />
          </span>
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
