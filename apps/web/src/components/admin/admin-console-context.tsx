'use client';

import { createContext, useContext } from 'react';
import { useAdminConsoleState } from './admin-console-state';

export type AdminConsoleState = ReturnType<typeof useAdminConsoleState>;

export const AdminConsoleContext = createContext<AdminConsoleState | null>(null);

export function useAdminConsole(): AdminConsoleState {
  const ctx = useContext(AdminConsoleContext);
  if (!ctx) {
    throw new Error('useAdminConsole must be used inside AdminConsole');
  }
  return ctx;
}
