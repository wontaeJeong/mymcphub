"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "mcp-hub-theme";

function resolveTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    return;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const resolved = resolveTheme();
    applyTheme(resolved);
    setTheme(resolved);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const currentLabel = theme === "dark" ? "다크" : "라이트";
  const nextLabel = nextTheme === "dark" ? "다크" : "라이트";

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={`현재 ${currentLabel} 모드입니다. ${nextLabel} 모드로 전환합니다.`}
      aria-pressed={theme === "dark"}
      onClick={() => {
        storeTheme(nextTheme);
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      <span>테마</span>
      <strong>{currentLabel}</strong>
    </button>
  );
}
