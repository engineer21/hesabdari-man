import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface FormWorkspaceContextValue {
  mobileNavHidden: boolean;
  registerHiddenSource: (id: string) => void;
  unregisterHiddenSource: (id: string) => void;
}

const FormWorkspaceContext = createContext<FormWorkspaceContextValue>({
  mobileNavHidden: false,
  registerHiddenSource: () => {},
  unregisterHiddenSource: () => {},
});

export const FormWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sources, setSources] = useState<string[]>([]);

  const registerHiddenSource = useCallback((id: string) => {
    setSources((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const unregisterHiddenSource = useCallback((id: string) => {
    setSources((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : prev));
  }, []);

  const value = useMemo(
    () => ({
      mobileNavHidden: sources.length > 0,
      registerHiddenSource,
      unregisterHiddenSource,
    }),
    [sources.length, registerHiddenSource, unregisterHiddenSource]
  );

  return (
    <FormWorkspaceContext.Provider value={value}>{children}</FormWorkspaceContext.Provider>
  );
};

export function useFormWorkspace(): FormWorkspaceContextValue {
  return useContext(FormWorkspaceContext);
}

/**
 * Automatically hides the mobile BottomNav while a full-screen / MDI tab form is active
 * so the sticky bottom form CTA bar never collides with BottomNav.
 */
export function useHideMobileNavWhen(active: boolean): void {
  const { registerHiddenSource, unregisterHiddenSource } = useFormWorkspace();
  const sourceId = React.useId();

  useEffect(() => {
    if (active) {
      registerHiddenSource(sourceId);
      return () => unregisterHiddenSource(sourceId);
    }
    unregisterHiddenSource(sourceId);
    return undefined;
  }, [active, sourceId, registerHiddenSource, unregisterHiddenSource]);
}
