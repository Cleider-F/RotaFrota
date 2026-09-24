import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, Smartphone, X } from "lucide-react";

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const key = "rotafrota-install-reminder";
const changed = "rotafrota-install-availability";
let pending: InstallEvent | null = null;
let installedThisVisit = false;
function readReminder() {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function remember(until: number) {
  try {
    localStorage.setItem(key, String(until));
  } catch {
    /* Storage can be disabled. */
  }
}
function standalone() {
  return (
    Capacitor.isNativePlatform() ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
// Capture before React mounts, and keep the event when switching between areas.
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  pending = event as InstallEvent;
  installedThisVisit = false;
  window.dispatchEvent(new Event(changed));
});
window.addEventListener("appinstalled", () => {
  pending = null;
  installedThisVisit = true;
  window.dispatchEvent(new Event(changed));
});

export default function InstallSuggestion() {
  const [, refresh] = useState(0);
  const [hiddenUntil, setHiddenUntil] = useState(readReminder);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    const mode = window.matchMedia("(display-mode: standalone)");
    window.addEventListener(changed, update);
    mode.addEventListener("change", update);
    return () => {
      window.removeEventListener(changed, update);
      mode.removeEventListener("change", update);
    };
  }, []);
  if (
    !window.isSecureContext ||
    standalone() ||
    installedThisVisit ||
    hiddenUntil > Date.now() ||
    (!pending && !ios && !busy && !error)
  )
    return null;
  const dismiss = (alreadyInstalled = false) => {
    const until = alreadyInstalled
      ? Number.MAX_SAFE_INTEGER
      : Date.now() + 7 * 24 * 60 * 60 * 1000;
    remember(until);
    setHiddenUntil(until);
  };
  const install = async () => {
    if (!pending) {
      setHelp(true);
      return;
    }
    const event = pending;
    pending = null;
    setBusy(true);
    setError("");
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") installedThisVisit = true;
      else dismiss();
    } catch {
      setError(
        "Não foi possível abrir a instalação. Use a opção Instalar aplicativo no menu do navegador.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside className="install-suggestion" aria-label="Instalar RotaFrota">
      <Smartphone size={30} aria-hidden="true" />
      <div className="install-copy">
        <strong>Tenha o RotaFrota na tela inicial</strong>
        <p>
          Abra pelo ícone do celular para registrar sua viagem com mais
          facilidade.
        </p>
        {(pending || ios || busy) && <button
          className="install-action"
          type="button"
          disabled={busy}
          onClick={() => void install()}
        >
          <Download size={20} />
          {busy
            ? "Abrindo instalação…"
            : pending
              ? "Instalar aplicativo"
              : "Como instalar no iPhone"}
        </button>}
        {help && (
          <div className="install-help">
            <p>
              No Safari, toque em <b>Compartilhar</b>, escolha{" "}
              <b>Adicionar à Tela de Início</b> e confirme em <b>Adicionar</b>.
              Se estiver em outro navegador, abra este endereço no Safari.
            </p>
            <button type="button" onClick={() => dismiss(true)}>
              Já tenho o aplicativo instalado
            </button>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      <button
        className="install-dismiss"
        type="button"
        aria-label="Lembrar de instalar em 7 dias"
        onClick={() => dismiss()}
      >
        <X size={22} />
      </button>
    </aside>
  );
}
