import { useState } from 'react';
import { useRoutes, BrowserRouter } from 'react-router-dom';
import { TerritoryStoreProvider } from '../features/territory/hooks/TerritoryStoreProvider';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { Welcome } from '../pages/Welcome/Welcome';
import { Login } from '../pages/Login/Login';
import { routes } from './routes';

type Screen = 'welcome' | 'login' | 'app';

function AppRoutes() {
  const element = useRoutes(routes);
  return element;
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    localStorage.getItem('rg_user_name') ? 'app' : 'welcome'
  );

  if (screen === 'welcome') {
    return <Welcome onContinue={() => setScreen('login')} />;
  }

  if (screen === 'login') {
    return (
      <Login
        onBack={() => setScreen('welcome')}
        onLogin={() => setScreen('app')}
      />
    );
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
