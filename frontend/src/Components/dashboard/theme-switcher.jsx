import { Moon, Sun } from "lucide-react"
import { useTheme } from "./theme-provider"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="rounded-lg p-2 hover:bg-white/20 transition-colors"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5 text-white" />
      ) : (
        <Sun className="h-5 w-5 text-white" />
      )}
    </button>
  )
} 