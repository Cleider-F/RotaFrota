import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Fuel,
  ImageOff,
  LockKeyhole,
  Pencil,
  Route,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import * as api from "./data";
import AuditDetails from "./AuditDetails";
import {
  date,
  distance,
  efficiency,
  number,
  totalLiters,
  validateTrip,
  type Audit,
  type Member,
  type Trip,
  type Vehicle,
} from "./domain";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <div>
          <p className="eyebrow">ROTAFROTA</p>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Photo({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let disposed = false,
      objectUrl: string | null = null;
    api
      .photoURL(path)
      .then((u) => {
        objectUrl = u;
        if (!disposed) setUrl(u);
        else if (u?.startsWith("blob:")) URL.revokeObjectURL(u);
      })
      .catch(() =>
        setError(
          "Não foi possível carregar. Reabra a viagem para tentar novamente.",
        ),
      );
    return () => {
      disposed = true;
      if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  if (!url)
    return (
      <div className="photo-empty">
        <ImageOff size={21} />
        <span>
          {error ||
            (path === "demo-evidence"
              ? "Registro de exemplo · sem foto real"
              : "Carregando foto…")}
        </span>
      </div>
    );
  return (
    <div className={expanded ? "photo expanded" : "photo"}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? "Reduzir foto" : `Ampliar ${label}`}
      >
        <img src={url} alt={label} />
        <span>{expanded ? "Reduzir" : "Ampliar foto"}</span>
      </button>
    </div>
  );
}
function UploadField({
  label,
  file,
  setFile,
  required = true,
}: {
  label: string;
  file: File | null;
  setFile: (f: File | null) => void;
  required?: boolean;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <label className="upload-field">
      <span className="field-label">
        {label}
        {required && " *"}
      </span>
      <span className="upload-box">
        {preview ? (
          <img src={preview} alt="Prévia da foto selecionada" />
        ) : (
          <Camera size={30} />
        )}
        <b>{file ? file.name : "Tirar foto ou selecionar imagem"}</b>
        <small>Foto legível · JPG, PNG ou WebP · até 15 MB</small>
        <input
          aria-label={label}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          required={required && !file}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </span>
    </label>
  );
}
export function TripModal({
  mode,
  trip,
  trips,
  vehicles,
  who,
  onClose,
  onSaved,
}: {
  mode: "start" | "fill" | "finish" | "detail";
  trip?: Trip;
  trips: Trip[];
  vehicles: Vehicle[];
  who: Member;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Trip>(() =>
    trip
      ? structuredClone(trip)
      : {
          id: crypto.randomUUID(),
          driverId: who.userId,
          driver: who.name,
          plate: "",
          invoice: "",
          startPhoto: "",
          vehicleId: "",
          destination: "",
          origin: "",
          startKm: NaN,
          startFull: false,
          startedAt: new Date().toISOString(),
          fills: [],
          notes: "",
          version: 0,
        },
  );
  const [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const [startPhoto, setStartPhoto] = useState<File | null>(null);
  const [litersPhotos, setLitersPhotos] = useState<Record<string, File>>({});
  const [photo, setPhoto] = useState<File | null>(null),
    [fillPhotos, setFillPhotos] = useState<Record<string, File>>({});
  const [odometer, setOdometer] = useState(""),
    [liters, setLiters] = useState(""),
    [cost, setCost] = useState(""),
    [full, setFull] = useState(false);
  const [history, setHistory] = useState<Audit[]>([]),
    [historyError, setHistoryError] = useState("");
  const busyRef = useRef(false);
  useEffect(() => {
    if (trip && who.role === "technician")
      api
        .audit(trip.id)
        .then(setHistory)
        .catch(() => setHistoryError("Não foi possível carregar o histórico."));
  }, [trip, who.role]);
  const patch = (p: Partial<Trip>) => setDraft((t) => ({ ...t, ...p }));
  const patchFill = (id: string, p: Partial<Trip["fills"][number]>) =>
    patch({
      fills: draft.fills.map((f) => (f.id === id ? { ...f, ...p } : f)),
    });
  const close = () => {
    if (!busyRef.current) onClose();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (!api.isDemo && !navigator.onLine)
        throw new Error("Conecte-se à internet para enviar o registro.");
      let next = structuredClone(draft);
      const now = new Date().toISOString();
      if (mode === "fill") {
        if (!photo)
          throw new Error("Anexe a foto do hodômetro no abastecimento.");
        next.fills.push({
          id: crypto.randomUUID(),
          at: now,
          odometer: Number(odometer),
          liters: Number(liters),
          full,
          photo: "pending",
          litersPhoto: "pending",
          ...(cost ? { cost: Number(cost) } : {}),
        });
      }
      if (mode === "finish") {
        if (!photo) throw new Error("Anexe a foto do hodômetro final.");
        next = {
          ...next,
          endKm: Number(odometer),
          endPhoto: "pending",
          endedAt: now,
        };
      }
      validateTrip(next);
      if (mode === "detail" && reason.trim().length < 5)
        throw new Error(
          "Descreva o motivo da correção (pelo menos 5 caracteres).",
        );
      if (photo) {
        const path = await api.upload(photo, who);
        if (mode === "fill") next.fills[next.fills.length - 1].photo = path;
        else next.endPhoto = path;
      }
      for (const [id, file] of Object.entries(fillPhotos)) {
        const path = await api.upload(file, who);
        next.fills = next.fills.map((f) =>
          f.id === id ? { ...f, photo: path } : f,
        );
      }
      if (startPhoto) next.startPhoto = await api.upload(startPhoto, who);
      for (const [id, file] of Object.entries(litersPhotos)) {
        const path = await api.upload(file, who);
        next.fills = next.fills.map((f) =>
          f.id === id ? { ...f, litersPhoto: path } : f,
        );
      }
      await api.saveTrip(
        next,
        who,
        mode === "detail"
          ? reason
          : {
              start: "Início da viagem",
              fill: "Registro de abastecimento",
              finish: "Encerramento da viagem",
            }[mode],
      );
      onSaved(
        mode === "detail"
          ? "Correção salva com histórico."
          : mode === "start"
            ? "Viagem iniciada."
            : mode === "fill"
              ? "Abastecimento e foto enviados."
              : "Viagem finalizada com evidência.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const title =
    mode === "start"
      ? "Iniciar viagem"
      : mode === "fill"
        ? "Registrar abastecimento"
        : mode === "finish"
          ? "Finalizar viagem"
          : editing
            ? "Corrigir viagem"
            : "Detalhes da viagem";
  const readonly = mode === "detail" && !editing;
  return (
    <Dialog title={title} onClose={close} wide={mode === "detail"}>
      <form onSubmit={submit} className="modal-body">
        <fieldset disabled={busy} className="form-fieldset">
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {readonly ? (
            <>
              <div className="detail-summary">
                <span className={`badge ${trip?.endedAt ? "done" : "running"}`}>
                  {trip?.endedAt ? "Concluída" : "Em viagem"}
                </span>
                <h3>Nota nº {draft.invoice}</h3>
                <p>
                  {draft.driver} · {draft.plate}
                </p>
                <small>
                  Início: {date(draft.startedAt)}
                  {draft.endedAt && ` · Fim: ${date(draft.endedAt)}`}
                </small>
              </div>
              <div className="detail-stats">
                <div>
                  <small>Distância registrada</small>
                  <b>{number(distance(draft))} km</b>
                </div>
                <div>
                  <small>Abastecido</small>
                  <b>{number(totalLiters(draft), 2)} L</b>
                </div>
                <div>
                  <small>Consumo aferido</small>
                  <b>
                    {efficiency(draft).value !== null
                      ? number(efficiency(draft).value!, 2)
                      : "—"}{" "}
                    km/L
                  </b>
                </div>
              </div>
              <div className="info-note">
                Consumo aferido: intervalos entre tanques cheios dentro desta
                viagem.{" "}
                {totalLiters(draft) > 0 && (
                  <>
                    Relação bruta distância/abastecido:{" "}
                    {number(distance(draft) / totalLiters(draft), 2)} km/L (não
                    equivale necessariamente ao consumo).
                  </>
                )}
              </div>
              <h3 className="subheading">Registros da viagem</h3>
              <div className="timeline-entry">
                <span className="timeline-icon">
                  <Route size={18} />
                </span>
                <div>
                  <b>Saída · {number(draft.startKm)} km</b>
                  <small>
                    {date(draft.startedAt)} ·{" "}
                    {draft.startFull
                      ? "Tanque cheio"
                      : "Nível inicial não aferido"}
                  </small>
                </div>
              </div>
              <Photo path={draft.startPhoto} label="Hodômetro inicial" />
              {draft.fills.map((f, i) => (
                <div className="evidence-record" key={f.id}>
                  <div className="timeline-entry">
                    <span className="timeline-icon">
                      <Fuel size={18} />
                    </span>
                    <div>
                      <b>
                        Abastecimento {i + 1} · {number(f.liters, 2)} litros
                      </b>
                      <small>
                        {number(f.odometer)} km · {date(f.at)} ·{" "}
                        {f.full ? "Tanque cheio" : "Parcial"}
                        {f.cost !== undefined
                          ? ` · R$ ${number(f.cost, 2)}`
                          : ""}
                      </small>
                    </div>
                  </div>
                  <Photo
                    path={f.photo}
                    label={`Hodômetro no abastecimento ${i + 1}`}
                  />
                  <Photo
                    path={f.litersPhoto}
                    label={`Litros do abastecimento ${i + 1}`}
                  />
                </div>
              ))}
              {draft.endedAt && (
                <div className="evidence-record">
                  <div className="timeline-entry">
                    <span className="timeline-icon">
                      <Check size={18} />
                    </span>
                    <div>
                      <b>Chegada · {number(draft.endKm!)} km</b>
                      <small>{date(draft.endedAt)}</small>
                    </div>
                  </div>
                  <Photo path={draft.endPhoto!} label="Hodômetro final" />
                </div>
              )}
              {draft.notes && <div className="info-note">{draft.notes}</div>}
              {who.role === "technician" && (
                <>
                  <div className="section-line">
                    <h3>Histórico de alterações</h3>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil size={16} />
                      Corrigir viagem
                    </button>
                  </div>
                  {historyError && <p role="alert">{historyError}</p>}
                  {!history.length && !historyError && (
                    <p className="hint">
                      Nenhuma alteração registrada
                      {api.isDemo ? " para este exemplo" : ""}.
                    </p>
                  )}
                  {history.map((a) => (
                    <details className="audit-entry" key={a.id}>
                      <summary>
                        <b>{a.reason}</b>
                        <small>
                          {a.actor} · {date(a.at)}
                        </small>
                      </summary>
                      <AuditDetails entry={a} vehicles={vehicles} />
                    </details>
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              {(mode === "start" || editing) && (
                <>
                  <div className="form-grid">
                    <label>
                      Motorista *
                      <input
                        required
                        maxLength={100}
                        value={draft.driver}
                        onChange={(e) => patch({ driver: e.target.value })}
                      />
                    </label>
                    <label>
                      Placa do veículo *
                      <input
                        required
                        maxLength={7}
                        value={draft.plate}
                        onChange={(e) =>
                          patch({
                            plate: e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, ""),
                            vehicleId: e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, ""),
                          })
                        }
                      />
                    </label>
                    <label>
                      Número da nota *
                      <input
                        required
                        maxLength={100}
                        value={draft.invoice}
                        onChange={(e) => patch({ invoice: e.target.value })}
                      />
                    </label>
                    <label>
                      Hodômetro inicial (km) *
                      <input
                        required
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="9999999"
                        step="1"
                        value={Number.isNaN(draft.startKm) ? "" : draft.startKm}
                        onChange={(e) =>
                          patch({
                            startKm:
                              e.target.value === ""
                                ? NaN
                                : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <UploadField
                    label="Substituir foto inicial (opcional)"
                    file={startPhoto}
                    setFile={setStartPhoto}
                    required={false}
                  />
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={draft.startFull}
                      onChange={(e) => patch({ startFull: e.target.checked })}
                    />
                    <span>
                      Estou saindo com o tanque cheio
                      <small>
                        Use somente se o tanque foi completado antes da saída.
                      </small>
                    </span>
                  </label>
                </>
              )}
              {(mode === "fill" || mode === "finish") && (
                <>
                  <div className="trip-context">
                    <Truck size={22} />
                    <div>
                      <b>
                        {vehicles.find((v) => v.id === draft.vehicleId)?.plate}{" "}
                        · {draft.destination}
                      </b>
                      <small>
                        Último hodômetro:{" "}
                        {number(draft.fills.at(-1)?.odometer ?? draft.startKm)}{" "}
                        km
                      </small>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label>
                      Hodômetro{" "}
                      {mode === "finish" ? "final" : "no abastecimento"} (km) *
                      <input
                        autoFocus
                        required
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min={draft.fills.at(-1)?.odometer ?? draft.startKm}
                        max="9999999"
                        placeholder="Ex.: 48520"
                        value={odometer}
                        onChange={(e) => setOdometer(e.target.value)}
                      />
                    </label>
                    {mode === "fill" && (
                      <>
                        <label>
                          Quantidade abastecida (litros) *
                          <input
                            required
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            max="2000"
                            placeholder="Ex.: 80,50"
                            value={liters}
                            onChange={(e) => setLiters(e.target.value)}
                          />
                        </label>
                        <label>
                          Valor total (R$) · opcional
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  {mode === "fill" && (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={full}
                        onChange={(e) => setFull(e.target.checked)}
                      />
                      <span>
                        Completei o tanque
                        <small>
                          Permite aferir o consumo entre abastecimentos
                          completos.
                        </small>
                      </span>
                    </label>
                  )}
                  <UploadField
                    label={
                      mode === "finish"
                        ? "Foto do hodômetro final"
                        : "Foto do hodômetro no abastecimento"
                    }
                    file={photo}
                    setFile={setPhoto}
                  />
                </>
              )}
              {editing && (
                <>
                  {draft.fills.map((f, i) => (
                    <div className="edit-fill" key={f.id}>
                      <h3>Abastecimento {i + 1}</h3>
                      <div className="form-grid">
                        <label>
                          Hodômetro (km)
                          <input
                            required
                            type="number"
                            step="1"
                            min="0"
                            max="9999999"
                            value={f.odometer}
                            onChange={(e) =>
                              patchFill(f.id, {
                                odometer:
                                  e.target.value === ""
                                    ? NaN
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Litros
                          <input
                            required
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="2000"
                            value={f.liters}
                            onChange={(e) =>
                              patchFill(f.id, {
                                liters:
                                  e.target.value === ""
                                    ? NaN
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Valor total (R$)
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={f.cost ?? ""}
                            onChange={(e) =>
                              patchFill(f.id, {
                                cost: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                          />
                        </label>
                      </div>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={f.full}
                          onChange={(e) =>
                            patchFill(f.id, { full: e.target.checked })
                          }
                        />
                        Tanque cheio
                      </label>
                      <Photo
                        path={f.litersPhoto}
                        label={`Litros originais ${i + 1}`}
                      />
                      <UploadField
                        label="Substituir foto dos litros (opcional)"
                        file={litersPhotos[f.id] ?? null}
                        required={false}
                        setFile={(file) => {
                          const next = { ...litersPhotos };
                          if (file) next[f.id] = file;
                          else delete next[f.id];
                          setLitersPhotos(next);
                        }}
                      />
                      <Photo
                        path={f.photo}
                        label={`Evidência original ${i + 1}`}
                      />
                      <UploadField
                        label="Substituir foto (opcional)"
                        file={fillPhotos[f.id] ?? null}
                        required={false}
                        setFile={(file) => {
                          const next = { ...fillPhotos };
                          if (file) next[f.id] = file;
                          else delete next[f.id];
                          setFillPhotos(next);
                        }}
                      />
                    </div>
                  ))}
                  {draft.endedAt && (
                    <>
                      <label>
                        Hodômetro final (km)
                        <input
                          required
                          type="number"
                          step="1"
                          min="0"
                          max="9999999"
                          value={draft.endKm}
                          onChange={(e) =>
                            patch({
                              endKm:
                                e.target.value === ""
                                  ? NaN
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <UploadField
                        label="Substituir foto final (opcional)"
                        file={photo}
                        setFile={setPhoto}
                        required={false}
                      />
                    </>
                  )}
                  <label>
                    Motivo da correção *
                    <textarea
                      required
                      minLength={5}
                      maxLength={500}
                      placeholder="Explique o que foi corrigido e por quê."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="info-note">
                    <ShieldCheck size={17} />A versão anterior e o motivo ficam
                    preservados no histórico.
                  </div>
                </>
              )}
              <label>
                Observações · opcional
                <textarea
                  maxLength={1000}
                  placeholder="Informações sobre a viagem"
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
            </>
          )}
          <div className="modal-actions">
            <button className="secondary" type="button" onClick={close}>
              {readonly ? "Fechar" : "Cancelar"}
            </button>
            {!readonly && (
              <button className="primary" type="submit">
                {busy
                  ? "Enviando…"
                  : mode === "start"
                    ? "Iniciar viagem"
                    : mode === "fill"
                      ? "Salvar abastecimento"
                      : mode === "finish"
                        ? "Finalizar viagem"
                        : "Salvar correção"}
                {!busy && <Check size={17} />}
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
export function VehicleModal({
  who,
  onClose,
  onSaved,
}: {
  who: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [plate, setPlate] = useState(""),
    [name, setName] = useState(""),
    [fuel, setFuel] = useState("Diesel S10"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      title="Adicionar veículo"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="modal-body"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          try {
            await api.saveVehicle(
              {
                id: crypto.randomUUID(),
                plate: plate.trim().replace("-", ""),
                name: name.trim(),
                fuel,
              },
              who,
            );
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="form-fieldset">
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <label>
            Placa *
            <input
              required
              maxLength={8}
              placeholder="ABC1D23"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Modelo *
            <input
              required
              maxLength={100}
              placeholder="Ex.: Volvo FH 540"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Combustível
            <select value={fuel} onChange={(e) => setFuel(e.target.value)}>
              {[
                "Diesel S10",
                "Diesel S500",
                "Gasolina",
                "Etanol",
                "Flex",
                "GNV",
              ].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary">
              {busy ? "Salvando…" : "Cadastrar veículo"}
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
export function Login({
  onLogin,
  error,
}: {
  onLogin: () => Promise<void>;
  error: string;
}) {
  const [creating, setCreating] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-screen">
      <div className="login-story">
        <span className="brand">
          <span className="brand-mark">
            <Route />
          </span>
          rota<span>frota</span>
        </span>
        <h1>
          Inteligência em
          <br />
          cada quilômetro.
        </h1>
        <p>
          Do primeiro registro à última parada.
          <br />
          Toda a sua operação em um só lugar.
        </p>
        <div className="login-benefit">
          <ShieldCheck />
          Dados e evidências da sua empresa, protegidos.
        </div>
      </div>
      <section className="login-panel">
        <LockKeyhole size={30} />
        <h2>{creating ? 'Criar conta' : 'Acesso ao painel'}</h2>
        <a className="area-switch" href="#/">Voltar para o motorista</a>
        <p>
          {creating ? 'Use o e-mail autorizado pelo administrador. Você receberá uma confirmação para comprovar que o e-mail é seu.' : 'Entre com seu e-mail e senha para ver viagens, fotos e relatórios.'}
        </p>
        {api.isDemo && (
          <div className="info-note">
            Demonstração local. E-mail: tecnico@rotafrota.demo · Senha:
            RotaFrota123!
          </div>
        )}
        {
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                if (creating) {
                  if (password !== confirmPassword) throw new Error('As senhas não coincidem.');
                  await api.registerAccount(email,password);
                  setCreating(false); setPassword(''); setConfirmPassword('');
                  setMessage('Conta criada! Confirme o e-mail recebido e depois entre com sua senha. Verifique também o spam.');
                  return;
                }
                await api.login(email, password);
                await onLogin();
              } catch (e) {
                setMessage(api.friendlyError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail
              <input
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Senha
              <input
                autoComplete={creating ? 'new-password' : 'current-password'}
                minLength={creating ? 10 : undefined}
                maxLength={128}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {creating && <label>Confirme a senha (mínimo 10 caracteres)<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>}
            <button className="primary" disabled={busy}>
              {busy ? "Aguarde…" : creating ? 'Criar minha conta' : "Entrar"}
              <ChevronRight size={18} />
            </button>
          </form>
        }
        {!api.isDemo && <button className="text-button" disabled={busy} onClick={() => {setCreating(!creating);setMessage('');setPassword('');setConfirmPassword('');}}>{creating ? 'Já tenho conta — entrar' : 'Criar conta'}</button>}
        {!api.isDemo && <button className="text-button" disabled={busy} onClick={async () => {setBusy(true);setMessage('');try {await api.resendConfirmation(email,password);setMessage('Confirmação enviada. Verifique seu e-mail e o spam.');} catch(e) {setMessage(api.friendlyError(e));} finally {setBusy(false);}}}>Reenviar confirmação</button>}
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api.resetPassword(email);
              setMessage(
                "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.",
              );
            } catch (e) {
              setMessage(api.friendlyError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Esqueci minha senha
        </button>
        {(message || error) && (
          <p className="alert" role="alert">
            {message || error}
          </p>
        )}
        <p className="hint">
          Para criar ou recuperar seu acesso, fale com o administrador da
          empresa.
        </p>
      </section>
    </div>
  );
}
