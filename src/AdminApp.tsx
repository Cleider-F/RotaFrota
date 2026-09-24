import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Download,
  Fuel,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Truck,
  X,
} from "lucide-react";
import * as api from "./data";
import {
  date,
  distance,
  efficiency,
  estimatedEfficiency,
  number,
  totalLiters,
  type Member,
  type Trip,
  type Vehicle,
} from "./domain";
import { TripModal, VehicleModal, Login } from "./components";
import TechniciansPanel from "./TechniciansPanel";
type Page = "overview" | "trips" | "vehicles" | "settings" | "technicians";
export default function AdminApp() {
  const [who, setWho] = useState<Member | null>(null),
    [ready, setReady] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]),
    [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [page, setPage] = useState<Page>("overview"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [status, setStatus] = useState("Conectando…");
  const [modal, setModal] = useState<{
      type: "start" | "fill" | "finish" | "detail";
      trip?: Trip;
    } | null>(null),
    [vehicleModal, setVehicleModal] = useState(false);
  const [online, setOnline] = useState(navigator.onLine),
    [installPrompt, setInstallPrompt] = useState<any>(null);
  const [period, setPeriod] = useState("30");
  const refresh = useCallback(async () => {
    try {
      const d = await api.load();
      setTrips(d.trips.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
      setVehicles(d.vehicles);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const init = useCallback(async () => {
    try {
      const m = await api.member();
      setWho(m);
      if (m) {
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReady(true);
    }
  }, [refresh]);
  useEffect(() => {
    void init();
    return api.watchAdmin(() => {
      void api.member().then((m) => {
        setWho(m);
        if (!m) {
          setTrips([]);
          setVehicles([]);
          setModal(null);
        }
      });
    });
  }, [init]);
  useEffect(() => {
    if (!who) return;
    return api.subscribe(() => void refresh(), setStatus);
  }, [who, refresh]);
  useEffect(() => {
    const on = () => {
        setOnline(true);
        void refresh();
      },
      off = () => setOnline(false),
      prompt = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("beforeinstallprompt", prompt);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const notify = (message: string) => {
    setToast(message);
    void refresh();
  };
  if (!ready)
    return (
      <div className="loading">
        <Route size={38} />
        <p>Abrindo sua frota…</p>
      </div>
    );
  if (!who || who.role !== "technician")
    return <Login onLogin={init} error={error} />;
  const tech = who.role === "technician";
  const active = trips.filter((t) => !t.endedAt),
    cutoff = Date.now() - Number(period) * 86400000;
  const periodTrips = trips.filter(
    (t) => new Date(t.startedAt).getTime() >= cutoff,
  );
  const scoped = periodTrips;
  const visible = scoped.filter(
    (t) =>
      (filter === "all" || (filter === "active" ? !t.endedAt : !!t.endedAt)) &&
      `${t.driver} ${t.invoice} ${t.plate}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const km = periodTrips.reduce((s, t) => s + distance(t), 0),
    liters = periodTrips.reduce((s, t) => s + totalLiters(t), 0);
  const measured = periodTrips.map(estimatedEfficiency),
    measuredKm = measured.reduce((s, e) => s + e.km, 0),
    measuredLiters = measured.reduce((s, e) => s + e.liters, 0);
  const nav = (next: Page) => {
    setPage(next);
    setSearch("");
    setFilter("all");
  };
  const exportCsv = () => {
    const escape = (v: unknown) =>
      `"${String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      [
        "Motorista",
        "Placa",
        "Nota",
        "Início",
        "Status",
        "Km registrados",
        "Litros",
        "Rendimento estimado km/L",
      ],
      ...visible.map((t) => [
        t.driver,
        t.plate,
        t.invoice,
        date(t.startedAt),
        t.endedAt ? "Concluída" : "Em viagem",
        distance(t),
        totalLiters(t).toFixed(2).replace(".", ","),
        estimatedEfficiency(t).value?.toFixed(2).replace(".", ",") ??
          "Sem dados suficientes",
      ]),
    ];
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob(
          ["\ufeff" + rows.map((r) => r.map(escape).join(";")).join("\r\n")],
          { type: "text/csv;charset=utf-8" },
        ),
      );
    a.href = url;
    a.download = "rotafrota-viagens.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            nav("overview");
          }}
        >
          <span className="brand-mark">
            <Route size={25} />
          </span>
          rota<span>frota</span>
          <sup>®</sup>
        </a>
        <div className="workspace">
          <span className="company-avatar">
            {who.company
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <b>{who.company}</b>
            <small>
              {api.isDemo ? "Ambiente de demonstração" : "Sua operação"}
            </small>
          </div>
        </div>
        <p className="nav-label">OPERAÇÃO</p>
        <nav aria-label="Navegação principal">
          {who.canManageTechnicians && <button className={page === 'technicians' ? 'selected' : ''} onClick={() => nav('technicians')}><ShieldCheck size={19} />Técnicos e acessos</button>}
          {tech && (
            <>
              <button
                className={page === "overview" ? "selected" : ""}
                onClick={() => nav("overview")}
              >
                <LayoutDashboard size={19} />
                Visão geral
              </button>
              <button
                className={page === "trips" ? "selected" : ""}
                onClick={() => nav("trips")}
              >
                <Route size={19} />
                Viagens <span className="nav-count">{trips.length}</span>
              </button>
              <button
                className={page === "vehicles" ? "selected" : ""}
                onClick={() => nav("vehicles")}
              >
                <Truck size={19} />
                Veículos
              </button>
            </>
          )}
          <button
            className={page === "settings" ? "selected" : ""}
            onClick={() => nav("settings")}
          >
            <Settings2 size={19} />
            Aplicativo
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="install-card">
            <Smartphone size={23} />
            <b>Sua frota vai com você.</b>
            <p>Registre cada etapa direto do celular.</p>
            <button
              onClick={() => {
                if (installPrompt) {
                  void installPrompt.prompt();
                  setInstallPrompt(null);
                } else nav("settings");
              }}
            >
              Instalar aplicativo <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="user">
            <span className="avatar">
              {who.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <b>{who.name}</b>
              <small>{tech ? "Painel técnico" : "Motorista"}</small>
            </div>
            {
              <button aria-label="Sair" onClick={() => void api.logout()}>
                <LogOut size={17} />
              </button>
            }
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <a className="area-switch" href="#/">Área do motorista <ArrowRight size={18} /></a>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>
              {
                {
                  overview: "Visão geral",
                  trips: "Viagens",
                  vehicles: "Veículos",
                  settings: "Aplicativo",
                  technicians: "Técnicos e acessos",
                }[page]
              }
            </strong>
          </div>
          <div className="connection">
            <span className={online && !api.isDemo ? "live-dot" : "demo-dot"} />
            {online ? status : "Sem conexão"}
          </div>
        </header>
        <main>
          {api.isDemo && (
            <div className="demo-banner">
              <ShieldCheck size={16} />
              <span>
                <b>Demonstração</b> · Dados fictícios, salvos somente neste
                navegador.
              </span>
              <button onClick={() => nav("settings")}>
                Sobre o ambiente <ArrowRight size={14} />
              </button>
            </div>
          )}
          {!online && (
            <div className="alert">
              Você está sem internet.{" "}
              {api.isDemo
                ? "A demonstração continua neste dispositivo."
                : "Conecte-se para enviar registros. Os campos abertos serão mantidos enquanto esta tela estiver aberta."}
            </div>
          )}
          {error && (
            <div className="alert" role="alert">
              {error}
              <button onClick={() => void refresh()}>Tentar novamente</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">PAINEL TÉCNICO</p>
              <h1>
                {
                  {
                    overview: "Sua operação, por inteiro.",
                    trips: "Cada viagem, em detalhe.",
                    vehicles: "Veículos da frota.",
                    settings: "Seu aplicativo, onde estiver.",
                    technicians: "Quem cuida da sua frota.",
                  }[page]
                }
              </h1>
              <p>
                {
                  {
                    overview:
                      "Acompanhe viagens, abastecimentos e a eficiência da sua frota.",
                    trips: "Do primeiro quilômetro à última evidência.",
                    vehicles: "Os veículos que movimentam sua operação.",
                    settings: "Instale no celular e acompanhe sua operação.",
                    technicians: "Cadastre técnicos e gerencie as permissões de acesso.",
                  }[page]
                }
              </p>
            </div>
            {page === "vehicles" && (
              <button className="primary" onClick={() => setVehicleModal(true)}>
                <Plus size={18} />
                Adicionar veículo
              </button>
            )}
          </div>
          {(page === "overview" || page === "trips") && (
            <>
              <div className="section-line">
                <div className="section-title">
                  Resumo da operação{" "}
                  <span className="subtle">
                    / {period === "1" ? "Hoje" : `Últimos ${period} dias`}
                  </span>
                </div>
                <select
                  aria-label="Período"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="30">Últimos 30 dias</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="1">Últimas 24 horas</option>
                  <option value="3650">Todo o período</option>
                </select>
              </div>
              <div className="metric-grid">
                <Metric
                  icon={<Route size={20} />}
                  label="Viagens em andamento"
                  value={String(active.length).padStart(2, "0")}
                  unit="viagens"
                  detail="Em toda a operação"
                  accent
                />
                <Metric
                  icon={<ArrowUpRight size={20} />}
                  label="Distância registrada"
                  value={number(km)}
                  unit="km"
                  detail="Até o último hodômetro enviado"
                />
                <Metric
                  icon={<Fuel size={20} />}
                  label="Combustível abastecido"
                  value={number(liters, 1)}
                  unit="litros"
                  detail={`${periodTrips.reduce((s, t) => s + t.fills.length, 0)} abastecimentos no período`}
                />
                <Metric
                  icon={<BarChart3 size={20} />}
                  label="Rendimento estimado"
                  value={
                    measuredLiters
                      ? number(measuredKm / measuredLiters, 2)
                      : "—"
                  }
                  unit="km/L"
                  detail="km ÷ litros · viagens concluídas"
                />
              </div>
              {page === "overview" && (
                <div className="insights-grid">
                  <section className="panel chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Rendimento por veículo</h2>
                        <p>Relação km/litros nas viagens concluídas</p>
                      </div>
                      <span className="unit-label">km/L</span>
                    </div>
                    <div className="bar-chart">
                      {vehicles.slice(0, 5).map((v) => {
                        const e = periodTrips
                          .filter((t) => t.vehicleId === v.id)
                          .map(estimatedEfficiency);
                        const l = e.reduce((s, x) => s + x.liters, 0),
                          value = l ? e.reduce((s, x) => s + x.km, 0) / l : 0;
                        return (
                          <div className="bar-row" key={v.id}>
                            <span>{v.plate}</span>
                            <div className="bar-track">
                              <div
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (value /
                                      Math.max(
                                        12,
                                        ...vehicles.map((vehicle) => {
                                          const a = periodTrips
                                              .filter(
                                                (t) =>
                                                  t.vehicleId === vehicle.id,
                                              )
                                              .map(estimatedEfficiency),
                                            litres = a.reduce(
                                              (s, x) => s + x.liters,
                                              0,
                                            );
                                          return litres
                                            ? a.reduce((s, x) => s + x.km, 0) /
                                                litres
                                            : 0;
                                        }),
                                      )) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                            <b>{value ? number(value, 2) : "—"}</b>
                          </div>
                        );
                      })}
                      {!vehicles.length && (
                        <p className="empty">
                          Cadastre um veículo para começar.
                        </p>
                      )}
                    </div>
                    <div className="chart-note">
                      <span />
                      Quanto maior o valor, mais quilômetros por litro. Compare
                      veículos de perfis semelhantes.
                    </div>
                  </section>
                  <section className="operation-card">
                    <div className="card-eyebrow">
                      <span className="live-dot" /> EM MOVIMENTO
                    </div>
                    <h2>
                      {active.length ? (
                        <>
                          {active.length} viagens.
                          <br />
                          Uma visão completa.
                        </>
                      ) : (
                        <>
                          Sua próxima viagem
                          <br />
                          começa aqui.
                        </>
                      )}
                    </h2>
                    <p>
                      Veja o último registro de cada motorista e acompanhe as
                      evidências da operação.
                    </p>
                    <div className="route-motif">
                      <span />
                      <i />
                      <span />
                      <i />
                      <span />
                    </div>
                    <button
                      onClick={() => {
                        nav("trips");
                        setFilter("active");
                      }}
                    >
                      Acompanhar viagens <ArrowRight size={18} />
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
          {(page === "overview" || page === "trips") && (
            <section className="panel trips-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {page === "overview"
                      ? "Viagens recentes"
                      : "Todas as viagens"}{" "}
                    <span className="count">{visible.length}</span>
                  </h2>
                  <p>
                    Acompanhe os registros e abra os detalhes de cada viagem.
                  </p>
                </div>
                <button className="secondary" onClick={exportCsv}>
                  <Download size={16} />
                  Exportar CSV
                </button>
              </div>
              <div className="table-toolbar">
                <div className="tabs">
                  {[
                    ["all", "Todas"],
                    ["active", "Em andamento"],
                    ["done", "Concluídas"],
                  ].map(([v, label]) => (
                    <button
                      className={filter === v ? "active" : ""}
                      key={v}
                      onClick={() => setFilter(v)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="search">
                  <Search size={17} />
                  <input
                    placeholder="Buscar motorista, placa ou nota"
                    aria-label="Buscar viagens"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Motorista / veículo</th>
                      <th>Nota / registro</th>
                      <th>Início</th>
                      <th>Distância</th>
                      <th>Abastecido</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Detalhes</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible
                      .slice(0, page === "overview" ? 6 : visible.length)
                      .map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setModal({ type: "detail", trip: t })}
                        >
                          <td>
                            <div className="person-cell">
                              <span className="avatar">
                                {t.driver
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              <div>
                                <b>{t.driver}</b>
                                <small>
                                  {vehicles.find((v) => v.id === t.vehicleId)
                                    ?.plate || "—"}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="route-cell">
                              <b>Nota {t.invoice}</b>
                              <small>{t.fills.length} abastecimentos</small>
                            </div>
                          </td>
                          <td>{date(t.startedAt)}</td>
                          <td className="numeric">
                            {number(distance(t))} <span>km</span>
                          </td>
                          <td className="numeric">
                            {number(totalLiters(t), 1)} <span>L</span>
                          </td>
                          <td>
                            <span
                              className={`badge ${t.endedAt ? "done" : "running"}`}
                            >
                              {t.endedAt ? <Check size={12} /> : <span />}
                              {t.endedAt ? "Concluída" : "Em viagem"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label={`Detalhes da viagem de ${t.driver} na nota ${t.invoice}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setModal({ type: "detail", trip: t });
                              }}
                            >
                              <ChevronRight size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <div className="empty">
                    <Route size={30} />
                    <h3>Nenhuma viagem encontrada</h3>
                    <p>Altere os filtros ou aguarde o envio pelo motorista.</p>
                  </div>
                )}
              </div>
              <div className="table-footer">
                <span>
                  {Math.min(
                    visible.length,
                    page === "overview" ? 6 : visible.length,
                  )}{" "}
                  de {visible.length} viagens
                </span>
                {page === "overview" && (
                  <button onClick={() => nav("trips")}>
                    Ver todas as viagens <ArrowRight size={15} />
                  </button>
                )}
                <span>Hodômetros e fotos em cada registro</span>
              </div>
            </section>
          )}
          {page === 'technicians' && who.canManageTechnicians && <TechniciansPanel />}
          {page === "vehicles" && (
            <div className="vehicle-grid">
              {vehicles.map((v) => {
                const inTrip = active.find((t) => t.vehicleId === v.id);
                return (
                  <section className="panel vehicle-card" key={v.id}>
                    <div className="vehicle-top">
                      <span className="vehicle-icon">
                        <Truck size={26} />
                      </span>
                      <span className={`badge ${inTrip ? "running" : "done"}`}>
                        {inTrip ? "Em viagem" : "Disponível"}
                      </span>
                    </div>
                    <h2>{v.plate}</h2>
                    <p>{v.name}</p>
                    <div className="vehicle-bottom">
                      <span>
                        <Fuel size={15} />
                        {v.fuel}
                      </span>
                      <span>
                        {trips.filter((t) => t.vehicleId === v.id).length}{" "}
                        viagens
                      </span>
                    </div>
                    {inTrip && (
                      <button
                        className="text-button"
                        onClick={() =>
                          setModal({ type: "detail", trip: inTrip })
                        }
                      >
                        Ver viagem atual <ArrowRight size={15} />
                      </button>
                    )}
                  </section>
                );
              })}
              {!vehicles.length && (
                <div className="empty">
                  <Truck size={35} />
                  <h3>Cadastre o primeiro veículo</h3>
                </div>
              )}
            </div>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel setting-card">
                <Smartphone size={30} />
                <h2>Instale o RotaFrota</h2>
                <p>
                  No Android, use “Instalar aplicativo” no menu do navegador. No
                  iPhone, abra no Safari, toque em Compartilhar e em “Adicionar
                  à Tela de Início”.
                </p>
                {installPrompt && (
                  <button
                    className="primary"
                    onClick={() => {
                      void installPrompt.prompt();
                      setInstallPrompt(null);
                    }}
                  >
                    Instalar neste dispositivo
                  </button>
                )}
                <div className="info-note">
                  {api.isDemo
                    ? "Esta demonstração salva registros e fotos neste navegador. Limpar os dados do navegador remove esses registros."
                    : "Para registrar viagens e enviar evidências, mantenha a conexão com a internet. Não feche o formulário antes de confirmar o envio."}
                </div>
              </section>
              <section className="panel setting-card">
                <ShieldCheck size={30} />
                <h2>{api.isDemo ? "Ambiente de demonstração" : who.company}</h2>
                <p>
                  {api.isDemo
                    ? "Explore o painel, registre abastecimentos e teste as fotos. Os dados não são compartilhados entre celulares. Os registros de exemplo não possuem fotos reais."
                    : "O acesso às viagens e às fotos é limitado à sua empresa. Alterações ficam registradas no histórico de cada viagem."}
                </p>
                <dl>
                  <div>
                    <dt>Versão</dt>
                    <dd>0.1.0 · Piloto</dd>
                  </div>
                  <div>
                    <dt>Perfil</dt>
                    <dd>{tech ? "Técnico" : "Motorista"}</dd>
                  </div>
                  <div>
                    <dt>Ambiente</dt>
                    <dd>{api.isDemo ? "Local" : "Conectado"}</dd>
                  </div>
                </dl>
              </section>
              <section className="panel setting-card">
                <BarChart3 size={30} />
                <h2>Como calculamos o consumo</h2>
                <p>
                  O consumo aferido usa a distância entre dois tanques cheios
                  dividida pelos litros repostos nesse intervalo, incluindo
                  abastecimentos parciais. Marque “Tanque cheio” somente quando
                  tiver completado o tanque.
                </p>
                <p>
                  A distância total dividida pelo volume abastecido é uma
                  referência da viagem e pode não representar o consumo real.
                  Intervalos que cruzam viagens ainda não entram no cálculo.
                </p>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              rota<b>frota</b> <span>· Inteligência em cada quilômetro.</span>
            </span>
            <span>Versão piloto 0.1.0</span>
          </footer>
        </main>
      </div>
      {modal && (
        <TripModal
          mode={modal.type}
          trip={modal.trip}
          trips={trips}
          vehicles={vehicles}
          who={who}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            notify(message);
          }}
        />
      )}
      {vehicleModal && (
        <VehicleModal
          who={who}
          onClose={() => setVehicleModal(false)}
          onSaved={() => {
            setVehicleModal(false);
            notify("Veículo cadastrado.");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          {toast}
          <button aria-label="Fechar notificação" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  unit,
  detail,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <section className={`metric ${accent ? "metric-accent" : ""}`}>
      <div className="metric-label">
        {label}
        <span>{icon}</span>
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="metric-detail">
        {accent && <ArrowDownLeft size={14} />} {detail}
      </div>
    </section>
  );
}
