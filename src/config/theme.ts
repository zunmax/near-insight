/** localStorage key holding the chosen theme. Renaming it resets every visitor's saved choice. */
export const THEME_STORAGE_KEY = "theme";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Theme = Exclude<ThemePreference, "system">;

/** Theme of a visitor who has not chosen one. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";

/** Browser UI color per theme; matches --bg in src/app/globals.css. */
export const THEME_COLORS: Record<Theme, string> = { light: "#ffffff", dark: "#000000" };
