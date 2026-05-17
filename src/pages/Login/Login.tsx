import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import styles from './Login.module.css';

interface LoginProps {
  onBack: () => void;
}

export function Login({ onBack }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleGoogle = async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // On success: browser redirects to Google — no further action needed here
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={onBack} aria-label="Go back">
        <ArrowLeft size={20} strokeWidth={2} />
      </button>

      <div className={styles.content}>
        <div className={styles.headingGroup} style={{ marginTop: 'auto' }}>
          <h1 className={styles.heading}>Sign in to{'\n'}RunMark</h1>
          <p className={styles.subtext}>
            Your territories, streaks and health data sync across all your devices.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
          {/* Google button */}
          <button
            className={styles.googleBtn}
            onClick={handleGoogle}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.googleSpinner} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
            )}
            <span>{loading ? 'Redirecting…' : 'Continue with Google'}</span>
          </button>

          {error && (
            <p style={{ fontSize: 13, color: '#dc2626', textAlign: 'center', margin: 0 }}>
              {error}
            </p>
          )}

          <p style={{ fontSize: 12, color: '#a1a1aa', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            Free forever · Your data is private · No spam
          </p>
        </div>
      </div>
    </div>
  );
}
