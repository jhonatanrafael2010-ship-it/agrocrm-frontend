import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react"; // ícones modernos (já incluídos no shadcn/lucide)

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // 🚀 Ao iniciar, carrega preferência do localStorage ou tema do sistema
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = (stored as "light" | "dark") || (prefersDark ? "dark" : "light");
    setTheme(initial);
    applyTheme(initial);
  }, []);

  // 🔁 Atualiza tema
  const applyTheme = (mode: "light" | "dark") => {
    document.documentElement.setAttribute("data-bs-theme", mode);
    document.body.dataset.theme = mode;
    localStorage.setItem("theme", mode);
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

export default ThemeToggle;
