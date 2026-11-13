import { DEFAULT_THEME_PREFERENCE, THEME_COLORS, THEME_PREFERENCES, THEME_STORAGE_KEY, type Theme, type ThemePreference } from "@/config/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Inline <head> script: applies the saved theme to <html> and the browser UI color (the theme-color meta comes before it in
    <head>) before first paint; the default preference when none is saved. It mirrors applyTheme below and stays small and dependency-free. */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(THEME_PREFERENCES)}.indexOf(p)<0)p=${JSON.stringify(DEFAULT_THEME_PREFERENCE)};var t=p==="system"?(matchMedia(${JSON.stringify(DARK_QUERY)}).matches?"dark":"light"):p;var r=document.documentElement;r.dataset.theme=t;r.dataset.themePref=p;var c=${JSON.stringify(THEME_COLORS)}[t];document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)})}catch(e){}})()`;

export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFERENCES.find((preference) => preference === saved) ?? DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Sets data-theme / data-theme-pref on <html> and the browser UI color, without animating colors. */
export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const theme = resolveTheme(preference);
  if (root.dataset.theme !== theme) {
    /** Suppresses CSS transitions for this one style change so every color switches in the same frame. */
    const freeze = document.createElement("style");
    freeze.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(freeze);
    root.dataset.theme = theme;
    void getComputedStyle(root).color;
    requestAnimationFrame(() => freeze.remove());
  }
  root.dataset.themePref = preference;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", THEME_COLORS[theme]));
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /** Storage can be unavailable (private mode); the choice then lasts for this page view only. */
  }
  applyTheme(preference);
}

/** Keeps "system" in step with the OS setting and other tabs in step with a choice made here. */
export function subscribeThemeSources(): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const onMedia = () => {
    if (readThemePreference() === "system") applyTheme("system");
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) applyTheme(readThemePreference());
  };
  media.addEventListener("change", onMedia);
  window.addEventListener("storage", onStorage);
  return () => {
    media.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}
