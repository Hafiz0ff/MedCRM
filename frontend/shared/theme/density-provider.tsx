'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Density = 'compact' | 'comfortable';

interface DensityContextProps {
  density: Density;
  setDensity: (density: Density) => void;
}

const DensityContext = createContext<DensityContextProps | undefined>(undefined);

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<Density>('comfortable');

  useEffect(() => {
    const savedDensity = localStorage.getItem('density-mode') as Density;
    if (savedDensity) {
      setDensityState(savedDensity);
    }
  }, []);

  const setDensity = (newDensity: Density) => {
    setDensityState(newDensity);
    localStorage.setItem('density-mode', newDensity);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute('data-density', density);
  }, [density]);

  return (
    <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>
  );
}

export function useDensity() {
  const context = useContext(DensityContext);
  if (!context) throw new Error('useDensity must be used within a DensityProvider');
  return context;
}
