import React, { createContext, useContext, useState, useEffect } from 'react';
import { Theme, themes, getTheme } from '@/lib/theme-config';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('dashboard-theme');
    return getTheme(savedTheme || 'blue');
  });

  const setTheme = (themeId: string) => {
    const theme = getTheme(themeId);
    setCurrentTheme(theme);
    localStorage.setItem('dashboard-theme', themeId);
  };

  useEffect(() => {
    // Apply CSS custom properties to root
    const root = document.documentElement;
    const { colors } = currentTheme;
    
    root.style.setProperty('--theme-primary', colors.primary);
    root.style.setProperty('--theme-secondary', colors.secondary);
    root.style.setProperty('--theme-accent', colors.accent);
    root.style.setProperty('--theme-light', colors.light);
    root.style.setProperty('--theme-dark', colors.dark);
    
    // Set data attribute for theme-specific styling
    document.body.setAttribute('data-theme', currentTheme.id);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes: themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
