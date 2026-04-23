import { useTheme } from '@/context/theme';

export function useColorScheme(): 'light' | 'dark' {
  return useTheme().preference;
}
