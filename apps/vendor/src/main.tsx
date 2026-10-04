import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mercurjs/vendor/index.css";
// Tema HETNA: debe cargarse después del CSS de Mercur para sobrescribir sus colores
import "./hetna-theme.css";
import App from "@mercurjs/vendor";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
