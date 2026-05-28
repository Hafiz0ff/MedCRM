'use client';

import { useEffect } from 'react';

interface BrandingInjectorProps {
  defaultBrand: string;
  defaultAccent: string;
}

export function BrandingInjector({ defaultBrand, defaultAccent }: BrandingInjectorProps) {
  useEffect(() => {
    // Set initial server-rendered or locally customized CSS variables
    const applyBranding = () => {
      let brand = defaultBrand;
      let accent = defaultAccent;

      try {
        const localBranding = localStorage.getItem('white-label-branding');
        if (localBranding) {
          const { brandColor, accentColor } = JSON.parse(localBranding);
          if (brandColor) brand = brandColor;
          if (accentColor) accent = accentColor;
        }
      } catch (e) {
        console.error('Failed to parse local white-label branding configurations', e);
      }

      document.documentElement.style.setProperty('--brand-hsl', brand);
      document.documentElement.style.setProperty('--accent-hsl', accent);
      document.documentElement.style.setProperty('--brand', `hsl(${brand})`);
      document.documentElement.style.setProperty('--accent', `hsl(${accent})`);
    };

    applyBranding();

    // Listen for custom settings saves to hot-reload colors without refreshing the page
    const handleStorageUpdate = () => {
      applyBranding();
    };

    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [defaultBrand, defaultAccent]);

  return null;
}
