import React, { createContext, useContext, useState } from 'react';

// Create a Context for the theme
const ThemeContext = createContext();

// Create a provider component
export const ThemeProvider = ({ children }) => {
  const [themeColor, setThemeColor] = useState('light'); // Default theme

  const toggleTheme = () => {
    setThemeColor((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ themeColor, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Create a custom hook to use the ThemeContext
export const useTheme = () => {
  return useContext(ThemeContext);
}; 