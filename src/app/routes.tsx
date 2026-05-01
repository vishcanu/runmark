import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';

const Home = lazy(() => import('../pages/Home/Home').then((m) => ({ default: m.Home })));
const Activity = lazy(() =>
  import('../pages/Activity/Activity').then((m) => ({ default: m.Activity }))
);
const Arena = lazy(() =>
  import('../pages/Arena/Arena').then((m) => ({ default: m.Arena }))
);
const Profile = lazy(() =>
  import('../pages/Profile/Profile').then((m) => ({ default: m.Profile }))
);

function PageFallback() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--text-sm)',
      }}
    >
      Loading...
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<PageFallback />}>
        <Home />
      </Suspense>
    ),
  },
  {
    path: '/activity',
    element: (
      <Suspense fallback={<PageFallback />}>
        <Activity />
      </Suspense>
    ),
  },
  {
    path: '/arena',
    element: (
      <Suspense fallback={<PageFallback />}>
        <Arena />
      </Suspense>
    ),
  },
  {
    path: '/profile',
    element: (
      <Suspense fallback={<PageFallback />}>
        <Profile />
      </Suspense>
    ),
  },
];
