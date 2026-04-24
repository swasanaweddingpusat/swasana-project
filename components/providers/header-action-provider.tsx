"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface HeaderActionContextValue {
  action: ReactNode;
  setAction: (node: ReactNode) => void;
  clearAction: () => void;
}

const HeaderActionContext = createContext<HeaderActionContextValue | null>(null);

export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setActionState] = useState<ReactNode>(null);

  const setAction = useCallback((node: ReactNode) => setActionState(node), []);
  const clearAction = useCallback(() => setActionState(null), []);

  return (
    <HeaderActionContext.Provider value={{ action, setAction, clearAction }}>
      {children}
    </HeaderActionContext.Provider>
  );
}

export function useHeaderAction() {
  const ctx = useContext(HeaderActionContext);
  if (!ctx) throw new Error("useHeaderAction must be used within HeaderActionProvider");
  return ctx;
}
