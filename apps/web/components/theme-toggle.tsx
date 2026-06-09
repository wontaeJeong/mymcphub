"use client";

import { useEffect, useState } from "react";
import { themeCopy } from "../lib/copy";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("mcp-hub-theme");
    const initial = stored === "dark" || stored === "light" ? stored : "light";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("mcp-hub-theme", next);
  }

  return <button className="themeToggle" type="button" aria-label={themeCopy.toggle} onClick={toggleTheme}>{theme === "dark" ? themeCopy.light : themeCopy.dark}</button>;
}
