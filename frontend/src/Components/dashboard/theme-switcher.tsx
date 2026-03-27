import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from './theme-provider';

export function ThemeSwitcher() {
  const { currentTheme, setTheme, availableThemes } = useTheme();

  return (
    <Select value={currentTheme.id} onValueChange={setTheme}>
      <SelectTrigger className="w-40 bg-white/20 text-white border-white/30 backdrop-blur-sm">
        <SelectValue placeholder="Select theme" />
      </SelectTrigger>
      <SelectContent>
        {availableThemes.map((theme) => (
          <SelectItem key={theme.id} value={theme.id}>
            {theme.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
