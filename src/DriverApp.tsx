import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Flag,
  Fuel,
  Route,
  Truck,
  WifiOff,
} from "lucide-react";
import * as api from "./data";
import { date, number, validateTrip, type Member, type Trip } from "./domain";
type Step = "home" | "start" | "fill" | "finish";
export function EvidenceInput({
  label,
  help,
  file,
  onChange,
}: {
  label: string;
  help: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <label className={`driver-photo ${file ? "has-photo" : ""}`}>
      <span className="driver-field-title">{label}</span>
      <span className="driver-help">{help}</span>
      <span className="driver-photo-target">
        {preview ? (
          <>
            <img src={preview} alt={`Foto selecionada: ${label}`} />
            <span>
              <CheckCircle2 size={24} />
              Foto adicionada
            </span>
            <small>Toque para trocar a foto</small>
          </>
        ) : (
          <>
            <Camera size={34} />
            <b>Toque aqui para tirar a foto</b>
            <small>Você também pode escolher uma foto do celular.</small>
          </>
        )}
        <input
          aria-label={label}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          required={!file}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </span>
    </label>
  );
}
export default function DriverApp() {
  const [who, setWho] = useState<Member | null>(null),
    [trips, setTrips] = useState<Trip[]>([]),
    [step, setStep] = useState<Step>("home");
  const [driver, setDriver] = useState(""),
    [plate, setPlate] = useState(""),
    [invoice, setInvoice] = useState(""),
    [km, setKm] = useState(""),
    [liters, setLiters] = useState("");
  const [photo, setPhoto] = useState<File | null>(null),
    [litersPhoto, setLitersPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [online, setOnline] = useState(navigator.onLine);
  const submitting = useRef(false),
    newId = useRef(crypto.randomUUID());
  const refresh = async (m: Member) => {
    const result = await api.loadDriver(m);
    setTrips(result.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
  };
  const connect = async () => {
    setLoading(true);
    setError("");
    try {
      const m = await api.driverMember();
      setWho(m);
      await refresh(m);
    } catch (e) {
      setError(api.friendlyError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void connect();
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  useEffect(() => {
    if (!who) return;
    return api.subscribeDriver(
      who,
      () => void refresh(who).catch((e) => setError(api.friendlyError(e))),
      setError,
    );
  }, [who]);
  const active = trips.find((t) => !t.endedAt),
    formStep = step === "home" && !active ? "start" : step;
  const choose = (next: Step) => {
    setStep(next);
    setKm("");
    setLiters("");
    setPhoto(null);
    setLitersPhoto(null);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current || !who) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (!api.isDemo && !navigator.onLine)
        throw new Error(
          "Conecte seu celular à internet para enviar. Não feche esta tela.",
        );
      if (!photo)
        throw new Error("Falta adicionar a foto do painel do veículo.");
      const kmValue = Number(km),
        litersValue = Number(liters.replace(",", "."));
      if (!/^\d+$/.test(km))
        throw new Error(
          "Digite apenas os números da quilometragem, sem pontos.",
        );
      const now = new Date().toISOString();
      let next: Trip;
      if (formStep === "start")
        next = {
          id: newId.current,
          driverId: who.userId,
          driver: driver.trim(),
          plate: plate.replace(/[^A-Z0-9]/g, ""),
          invoice: invoice.trim(),
          vehicleId: plate.replace(/[^A-Z0-9]/g, ""),
          origin: "",
          destination: "",
          startKm: kmValue,
          startPhoto: "pending",
          startFull: false,
          startedAt: now,
          fills: [],
          version: 0,
          notes: "",
        };
      else {
        if (!active)
          throw new Error("Esta viagem já foi finalizada. Atualize a página.");
        next = structuredClone(active);
        if (formStep === "fill") {
          if (!litersPhoto)
            throw new Error(
              "Falta a foto da bomba ou nota mostrando os litros.",
            );
          next.fills.push({
            id: crypto.randomUUID(),
            at: now,
            odometer: kmValue,
            liters: litersValue,
            photo: "pending",
            litersPhoto: "pending",
            full: false,
          });
        } else {
          next.endKm = kmValue;
          next.endPhoto = "pending";
          next.endedAt = now;
        }
      }
      validateTrip(next);
      const path = await api.upload(photo, who);
      if (formStep === "start") next.startPhoto = path;
      else if (formStep === "fill") {
        next.fills[next.fills.length - 1].photo = path;
        next.fills[next.fills.length - 1].litersPhoto = await api.upload(
          litersPhoto!,
          who,
        );
      } else next.endPhoto = path;
      await api.saveTrip(
        next,
        who,
        formStep === "start"
          ? "Início da viagem"
          : formStep === "fill"
            ? "Registro de abastecimento"
            : "Encerramento da viagem",
      );
      await refresh(who);
      setStep("home");
      setKm("");
      setLiters("");
      setPhoto(null);
      setLitersPhoto(null);
      newId.current = crypto.randomUUID();
      setMessage(
        formStep === "start"
          ? "Viagem iniciada! Boa viagem."
          : formStep === "fill"
            ? "Abastecimento enviado! Você pode continuar a viagem."
            : "Viagem finalizada! Todos os dados foram enviados.",
      );
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      setError(api.friendlyError(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="driver-app">
      <header className="driver-header">
        <span className="brand">
          <span className="brand-mark">
            <Route size={25} />
          </span>
          rota<span>frota</span>
        </span>
        <a className="area-switch" href="#/admin" aria-disabled={busy} onClick={(event) => { if (busy) event.preventDefault(); }}>Painel técnico <ArrowRight size={18} /></a>
      </header>
      <main className="driver-main">
        {api.isDemo && (
          <div className="driver-demo">
            Demonstração · Os envios ficam somente neste navegador.
          </div>
        )}
        {!online && (
          <div className="driver-notice">
            <WifiOff size={22} />
            <p>Sem internet. Aguarde a conexão antes de enviar.</p>
          </div>
        )}
        {message && (
          <div className="driver-success" role="status">
            <CheckCircle2 size={30} />
            <div>
              <b>{message}</b>
              <p>Você não precisa enviar novamente.</p>
            </div>
          </div>
        )}
        {error && (
          <div className="driver-error" role="alert">
            <b>Não foi possível concluir</b>
            <p>{error}</p>
            {!who && (
              <button
                className="driver-primary"
                onClick={() => void connect()}
                disabled={loading}
              >
                Tentar conectar novamente
              </button>
            )}
          </div>
        )}
        {loading ? (
          <div className="driver-loading">Preparando seu formulário…</div>
        ) : (
          <>
            {active && formStep === "home" ? (
              <>
                <div className="driver-intro">
                  <span className="driver-kicker">VIAGEM EM ANDAMENTO</span>
                  <h1>O que você precisa registrar?</h1>
                  <p>Escolha uma das opções abaixo.</p>
                </div>
                <section className="driver-trip-card">
                  <Truck size={30} />
                  <div>
                    <b>{active.plate}</b>
                    <p>{active.driver}</p>
                    <small>Nota nº {active.invoice}</small>
                  </div>
                  <span className="driver-status">Em viagem</span>
                </section>
                <div className="driver-big-actions">
                  <button
                    className="driver-action fuel"
                    onClick={() => choose("fill")}
                  >
                    <span className="action-symbol">
                      <Fuel size={30} />
                    </span>
                    <span>
                      <b>Abasteci o veículo</b>
                      <small>Enviar km, litros e fotos do abastecimento.</small>
                    </span>
                    <ArrowRight size={25} />
                  </button>
                  <button
                    className="driver-action finish"
                    onClick={() => choose("finish")}
                  >
                    <span className="action-symbol">
                      <Flag size={30} />
                    </span>
                    <span>
                      <b>Terminei a viagem</b>
                      <small>Enviar km final e foto do painel.</small>
                    </span>
                    <ArrowRight size={25} />
                  </button>
                </div>
                <p className="driver-support">
                  Pode abastecer mais de uma vez. Envie um registro a cada
                  parada.
                </p>
              </>
            ) : (
              <>
                {formStep !== "start" && (
                  <button
                    className="driver-back"
                    disabled={busy}
                    onClick={() => choose("home")}
                  >
                    <ArrowLeft size={21} />
                    Voltar para minha viagem
                  </button>
                )}
                <div className="driver-intro">
                  <span className="driver-kicker">
                    {formStep === "start"
                      ? "ANTES DE SAIR"
                      : formStep === "fill"
                        ? "NO POSTO"
                        : "AO CHEGAR"}
                  </span>
                  <h1>
                    {formStep === "start"
                      ? "Vamos iniciar sua viagem?"
                      : formStep === "fill"
                        ? "Registrar abastecimento"
                        : "Finalizar minha viagem"}
                  </h1>
                  <p>
                    {formStep === "start"
                      ? "Preencha seus dados e tire uma foto do painel."
                      : formStep === "fill"
                        ? "Informe o km do veículo e quantos litros abasteceu."
                        : "Informe o km que aparece no painel e tire uma foto."}
                  </p>
                </div>
                <form className="driver-form" onSubmit={submit}>
                  <fieldset disabled={busy || !who}>
                    {formStep === "start" && (
                      <section className="driver-form-card">
                        <h2>
                          <span>1</span>Identifique a viagem
                        </h2>
                        <label>
                          Nome do motorista
                          <input
                            autoComplete="name"
                            required
                            maxLength={100}
                            placeholder="Digite seu nome completo"
                            value={driver}
                            onChange={(e) => setDriver(e.target.value)}
                          />
                        </label>
                        <label>
                          Placa do veículo
                          <span className="driver-help">
                            Exemplo: ABC1D23 ou ABC1234.
                          </span>
                          <input
                            autoCapitalize="characters"
                            autoComplete="off"
                            required
                            maxLength={8}
                            placeholder="ABC1D23"
                            value={plate}
                            onChange={(e) =>
                              setPlate(e.target.value.toUpperCase())
                            }
                          />
                        </label>
                        <label>
                          Número da nota
                          <span className="driver-help">
                            Copie o número que está na nota desta viagem.
                          </span>
                          <input
                            required
                            maxLength={100}
                            inputMode="numeric"
                            placeholder="Exemplo: 12345"
                            value={invoice}
                            onChange={(e) => setInvoice(e.target.value)}
                          />
                        </label>
                      </section>
                    )}
                    {formStep !== "start" && active && (
                      <div className="driver-form-context">
                        <Truck size={22} />
                        <b>{active.plate}</b>
                        <span>Nota {active.invoice}</span>
                      </div>
                    )}
                    <section className="driver-form-card">
                      <h2>
                        <span>{formStep === "start" ? "2" : "1"}</span>
                        {formStep === "start"
                          ? "Quilometragem de saída"
                          : formStep === "fill"
                            ? "Quilometragem no posto"
                            : "Quilometragem de chegada"}
                      </h2>
                      <label>
                        {formStep === "start"
                          ? "Km inicial"
                          : formStep === "fill"
                            ? "Km no abastecimento"
                            : "Km final"}
                        <span className="driver-help">
                          Olhe o número de quilômetros no painel. Digite apenas
                          os números, sem pontos.
                        </span>
                        <div className="driver-number">
                          <input
                            required
                            inputMode="numeric"
                            pattern="[0-9]+"
                            placeholder="Exemplo: 48520"
                            value={km}
                            onChange={(e) => setKm(e.target.value)}
                          />
                          <span>km</span>
                        </div>
                      </label>
                      <EvidenceInput
                        label={
                          formStep === "start"
                            ? "Foto do km inicial"
                            : formStep === "fill"
                              ? "Foto do km no abastecimento"
                              : "Foto do km final"
                        }
                        help="Fotografe o painel. O número de quilômetros precisa estar legível."
                        file={photo}
                        onChange={setPhoto}
                      />
                    </section>
                    {formStep === "fill" && (
                      <section className="driver-form-card">
                        <h2>
                          <span>2</span>Quantidade abastecida
                        </h2>
                        <label>
                          Quantos litros abasteceu?
                          <span className="driver-help">
                            Copie a quantidade de litros da bomba ou da nota.
                            Não informe o valor em reais.
                          </span>
                          <div className="driver-number">
                            <input
                              required
                              inputMode="decimal"
                              pattern="[0-9]+([.,][0-9]{1,2})?"
                              placeholder="Exemplo: 50,25"
                              value={liters}
                              onChange={(e) => setLiters(e.target.value)}
                            />
                            <span>litros</span>
                          </div>
                        </label>
                        <EvidenceInput
                          label="Foto dos litros abastecidos"
                          help="Fotografe a bomba ou a nota mostrando a quantidade de litros."
                          file={litersPhoto}
                          onChange={setLitersPhoto}
                        />
                      </section>
                    )}
                    <div className="driver-submit">
                      <button className="driver-primary" type="submit">
                        {busy
                          ? "Enviando, aguarde…"
                          : formStep === "start"
                            ? "Enviar e iniciar viagem"
                            : formStep === "fill"
                              ? "Enviar abastecimento"
                              : "Enviar e finalizar viagem"}
                        {!busy && <Check size={23} />}
                      </button>
                      <p>
                        {busy
                          ? "Não feche esta tela enquanto os dados são enviados."
                          : "Confira os números e as fotos antes de enviar."}
                      </p>
                    </div>
                  </fieldset>
                </form>
              </>
            )}
            {formStep === "home" && active && (
              <section className="driver-receipts">
                <h2>Envios desta viagem</h2>
                <p>
                  <CheckCircle2 size={18} />
                  Início enviado · {date(active.startedAt)}
                </p>
                {active.fills.map((f, i) => (
                  <p key={f.id}>
                    <CheckCircle2 size={18} />
                    Abastecimento {i + 1} enviado · {date(f.at)}
                  </p>
                ))}
              </section>
            )}
          </>
        )}
        <footer className="driver-footer">
          RotaFrota · Registro do motorista
          <p>Precisa corrigir um envio? Avise o responsável pela frota.</p>
        </footer>
      </main>
    </div>
  );
}
