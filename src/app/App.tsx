import { useState, useEffect, useCallback } from 'react';
import { useRoutes, BrowserRouter } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { TerritoryStoreProvider } from '../features/territory/hooks/TerritoryStoreProvider';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { Welcome } from '../pages/Welcome/Welcome';
import { Login } from '../pages/Login/Login';
import { Setup } from '../pages/Setup/Setup';
import { routes } from './routes';

type Screen = 'loading' | 'welcome' | 'login' | 'setup' | 'app';

function AppRoutes() {
  const element = useRoutes(routes);
  return element;
}

function LoadingScreen() {
  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f6f6f4',
    }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid #e4e4e7', borderTopColor: '#0284c7',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: 14, color: '#a1a1aa', fontWeight: 500 }}>Loading…</span>
      </div>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>('loading');

  // ── Handle a confirmed Supabase user ──────────────────────
  const handleAuthUser = useCallback(async (user: User) => {
    localStorage.setItem('rg_user_id', user.id);

    if (!supabase) { setScreen('app'); return; }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        // Returning user — restore profile to localStorage
        localStorage.setItem('rg_user_name',  profile.name  ?? user.user_metadata?.full_name ?? 'Runner');
        localStorage.setItem('rg_user_color', profile.color ?? '#0284c7');
        if (profile.age)       localStorage.setItem('rg_user_age',    String(profile.age));
        if (profile.weight_kg) localStorage.setItem('rg_user_weight', String(profile.weight_kg));
        if (profile.height_cm) localStorage.setItem('rg_user_height', String(profile.height_cm));
        if (profile.gender)    localStorage.setItem('rg_user_gender', profile.gender);
        window.history.replaceState(null, '', '/');
        setScreen('app');
      } else {
        // New user — pre-fill Google name, send to setup
        const googleName = user.user_metadata?.full_name
          ?? user.user_metadata?.name
          ?? user.email?.split('@')[0]
          ?? 'Runner';
        localStorage.setItem('rg_user_name',  googleName);
        localStorage.setItem('rg_user_color', '#0284c7');
        window.history.replaceState(null, '', '/');
        setScreen('setup');
      }
    } catch {
      window.history.replaceState(null, '', '/');
      setScreen('app');
    }
  }, []);

  // ── Check session on mount (also handles OAuth redirect) ──
  useEffect(() => {
    if (!supabase) {
      // No Supabase configured — use legacy localStorage flow
      const name = localStorage.getItem('rg_user_name');
      setScreen(name ? 'app' : 'welcome');
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleAuthUser(session.user);
      } else {
        setScreen('welcome');
      }
    });

    // Listen for OAuth callback + sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleAuthUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setScreen('welcome');
      }
    });

    // Instant sign-out via custom event (fired before Supabase network round-trip)
    const handleInstantLogout = () => setScreen('welcome');
    window.addEventListener('app-logout', handleInstantLogout);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('app-logout', handleInstantLogout);
    };
  }, [handleAuthUser]);

  if (screen === 'loading') return <LoadingScreen />;

  if (screen === 'welcome') {
    return <Welcome onContinue={() => setScreen('login')} />;
  }

  if (screen === 'login') {
    return <Login onBack={() => setScreen('welcome')} />;
  }

  if (screen === 'setup') {
    return <Setup onComplete={() => setScreen('app')} />;
  }

  return (
    <BrowserRouter>
      <TerritoryStoreProvider>
        <AppRoutes />
        <BottomNav />
      </TerritoryStoreProvider>
    </BrowserRouter>
  );
}

