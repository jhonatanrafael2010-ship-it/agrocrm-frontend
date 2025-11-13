{/*import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // 🚀 Inicializa lendo o localStorage ou preferências do sistema
  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (prefersDark ? "dark" : "light");

    setTheme(initial);
    applyTheme(initial, false);
  }, []);

  // ⚙️ Aplica o tema no HTML, body e Bootstrap
  const applyTheme = (mode: "light" | "dark", persist = true) => {
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.setAttribute("data-bs-theme", mode);
    document.body.setAttribute("data-theme", mode);
    if (persist) localStorage.setItem("theme", mode);

    // 🔄 Repaint suave
    requestAnimationFrame(() => {
      document.documentElement.style.transition = "none";
      void document.documentElement.offsetHeight;
      document.documentElement.style.transition = "";
    });
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="btn btn-outline-success d-flex align-items-center gap-2"
      style={{
        borderRadius: "50px",
        padding: "6px 12px",
        transition: "all 0.3s ease",
      }}
    >
      {theme === "dark" ? (
        <>
          <Sun size={18} /> <span>Claro</span>
        </>
      ) : (
        <>
          <Moon size={18} /> <span>Escuro</span>
        </>
      )}
    </button>
  );
};

export default ThemeToggle;*/}
