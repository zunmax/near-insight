"use client";

import { useId, useLayoutEffect, useSyncExternalStore } from "react";
import { DEFAULT_THEME_PREFERENCE, THEME_PREFERENCES, type ThemePreference } from "@/config/theme";
import { applyTheme, readThemePreference, saveThemePreference, subscribeThemeSources } from "@/lib/theme";

const OPTIONS: Record<ThemePreference, { label: string; path: string }> = {
  light: { label: "Light", path: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" },
  dark: { label: "Dark", path: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" },
  system: { label: "System", path: "M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 16h8m-4-4v4" },
};

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-pref"] });
  const stopSources = subscribeThemeSources();
  return () => {
    observer.disconnect();
    stopSources();
  };
}

function getSnapshot(): ThemePreference {
  const preference = document.documentElement.dataset.themePref;
  return preference === "light" || preference === "dark" || preference === "system" ? preference : DEFAULT_THEME_PREFERENCE;
}

const getServerSnapshot = (): ThemePreference => DEFAULT_THEME_PREFERENCE;

/** Light / Dark / System choice, saved in this browser. */
export function ThemeSwitch() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  /** Each copy (sidebar, phone menu, landing header) is its own radio group. */
  const groupName = useId();

  /** React's development remount resets <html> attributes; re-apply the saved theme before paint (changes nothing in production). */
  useLayoutEffect(() => applyTheme(readThemePreference()), []);

  return (
    <fieldset className="theme-switch">
      <legend className="sr-only">Color theme</legend>
      {THEME_PREFERENCES.map((value) => (
        <label key={value} data-value={value} title={OPTIONS[value].label}>
          <input
            type="radio"
            name={groupName}
            value={value}
            checked={preference === value}
            onChange={() => saveThemePreference(value)}
            className="sr-only"
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[15px]">
            <path d={OPTIONS[value].path} />
          </svg>
          <span className="sr-only">{OPTIONS[value].label}</span>
        </label>
      ))}
    </fieldset>
  );
}
