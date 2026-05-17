import { useState, useRef, useEffect } from 'react';
import { Navigation2, LogOut, ChevronDown } from 'lucide-react';
import { useUserProfile } from '../../hooks/useUserProfile';
import { supabase } from '../../lib/supabase';
import styles from './MapHeader.module.css';

interface MapHeaderProps {
  isActive?: boolean;
}

export function MapHeader({ isActive = false }: MapHeaderProps) {
  const user = useUserProfile();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    ['rg_user_id','rg_user_name','rg_user_color','rg_user_age','rg_user_weight','rg_user_height','rg_user_gender']
      .forEach((k) => localStorage.removeItem(k));
    supabase?.auth.signOut();
    window.dispatchEvent(new CustomEvent('app-logout'));
  };

  return (
    <div className={styles.header}>

      {/* ── Logo mark + wordmark ─────────────────────────── */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <Navigation2 size={14} strokeWidth={2.5} />
        </div>
        <span className={styles.brandWord}>RunMark</span>
      </div>

      {/* ── Center: recording pill (only when active) ─────── */}
      <div className={styles.center}>
        {isActive && (
          <div className={styles.recPill}>
            <span className={styles.recDot} />
            Recording
          </div>
        )}
      </div>

      {/* ── Right: avatar + dropdown ─────────────────────── */}
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
            size={11}
            strokeWidth={2.5}
            className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}
          />
        </button>

        {open && (
          <div className={styles.dropdown}>
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


