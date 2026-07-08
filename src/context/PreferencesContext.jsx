/* eslint-disable react-refresh/only-export-components -- provider + hook belong together (same pattern as CartContext) */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import { translations } from "../i18n/translations";

// Theme (light/dark) + language (en/th) applied app-wide.
// Persistence: localStorage (instant, works logged-out) + users/{uid} (account-level,
// same doc/fields Settings already writes — no schema change). Firestore wins once
// loaded so preferences follow the account across devices.
const THEME_KEY = "lkfc_theme";
const LANG_KEY = "lkfc_lang";

const PreferencesContext = createContext(undefined);

const readLocal = (key, allowed, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
};

export const PreferencesProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const [theme, setThemeState] = useState(() => readLocal(THEME_KEY, ["light", "dark", "system"], "light"));
  const [language, setLanguageState] = useState(() => readLocal(LANG_KEY, ["en", "th"], "en"));

  // Apply the theme to <html> so the .dark override layer (index.css) takes effect
  // everywhere instantly. "system" follows the OS prefers-color-scheme and re-applies
  // live when the OS switches (matchMedia change event).
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = theme === "dark" || (theme === "system" && mql.matches);
      document.documentElement.classList.toggle("dark", isDark);
    };
    apply();
    if (theme === "system") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
  }, [theme]);

  // Account-level sync: users/{uid}.theme/.language override local values once loaded.
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.theme === "light" || data.theme === "dark" || data.theme === "system") {
        setThemeState(data.theme);
        try { localStorage.setItem(THEME_KEY, data.theme); } catch { /* blocked storage */ }
      }
      if (data.language === "en" || data.language === "th") {
        setLanguageState(data.language);
        try { localStorage.setItem(LANG_KEY, data.language); } catch { /* blocked storage */ }
      }
    });
    return () => unsub();
  }, [uid]);

  const persist = useCallback(
    (patch) => {
      if (!uid) return;
      updateDoc(doc(db, "users", uid), patch).catch((err) =>
        console.error("Failed to save preference:", err)
      );
    },
    [uid]
  );

  const setTheme = useCallback(
    (value) => {
      setThemeState(value);
      try { localStorage.setItem(THEME_KEY, value); } catch { /* blocked storage */ }
      persist({ theme: value });
    },
    [persist]
  );

  const setLanguage = useCallback(
    (value) => {
      setLanguageState(value);
      try { localStorage.setItem(LANG_KEY, value); } catch { /* blocked storage */ }
      persist({ language: value });
    },
    [persist]
  );

  // t("key") / t("key", { km: 8 }) — falls back to EN, then the key itself.
  const t = useCallback(
    (key, params) => {
      let text = translations[language]?.[key] ?? translations.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replaceAll(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [language]
  );

  return (
    <PreferencesContext.Provider value={{ theme, setTheme, language, setLanguage, t }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (ctx === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
};
