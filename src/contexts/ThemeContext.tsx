import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // Adjust path as necessary

export type ThemeName = 'classic' | 'animated';

interface ThemeContextType {
  currentTheme: ThemeName;
  setTheme: (theme: ThemeName) => Promise<void>;
  isLoadingTheme: boolean;
  themeError: string | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_LOCAL_STORAGE_KEY = 'appPreferredTheme';
const DEFAULT_THEME: ThemeName = 'classic';

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [currentTheme, setCurrentThemeState] = useState<ThemeName>(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_LOCAL_STORAGE_KEY);
      return storedTheme === 'animated' || storedTheme === 'classic' ? storedTheme : DEFAULT_THEME;
    } catch (e) {
      console.warn("Could not access localStorage for theme, defaulting to classic.", e);
      return DEFAULT_THEME;
    }
  });
  const [isLoadingTheme, setIsLoadingTheme] = useState<boolean>(true);
  const [themeError, setThemeError] = useState<string | null>(null);

  const fetchAndSetInitialTheme = useCallback(async () => {
    setIsLoadingTheme(true);
    setThemeError(null);
    try {
      const { data, error } = await supabase
        .from('system_flags')
        .select('flag_value')
        .eq('flag_name', 'active_theme')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: "Searched item was not found"
        console.error('Error fetching initial theme status:', error);
        setThemeError('Failed to fetch theme settings from server.');
        // Keep localStorage theme or default if server fetch fails
      } else if (data && (data.flag_value === 'classic' || data.flag_value === 'animated')) {
        const dbTheme = data.flag_value as ThemeName;
        setCurrentThemeState(dbTheme);
        localStorage.setItem(THEME_LOCAL_STORAGE_KEY, dbTheme);
      } else {
        // Flag not found or invalid value, use local/default and try to set it in DB
        console.warn('Active theme flag not found or invalid in system_flags. Using local/default and attempting to set default in DB.');
        setCurrentThemeState(currentTheme); // currentTheme is already from localStorage or default
        localStorage.setItem(THEME_LOCAL_STORAGE_KEY, currentTheme);
        // Attempt to initialize it in DB if it doesn't exist
        await supabase
            .from('system_flags')
            .upsert({ flag_name: 'active_theme', flag_value: currentTheme, description: 'Currently active UI theme (classic or animated)' }, { onConflict: 'flag_name' });
      }
    } catch (e) {
      console.error('Unexpected error fetching initial theme:', e);
      setThemeError('An unexpected error occurred while fetching theme settings.');
    } finally {
      setIsLoadingTheme(false);
    }
  }, [currentTheme]); // currentTheme in dep array for the upsert fallback

  useEffect(() => {
    fetchAndSetInitialTheme();

    const channel = supabase
      .channel('public:system_flags:active_theme')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_flags',
          filter: 'flag_name=eq.active_theme'
        },
        (payload) => {
          const newThemeValue = (payload.new as any)?.flag_value;
          if (newThemeValue === 'classic' || newThemeValue === 'animated') {
            console.log('Theme changed via real-time:', newThemeValue);
            setCurrentThemeState(newThemeValue);
            localStorage.setItem(THEME_LOCAL_STORAGE_KEY, newThemeValue);
            setThemeError(null); // Clear error on successful update
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to active_theme updates.');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Real-time subscription error for active_theme:', err || status);
            setThemeError('Real-time theme updates disconnected. Please refresh if theme changes are not reflecting.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAndSetInitialTheme]);

  const setTheme = useCallback(async (theme: ThemeName) => {
    setIsLoadingTheme(true); // Indicate loading during theme change
    setThemeError(null);
    try {
      const { error } = await supabase
        .from('system_flags')
        .update({ flag_value: theme, updated_at: new Date().toISOString() })
        .eq('flag_name', 'active_theme');

      if (error) {
        console.error('Error updating theme in Supabase:', error);
        setThemeError(`Failed to save theme preference: ${error.message}`);
        // Revert optimistic update if needed, though real-time should correct it or show error
        // For now, we let the real-time handler or next fetch correct the state if db update fails.
        // Or, more defensively: fetchAndSetInitialTheme(); to re-sync with DB.
        throw error; // Re-throw to be caught by caller if needed
      } else {
        // UI state already updated by real-time if successful, or will be.
        // Explicitly set here for immediate feedback if real-time has latency.
        setCurrentThemeState(theme);
        localStorage.setItem(THEME_LOCAL_STORAGE_KEY, theme);
      }
    } catch (e) {
        // Error already logged or will be by caller.
        // Make sure UI reflects that the change might not have persisted.
    } finally {
        setIsLoadingTheme(false);
    }
  }, []);

  useEffect(() => {
    // Apply a class to the body or html element to allow global CSS overrides
    // This is a common pattern for theming
    document.documentElement.setAttribute('data-theme', currentTheme);
    return () => {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, isLoadingTheme, themeError }}>
      {children}
    </ThemeContext.Provider>
  );
};
