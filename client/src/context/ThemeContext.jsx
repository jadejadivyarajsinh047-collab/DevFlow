import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("devflow_theme") || "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("devflow_theme", theme);
  }, [theme]);
  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((v) => (v === "dark" ? "light" : "dark")),
    }),
    [theme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
