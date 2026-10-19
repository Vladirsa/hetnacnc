import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mercurjs/admin/index.css";
// Tema HETNA: debe cargarse después del CSS de Mercur para sobrescribir sus colores
import "./hetna-theme.css";
import App from "@mercurjs/admin";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
