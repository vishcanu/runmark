import { type ReactNode } from 'react';
import {
  TerritoryStoreContext,
  useTerritoryStoreState,
} from './useTerritoryStore';

interface TerritoryStoreProviderProps {
  children: ReactNode;
}

export function TerritoryStoreProvider({ children }: TerritoryStoreProviderProps) {
  const store = useTerritoryStoreState();
  return (
    <TerritoryStoreContext.Provider value={store}>
      {children}
    </TerritoryStoreContext.Provider>
  );
}
