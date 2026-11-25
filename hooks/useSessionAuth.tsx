import { createContext, useContext, type ReactNode } from 'react';
import type { AppSession, Permission } from '../types';
import { can as canCheck } from '../utils/permissions';

type AuthCtx = {
  session: AppSession;
  can: (permission: Permission) => boolean;
};

const SessionAuthContext = createContext<AuthCtx | null>(null);

export function SessionAuthProvider({
  session,
  children,
}: {
  session: AppSession;
  children: ReactNode;
}) {
  const value: AuthCtx = {
    session,
    can: (permission) => canCheck(session, permission),
  };
  return <SessionAuthContext.Provider value={value}>{children}</SessionAuthContext.Provider>;
}

export function useSessionAuth(): AuthCtx {
  const ctx = useContext(SessionAuthContext);
  if (!ctx) throw new Error('useSessionAuth باید داخل SessionAuthProvider باشد.');
  return ctx;
}

export function useCan(): (permission: Permission) => boolean {
  return useSessionAuth().can;
}

/** Safe when outside provider (e.g. login page). */
export function useCanOptional(): ((permission: Permission) => boolean) | null {
  const ctx = useContext(SessionAuthContext);
  return ctx ? ctx.can : null;
}
