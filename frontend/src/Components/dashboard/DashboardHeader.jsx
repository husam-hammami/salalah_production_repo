import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

export function DashboardHeader({ selectedOrder, onThemeChange, onFclChange }) {
  const [selectedTheme, setSelectedTheme] = useState('Blue');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const themes = [
    { label: 'Blue', value: 'blue' },
    { label: 'Sky Blue', value: 'skyblue' },
    { label: 'Green', value: 'green' },
    { label: 'Grey', value: 'grey' }
  ];

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsDarkMode(document.documentElement.classList.contains('dark'));

    return () => observer.disconnect();
  }, []);

  const handleThemeChange = (event) => {
    const theme = themes.find(t => t.value === event.target.value);
    setSelectedTheme(theme.label);
    onThemeChange(event.target.value);
  };

  const handleOrderChange = (event) => {
    const selected = event.target.value;
    onFclChange(selected); // now can be FCL, SDLA, or MIL-A
  };

  const getTopbarStyle = () => {
    return isDarkMode
      ? 'bg-gradient-to-r from-[#0B1F3A] to-[#1F3D63] text-white'
      : 'bg-gray-200 text-black';
  };

  return (
    <div className={`${getTopbarStyle()} transition-colors`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-3">
            <div className={`${isDarkMode ? 'bg-white/10' : 'bg-black/10'} p-2 rounded`}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold">Industrial Dashboard</h1>
              <p className="text-sm opacity-90">Advanced Analytics & Control</p>
            </div>
          </div>

          {/* Dropdowns */}
          <div className="flex items-center gap-4">
            {/* Theme Dropdown */}
            <select
              value={themes.find(t => t.label === selectedTheme)?.value || 'blue'}
              onChange={handleThemeChange}
              className="px-3 py-2 rounded-md border bg-white text-black dark:bg-[#1e2b3f] dark:text-white dark:border-[#4B92FF] border-black-300"
            >
              {themes.map((theme) => (
                <option key={theme.value} value={theme.value}>
                  {theme.label}
                </option>
              ))}
            </select>

            {/* Order Type Dropdown (with MIL-A option) */}
            <select
              value={selectedOrder}
              onChange={handleOrderChange}
              className="px-3 py-2 rounded-md border bg-white text-black dark:bg-[#1e2b3f] dark:text-white dark:border-[#4B92FF] border-black-300"
            >
              <option value="FCL">FCL</option>
              <option value="SDLA">SDLA</option>
              <option value="MIL-A">MIL-A</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

DashboardHeader.propTypes = {
  selectedOrder: PropTypes.string.isRequired,
  onThemeChange: PropTypes.func.isRequired,
  onFclChange: PropTypes.func.isRequired,
};
