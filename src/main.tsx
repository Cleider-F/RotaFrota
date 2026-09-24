import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./styles.css";
import "./driver.css";
// Live Server is for previewing dist. Avoid registering a PWA worker on its origin.
if (
  !Capacitor.isNativePlatform() &&
  !import.meta.env.DEV &&
  location.port !== "5500"
) {
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      const banner = document.createElement('aside');
      banner.className = 'pwa-update';
      banner.setAttribute('role', 'status');
      const text = document.createElement('p');
      text.textContent = 'Nova versão disponível. Termine seu envio antes de atualizar.';
      const button = document.createElement('button');
      button.textContent = 'Atualizar aplicativo';
      button.onclick = () => void update(true);
      banner.append(text, button);
      document.body.append(banner);
    },
  });
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
