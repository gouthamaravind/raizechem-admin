import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: (on: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextType>({ isDemoMode: false, toggleDemoMode: () => {} });

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(() => localStorage.getItem("demo-mode") === "true");
  const qc = useQueryClient();

  useEffect(() => {
    localStorage.setItem("demo-mode", String(isDemoMode));
  }, [isDemoMode]);

  const toggleDemoMode = (on: boolean) => {
    setIsDemoMode(on);
    qc.invalidateQueries();
  };

  return (
    <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export const useDemoMode = () => useContext(DemoModeContext);
