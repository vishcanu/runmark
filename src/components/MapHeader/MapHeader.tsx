import { useState, useRef, useEffect } from 'react';
import { MapPin, LogOut, ChevronDown } from 'lucide-react';
import { useUserProfile } from '../../hooks/useUserProfile';
import styles from './MapHeader.module.css';

interface MapHeaderProps {
  isActive?: boolean;
}

export function MapHeader({ isActive = false }: MapHeaderProps) {
  const user = useUserProfile();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    localStorage.removeItem('rg_user_name');
    localStorage.removeItem('rg_user_color');
    window.dispatchEvent(new CustomEvent('app-logout'));
  };

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <div className={styles.locationRow}>
          <MapPin size={14} strokeWidth={2.5} className={styles.pinIcon} />
          <span className={styles.locationLabel}>
            {isActive ? 'Recording' : 'Near you'}
          </span>
          {isActive && <div className={styles.recordDot} />}
        </div>
      </div>

      <div className={styles.right} ref={dropdownRef}>
        <button
          className={styles.avatarBtn}
          onClick={() => setOpen((v) => !v)}
          aria-label="Profile menu"
          aria-expanded={open}
        >
          <div className={styles.avatar} style={{ background: user.color }}>
            {user.initial}
          </div>
          <ChevronDown
            size={12}
            strokeWidth={2.5}
            className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}
          />
        </button>

        {open && (
          <div className={styles.dropdown}>
            {/* User identity */}
            <div className={styles.dropdownUser}>
              <div className={styles.dropdownAvatar} style={{ background: user.color }}>
                {user.initial}
              </div>
              <div className={styles.dropdownUserInfo}>
                <span className={styles.dropdownName}>{user.name}</span>
                <span className={styles.dropdownSubtitle}>Runner</span>
              </div>
            </div>

            <div className={styles.dropdownDivider} />

            <button className={styles.dropdownLogout} onClick={handleLogout}>
              <LogOut size={14} strokeWidth={2.2} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

