import { useState } from 'react';

export interface UserProfile {
  name: string;
  color: string;
  initial: string;
}

export function useUserProfile(): UserProfile {
  const [name] = useState(() => localStorage.getItem('rg_user_name') ?? 'Explorer');
  const [color] = useState(() => localStorage.getItem('rg_user_color') ?? '#16a34a');
  return { name, color, initial: name.charAt(0).toUpperCase() };
}

export function saveUserProfile(name: string, color: string): void {
  localStorage.setItem('rg_user_name', name);
  localStorage.setItem('rg_user_color', color);
}
