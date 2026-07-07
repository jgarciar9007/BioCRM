import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BadgeDollarSign,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  Home,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import "./styles.css";
import bioempakLogo from "./assets/bioempak-logo.png";

const storedToken = () => localStorage.getItem("biocrm_token") || "";

async function request(path, options = {}) {
  const headers = { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) };
  const token = storedToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let data = {};
  if (text) {
    if (!contentType.includes("application/json")) {
      throw new Error("La API no devolvio JSON. En WSL publica con npm run serve:lan o levanta la API junto al frontend.");
    }
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("La API devolvio una respuesta JSON invalida.");
    }
  }
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

const api = {
  login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/api/auth/me"),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  summary: () => request("/api/summary"),
  recentWork: () => request("/api/recent-work"),
  modules: () => request("/api/modules"),
  directory: () => request("/api/directory"),
  accounts: (params) => request(`/api/accounts?${new URLSearchParams(params)}`),
  account: (id) => request(`/api/accounts/${id}`),
  createAccount: (body) => request("/api/accounts", { method: "POST", body: JSON.stringify(body) }),
  updateAccount: (id, body) => request(`/api/accounts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  entity: (entity, params = {}) => request(`/api/entities/${entity}?${new URLSearchParams(params)}`),
  createEntity: (entity, body) => request(`/api/entities/${entity}`, { method: "POST", body: JSON.stringify(body) }),
  updateEntity: (entity, id, body) => request(`/api/entities/${entity}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEntity: (entity, id) => request(`/api/entities/${entity}/${id}`, { method: "DELETE" }),
  deleteAccount: (id) => request(`/api/accounts/${id}`, { method: "DELETE" }),
  quote: (id) => request(`/api/quotes/${id}`),
  quoteContext: (accountId) => request(`/api/quote-context?accountId=${accountId}`),
  updateQuote: (id, body) => request(`/api/quotes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteQuote: (id) => request(`/api/quotes/${id}`, { method: "DELETE" }),
  migration: () => request("/api/migration")
};

const activityEntityByType = { Llamada: "calls", Reunion: "meetings", Tarea: "tasks" };
const moneyFieldKeys = new Set(["amount", "price", "cost", "total"]);
const opportunityStages = ["Contactar", "Cotizacion", "Envio_De_Cotizacion", "Envio_De_Muestra", "Prueba_De_Estabilidad", "Negociacion_Final", "Ganado", "Perdido"];
const taskStatuses = ["No_Iniciada", "En_Progreso", "Completada", "Aplazada", "Pendiente_Informacion"];
const meetingCallStatuses = ["Planned", "Held", "Not Held"];
const taskPriorities = ["High", "Medium", "Low"];
const caseStatuses = ["Recepcion", "Analisis_Y_Solucion", "Seguimiento", "Re_Proceso", "Cerrada"];

const icons = {
  home: Home,
  accounts: Building2,
  contacts: UserRound,
  opportunities: BadgeDollarSign,
  leads: UserRound,
  quotes: FileText,
  products: Package,
  invoices: FileText,
  documents: FileText,
  emails: Mail,
  projects: ClipboardList,
  calls: Phone,
  meetings: CalendarClock,
  tasks: ClipboardList,
  notes: Pencil,
  cases: ClipboardList,
  calendar: CalendarClock,
  accion: Activity,
  diseno: Pencil,
  plan_de_accion: ClipboardList,
  cartera: BadgeDollarSign,
  migration: Database
};

const moduleLabels = {
  contacts: "Contactos",
  quotes: "Cotizaciones",
  opportunities: "Oportunidades",
  activities: "Actividades",
  notes: "Notas",
  cases: "Casos",
  invoices: "Facturas",
  documents: "Documentos",
  emails: "Correos",
  projects: "Proyectos",
  accion: "Acciones",
  diseno: "Disenos",
  plan_de_accion: "Planes de accion",
  cartera: "Cartera",
  calls: "Llamadas",
  meetings: "Reuniones",
  tasks: "Tareas"
};

const creatable = new Set(["accounts", "contacts", "opportunities", "quotes", "products", "cases", "leads", "notes", "calls", "meetings", "tasks", "accion", "diseno", "plan_de_accion", "cartera"]);

function formatNumber(value) {
  return new Intl.NumberFormat("es-CO").format(Number(value || 0));
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function shortDate(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function App() {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(Boolean(storedToken()));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!storedToken()) return;
    api
      .me()
      .then(setSession)
      .catch(() => localStorage.removeItem("biocrm_token"))
      .finally(() => setBooting(false));
  }, []);

  if (booting) return <div className="boot">BIOCRM</div>;
  if (!session) return <Login onLogin={setSession} error={error} setError={setError} />;
  return <Crm user={session.user} onLogout={() => setSession(null)} />;
}

function Login({ onLogin, error, setError }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("BioCRM2026!");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api.login({ username, password });
      localStorage.setItem("biocrm_token", data.token);
      onLogin({ user: data.user });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          <img className="brand-logo large" src={bioempakLogo} alt="Bioempak" />
          <div>
            <strong>BIOCRM</strong>
            <span>Acceso seguro</span>
          </div>
        </div>
        <label>
          Usuario
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Contrasena
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <div className="alert">{error}</div> : null}
        <button className="primary-button" disabled={loading}>
          <Lock size={17} />
          <span>{loading ? "Entrando" : "Entrar"}</span>
        </button>
      </form>
    </main>
  );
}

function Crm({ user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [modules, setModules] = useState([]);
  const [directory, setDirectory] = useState({ industries: [], users: [] });
  const [activeView, setActiveView] = useState("home");
  const [createFor, setCreateFor] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [quoteId, setQuoteId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.summary(), api.modules(), api.directory()])
      .then(([summaryData, moduleData, directoryData]) => {
        setSummary(summaryData);
        setModules(moduleData.modules);
        setDirectory(directoryData);
      })
      .catch((err) => setError(err.message));
  }, [refreshKey]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const item of modules) {
      groups[item.group] ||= [];
      groups[item.group].push(item);
    }
    return groups;
  }, [modules]);

  async function logout() {
    await api.logout().catch(() => {});
    localStorage.removeItem("biocrm_token");
    onLogout();
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <img className="brand-logo" src={bioempakLogo} alt="Bioempak" />
          <div>
            <strong>BIOCRM</strong>
            <span>{user.displayName}</span>
          </div>
        </div>
        <nav className="nav grouped-nav">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="nav-group">
              <p>{group}</p>
              {items.map((item) => {
                const Icon = icons[item.id] || Database;
                return (
                  <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => setActiveView(item.id)}>
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <button className="logout-button" onClick={logout}>
          <LogOut size={17} />
          <span>Salir</span>
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">CRM operativo</p>
            <h1>{modules.find((item) => item.id === activeView)?.label || "BIOCRM"}</h1>
          </div>
          <div className="action-row">
            {creatable.has(activeView) ? (
              <button className="primary-button" onClick={() => setCreateFor(activeView)}>
                <Plus size={17} />
                <span>Crear</span>
              </button>
            ) : null}
            <button className="icon-button" onClick={() => setRefreshKey((key) => key + 1)} title="Actualizar">
              <Check size={18} />
            </button>
          </div>
        </header>

        {error ? <div className="alert">{error}</div> : null}
        {activeView !== "home" ? <MetricGrid summary={summary} /> : null}

        {activeView === "home" ? (
          <HomeView summary={summary} refreshKey={refreshKey} onQuote={setQuoteId} onOpenAccounts={() => setActiveView("accounts")} />
        ) : activeView === "accounts" ? (
          <AccountWorkspace
            directory={directory}
            selectedId={selectedAccountId}
            onSelect={setSelectedAccountId}
            onCreate={setCreateFor}
            onQuote={setQuoteId}
            refreshKey={refreshKey}
          />
        ) : activeView === "migration" ? (
          <MigrationView />
        ) : (
          <EntityView entity={activeView} module={modules.find((item) => item.id === activeView)} onQuote={setQuoteId} refreshKey={refreshKey} />
        )}
      </section>

      {createFor ? (
        <CreateModal
          entity={createFor}
          accountId={selectedAccountId}
          onClose={() => setCreateFor(null)}
          onCreated={(created) => {
            setCreateFor(null);
            setRefreshKey((key) => key + 1);
            if (createFor === "quotes" && created.quote?.id) setQuoteId(created.quote.id);
          }}
        />
      ) : null}
      {quoteId ? <QuoteDrawer id={quoteId} onClose={() => setQuoteId(null)} onChanged={() => setRefreshKey((key) => key + 1)} /> : null}
    </main>
  );
}

function MetricGrid({ summary }) {
  const s = summary?.summary || {};
  const metrics = [
    { label: "Cuentas activas", value: s.activeAccounts, icon: Building2 },
    { label: "Contactos", value: s.contacts, icon: UserRound },
    { label: "Actividades", value: s.activities, icon: CalendarClock },
    { label: "Cotizaciones", value: s.quotes, icon: FileText },
    { label: "Lineas cotizadas", value: s.quoteLines, icon: Package },
    { label: "Productos", value: s.products, icon: Package }
  ];
  return (
    <section className="metric-grid">
      {metrics.map((metric) => (
        <article className="metric" key={metric.label}>
          <metric.icon size={19} />
          <span>{metric.label}</span>
          <strong>{formatNumber(metric.value)}</strong>
        </article>
      ))}
    </section>
  );
}

function HomeView({ summary, refreshKey, onQuote, onOpenAccounts }) {
  const [recentWork, setRecentWork] = useState({ items: [] });

  useEffect(() => {
    api.recentWork().then(setRecentWork).catch(() => setRecentWork({ items: [] }));
  }, [refreshKey]);

  const s = summary?.summary || {};
  const counters = [
    { label: "Clientes", value: s.activeAccounts, icon: Building2 },
    { label: "Cotizaciones", value: s.quotes, icon: FileText },
    { label: "Actividades", value: s.activities, icon: CalendarClock },
    { label: "Vinculos", value: s.entityLinks, icon: Database }
  ];

  return (
    <section className="home-view">
      <div className="home-stats">
        {counters.map((counter) => (
          <button type="button" className="home-stat" key={counter.label} onClick={counter.label === "Clientes" ? onOpenAccounts : undefined}>
            <counter.icon size={18} />
            <span>{counter.label}</span>
            <strong>{formatNumber(counter.value)}</strong>
          </button>
        ))}
      </div>
      <div className="table-block recent-work">
        <div className="panel-title">
          <strong>Trabajos recientes</strong>
          <span>{formatNumber(recentWork.items.length)} registros</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Trabajo</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Valor</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {recentWork.items.map((item) => {
              const Icon = icons[item.entity] || ClipboardList;
              return (
                <tr key={`${item.entity}-${item.id}`} className={item.entity === "quotes" ? "clickable-row" : ""} onClick={() => item.entity === "quotes" && onQuote(item.id)}>
                  <td><span className="type-cell"><Icon size={16} />{item.kind}</span></td>
                  <td><strong>{item.name || "Sin nombre"}</strong><small>{item.reference || ""}</small></td>
                  <td>{item.accountName || "Sin cliente"}</td>
                  <td>{item.status || "Sin estado"}</td>
                  <td>{Number(item.amount || 0) ? formatMoney(item.amount) : "Sin valor"}</td>
                  <td>{shortDate(item.dateValue) || "Sin fecha"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AccountWorkspace({ directory, selectedId, onSelect, onCreate, onQuote, refreshKey }) {
  const [accounts, setAccounts] = useState({ items: [], total: 0 });
  const [filters, setFilters] = useState({ search: "", industry: "", pageSize: 60 });
  const [selected, setSelected] = useState(null);
  const [detailTick, setDetailTick] = useState(0);
  const [recordView, setRecordView] = useState(null);

  useEffect(() => {
    api.accounts(filters).then((data) => {
      setAccounts(data);
      if (!selectedId && data.items[0]) onSelect(data.items[0].id);
    });
  }, [filters, refreshKey]);

  useEffect(() => {
    if (selectedId) api.account(selectedId).then(setSelected);
  }, [selectedId, refreshKey, detailTick]);

  return (
    <div className="account-layout">
      <section className="list-pane">
        <div className="filters">
          <label className="searchbox">
            <Search size={17} />
            <input value={filters.search} placeholder="Buscar cliente, telefono, ciudad" onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          </label>
          <div className="filter-row">
            <select value={filters.industry} onChange={(event) => setFilters({ ...filters, industry: event.target.value })}>
              <option value="">Industria</option>
              {directory.industries.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>
        <div className="list-heading">
          <strong>{formatNumber(accounts.total)} cuentas</strong>
          <button className="mini-action" onClick={() => onCreate("accounts")}>
            <Plus size={15} /> Nuevo
          </button>
        </div>
        <div className="account-list">
          {accounts.items.map((account) => (
            <button key={account.id} className={`account-row ${account.id === selectedId ? "selected" : ""}`} onClick={() => onSelect(account.id)}>
              <div>
                <strong>{account.name}</strong>
                <span>{[account.industry, account.city, account.country].filter(Boolean).join(" · ") || "Sin clasificacion"}</span>
              </div>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>

      <section className="detail-pane">
        {selected ? (
          <AccountDetail
            selected={selected}
            onCreate={onCreate}
            onQuote={onQuote}
            onOpenRecord={setRecordView}
            onDeleted={() => {
              onSelect(null);
              setSelected(null);
              setDetailTick((tick) => tick + 1);
            }}
          />
        ) : (
          <div className="empty">Selecciona un cliente</div>
        )}
      </section>

      {recordView ? (
        <RecordDrawer
          entity={recordView.entity}
          record={recordView.record}
          onClose={() => setRecordView(null)}
          onChanged={() => {
            setRecordView(null);
            setDetailTick((tick) => tick + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function AccountDetail({ selected, onCreate, onQuote, onOpenRecord, onDeleted }) {
  const { account, related } = selected;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account);
  const [relatedView, setRelatedView] = useState(null);

  useEffect(() => {
    setDraft(account);
    setEditing(false);
  }, [account.id]);

  async function save() {
    const saved = await api.updateAccount(account.id, draft);
    setDraft(saved);
    setEditing(false);
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar el cliente "${account.name}"? Esta accion no se puede deshacer.`)) return;
    await api.deleteAccount(account.id);
    onDeleted();
  }

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          {editing ? <input className="title-input" value={draft.name || ""} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /> : <h2>{account.name}</h2>}
          <p>{[account.industry, account.type, account.assignedUser].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="action-row">
          <button className="primary-button" onClick={() => onCreate("quotes")}>
            <FileText size={17} />
            <span>Cotizar</span>
          </button>
          <button className="icon-button" onClick={() => (editing ? save() : setEditing(true))} title={editing ? "Guardar" : "Editar"}>
            {editing ? <Save size={18} /> : <Pencil size={18} />}
          </button>
          <button className="icon-button" onClick={remove} title="Eliminar cliente">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="quick-create">
        {["contacts", "quotes", "calls", "meetings", "tasks", "notes", "cases"].map((item) => (
          <button key={item} onClick={() => onCreate(item)}>
            <Plus size={15} />
            <span>{moduleLabels[item]}</span>
          </button>
        ))}
      </div>
      <div className="info-grid">
        <Info icon={Phone} label="Telefono" value={account.phone} editing={editing} field="phone" draft={draft} setDraft={setDraft} />
        <Info icon={Mail} label="Email" value={account.email} editing={editing} field="email" draft={draft} setDraft={setDraft} />
        <Info icon={MapPin} label="Ubicacion" value={[account.city, account.state, account.country].filter(Boolean).join(", ")} />
      </div>
      <section className="relationship-grid">
        {[
          { key: "contacts", title: "Contactos", icon: UserRound, items: related.contacts, create: "contacts" },
          { key: "quotes", title: "Cotizaciones", icon: FileText, items: related.quotes, create: "quotes" },
          { key: "opportunities", title: "Oportunidades", icon: BadgeDollarSign, items: related.opportunities, create: "opportunities" },
          { key: "activities", title: "Actividades", icon: Activity, items: related.activities, create: "tasks" },
          { key: "notes", title: "Notas", icon: Pencil, items: related.notes, create: "notes" },
          { key: "cases", title: "Casos", icon: ClipboardList, items: related.cases, create: "cases" },
          { key: "invoices", title: "Facturas", icon: FileText, items: related.invoices, create: "invoices" },
          { key: "documents", title: "Documentos", icon: FileText, items: related.documents, create: "documents" },
          { key: "emails", title: "Correos", icon: Mail, items: related.emails || [], create: "emails" },
          { key: "projects", title: "Proyectos", icon: ClipboardList, items: related.projects || [], create: "projects" },
          { key: "disenos", title: "Disenos", icon: Pencil, items: related.disenos || [], create: "diseno" },
          { key: "cartera", title: "Cartera", icon: BadgeDollarSign, items: related.cartera || [], create: "cartera" },
          { key: "acciones", title: "Acciones", icon: Activity, items: related.acciones || [], create: "accion" },
          { key: "planesAccion", title: "Planes de accion", icon: ClipboardList, items: related.planesAccion || [], create: "plan_de_accion" }
        ].map((card) => (
          <button className="relationship-card" key={card.key} onClick={() => setRelatedView(card)}>
            <card.icon size={19} />
            <span>{card.title}</span>
            <strong>{formatNumber(card.items.length)}</strong>
            <small>{card.items[0] ? card.items[0].name || card.items[0].title : "Sin registros"}</small>
          </button>
        ))}
      </section>
      {relatedView ? (
        <RelatedDrawer
          account={account}
          relation={relatedView}
          onClose={() => setRelatedView(null)}
          onCreate={onCreate}
          onQuote={onQuote}
          onOpenRecord={onOpenRecord}
        />
      ) : null}
    </div>
  );
}

function EntityView({ entity, module, onQuote, refreshKey }) {
  const [data, setData] = useState({ items: [], total: 0 });
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [recordView, setRecordView] = useState(null);
  const [localTick, setLocalTick] = useState(0);

  useEffect(() => {
    api.entity(entity, { search, pageSize: 80 }).then(setData);
  }, [entity, search, refreshKey, localTick]);

  function recordEntityFor(item) {
    if (entity === "calendar") return activityEntityByType[item.type] || null;
    return creatable.has(entity) ? entity : null;
  }

  function openRecord(item) {
    if (entity === "quotes") return onQuote(item.id);
    const recordEntity = recordEntityFor(item);
    if (recordEntity) setRecordView({ entity: recordEntity, record: item });
  }

  function isRowClickable(item) {
    return entity === "quotes" || Boolean(recordEntityFor(item));
  }

  return (
    <section className={`entity-view ${viewMode}`}>
      <div className="filters single">
        <label className="searchbox">
          <Search size={17} />
          <input value={search} placeholder={`Buscar en ${module?.label || entity}`} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      <div className="list-heading">
        <strong>{formatNumber(data.total)} registros</strong>
        <span>{module?.group} · Vista lista</span>
      </div>
      <div className="view-switch">
        <button className={viewMode === "list" ? "view-button active" : "view-button"} onClick={() => setViewMode("list")} title="Vista lista"><List size={16} /></button>
        <button className={viewMode === "cards" ? "view-button active" : "view-button"} onClick={() => setViewMode("cards")} title="Vista tarjetas"><LayoutGrid size={16} /></button>
      </div>
      <EntityList2 items={data.items} entity={entity} onRowClick={openRecord} isRowClickable={isRowClickable} />
      <div className="entity-grid">
        {data.items.map((item) => (
          <button className={`entity-card ${isRowClickable(item) ? "clickable-row" : ""}`} key={item.id} onClick={() => openRecord(item)}>
            <strong>{item.name || item.title}</strong>
            {entity === "quotes" ? <span>{item.accountName || "Sin cliente relacionado"}</span> : null}
            <span>{[item.status, item.stage, item.type, item.city, item.country].filter(Boolean).join(" · ") || "Sin clasificacion"}</span>
            {"total" in item ? <b>{formatMoney(item.total)}</b> : null}
            {item.number ? <small>#{item.number}</small> : null}
          </button>
        ))}
      </div>
      {recordView ? (
        <RecordDrawer
          entity={recordView.entity}
          record={recordView.record}
          onClose={() => setRecordView(null)}
          onChanged={() => {
            setRecordView(null);
            setLocalTick((tick) => tick + 1);
          }}
        />
      ) : null}
    </section>
  );
}

function EntityList2({ items, entity, onRowClick, isRowClickable }) {
  const dateValue = (item) => shortDate(item.updatedAt || item.createdAt || item.dateStart || item.dueDate || item.activeDate || item.closeDate || item.expiration) || "Sin fecha";
  const money = (value) => (Number(value || 0) ? formatMoney(value) : "Sin valor");
  const activityColumns = [
    ["Actividad", (item) => <strong>{item.title || "Sin asunto"}</strong>],
    ["Tipo", (item) => item.type || "Sin tipo"],
    ["Relacionado con", (item) => item.parentName || "Sin relacion"],
    ["Estado", (item) => item.status || "Sin estado"],
    ["Prioridad", (item) => item.priority || "Sin prioridad"],
    ["Fecha", (item) => shortDate(item.dateStart || item.dueDate) || "Sin fecha"]
  ];
  const columnsByEntity = {
    accounts: [["Cuenta", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Industria", (item) => item.industry || "Sin industria"], ["Tipo", (item) => item.type || "Sin tipo"], ["Telefono", (item) => item.phone || "Sin telefono"], ["Email", (item) => item.email || "Sin email"], ["Ubicacion", (item) => [item.city, item.state, item.country].filter(Boolean).join(" · ") || "Sin ubicacion"]],
    contacts: [["Contacto", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Cliente", (item) => item.accountName || "Sin cliente"], ["Cargo", (item) => item.title || "Sin cargo"], ["Telefono", (item) => item.phone || "Sin telefono"], ["Email", (item) => item.email || "Sin email"], ["Ubicacion", (item) => [item.city, item.state, item.country].filter(Boolean).join(" · ") || "Sin ubicacion"]],
    leads: [["Prospecto", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Empresa", (item) => item.accountName || "Sin empresa"], ["Estado", (item) => item.status || "Sin estado"], ["Fuente", (item) => item.source || "Sin fuente"], ["Contacto", (item) => [item.phone, item.email].filter(Boolean).join(" · ") || "Sin contacto"], ["Ubicacion", (item) => [item.city, item.country].filter(Boolean).join(" · ") || "Sin ubicacion"]],
    opportunities: [["Oportunidad", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Cliente", (item) => item.accountName || "Sin cliente"], ["Etapa", (item) => item.stage || "Sin etapa"], ["Tipo", (item) => item.type || "Sin tipo"], ["Monto", (item) => money(item.amount)], ["Cierre", (item) => shortDate(item.closeDate) || "Sin fecha"]],
    quotes: [["Cotizacion", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Cliente", (item) => item.accountName || "Sin cliente"], ["Numero", (item) => item.number ? `#${item.number}` : "Sin numero"], ["Etapa", (item) => item.stage || "Sin etapa"], ["Total", (item) => money(item.total)], ["Vence", (item) => shortDate(item.expiration) || "Sin vencimiento"]],
    products: [["Producto", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Codigo", (item) => item.partNumber || "Sin codigo"], ["Tipo", (item) => item.type || "Sin tipo"], ["Precio", (item) => money(item.price)], ["Costo", (item) => money(item.cost)], ["Actualizado", dateValue]],
    invoices: [["Factura", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Cliente", (item) => item.accountName || "Sin cliente"], ["Numero", (item) => item.number ? `#${item.number}` : "Sin numero"], ["Estado", (item) => item.status || "Sin estado"], ["Total", (item) => money(item.total)], ["Vence", (item) => shortDate(item.dueDate) || "Sin vencimiento"]],
    cases: [["Caso", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Cliente", (item) => item.accountName || "Sin cliente"], ["Numero", (item) => item.number ? `#${item.number}` : "Sin numero"], ["Estado", (item) => item.status || "Sin estado"], ["Prioridad", (item) => item.priority || "Sin prioridad"], ["Tipo", (item) => item.type || "Sin tipo"]],
    documents: [["Documento", (item) => <strong>{item.name || "Sin nombre"}</strong>], ["Estado", (item) => item.status || "Sin estado"], ["Categoria", (item) => item.category || "Sin categoria"], ["Subcategoria", (item) => item.subcategory || "Sin subcategoria"], ["Activo", (item) => shortDate(item.activeDate) || "Sin fecha"], ["Vence", (item) => shortDate(item.expirationDate) || "Sin vencimiento"]],
    notes: [["Nota", (item) => <strong>{item.title || item.name || "Sin titulo"}</strong>], ["Relacionado con", (item) => item.parentName || "Sin relacion"], ["Tipo", (item) => item.parentType || "Sin tipo"], ["Archivo", (item) => item.fileName || "Sin archivo"], ["Descripcion", (item) => item.description || "Sin descripcion"], ["Actualizado", dateValue]],
    calls: activityColumns,
    meetings: activityColumns,
    tasks: activityColumns,
    calendar: activityColumns
  };
  const genericColumns = [["Nombre", (item) => <strong>{item.name || item.title || "Sin nombre"}</strong>], ["Cliente", (item) => item.accountName || "Sin cliente"], ["Estado", (item) => item.status || "Sin estado"], ["Tipo", (item) => item.type || "Sin tipo"], ["Inicio", (item) => shortDate(item.startDate) || "Sin fecha"], ["Fin", (item) => shortDate(item.endDate) || "Sin fecha"]];
  const columns = columnsByEntity[entity] || genericColumns;
  return (
    <div className="table-block entity-table">
      <table>
        <thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={isRowClickable(item) ? "clickable-row" : ""} onClick={() => onRowClick(item)}>
              {columns.map(([label, render]) => <td key={label}>{render(item)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const relationEntityMap = {
  contacts: "contacts",
  opportunities: "opportunities",
  notes: "notes",
  cases: "cases",
  disenos: "diseno",
  cartera: "cartera",
  acciones: "accion",
  planesAccion: "plan_de_accion"
};

function RelatedDrawer({ account, relation, onClose, onCreate, onQuote, onOpenRecord }) {
  const items = relation.items || [];
  const canCreate = creatable.has(relation.create);

  function handleClick(item) {
    if (relation.key === "quotes") return onQuote(item.id);
    const recordEntity = relation.key === "activities" ? activityEntityByType[item.type] : relationEntityMap[relation.key];
    if (recordEntity) onOpenRecord?.({ entity: recordEntity, record: item });
  }

  function metaFor(item) {
    if (relation.key === "quotes") return `#${item.number || ""} - ${item.stage || "Sin etapa"} - ${formatMoney(item.total)}`;
    if (relation.key === "activities") return `${item.type || "Actividad"} - ${item.status || "Sin estado"} - ${shortDate(item.dateStart || item.dueDate)}`;
    if (relation.key === "contacts") return [item.title, item.phone, item.email].filter(Boolean).join(" - ");
    if (relation.key === "opportunities") return `${item.stage || "Sin etapa"} - ${formatMoney(item.amount)}`;
    if (relation.key === "cases") return `${item.status || "Sin estado"} - ${item.priority || "Sin prioridad"}`;
    if (relation.key === "invoices") return `${item.status || "Sin estado"} - ${formatMoney(item.total)}`;
    if (relation.key === "emails") return [item.legacy?.addresses?.from?.[0], item.status, item.type, shortDate(item.startDate)].filter(Boolean).join(" - ");
    if (["disenos", "cartera", "acciones", "planesAccion", "contracts"].includes(relation.key)) {
      return [item.status, item.type, Number(item.total || 0) ? formatMoney(item.total) : null, shortDate(item.startDate || item.endDate)].filter(Boolean).join(" - ");
    }
    return [item.status, item.type, item.priority, shortDate(item.createdAt || item.updatedAt || item.startDate || item.endDate)].filter(Boolean).join(" - ");
  }

  return (
    <aside className="drawer related-drawer">
      <div className="drawer-head">
        <div>
          <span className="pill">{account.name}</span>
          <h2>{relation.title}</h2>
          <p>{formatNumber(items.length)} registros relacionados</p>
        </div>
        <div className="action-row">
          {relation.key === "activities" ? (
            <>
              <button className="primary-button" onClick={() => onCreate("calls")}><Plus size={17} /><span>Llamada</span></button>
              <button className="primary-button" onClick={() => onCreate("meetings")}><Plus size={17} /><span>Reunion</span></button>
              <button className="primary-button" onClick={() => onCreate("tasks")}><Plus size={17} /><span>Tarea</span></button>
            </>
          ) : canCreate ? (
            <button className="primary-button" onClick={() => onCreate(relation.create)}>
              <Plus size={17} />
              <span>Nuevo</span>
            </button>
          ) : null}
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
      </div>
      <div className="related-list">
        {items.length ? items.map((item) => (
          <button
            className="related-row"
            key={item.id}
            onClick={() => handleClick(item)}
          >
            <div>
              <strong>{item.name || item.title || item.documentName || "Sin nombre"}</strong>
              <span>{metaFor(item) || "Sin detalle"}</span>
            </div>
            <ChevronRight size={17} />
          </button>
        )) : (
          <div className="empty">No hay registros relacionados</div>
        )}
      </div>
    </aside>
  );
}

const quoteStages = ["Draft", "Negotiation", "Delivered", "Confirmed", "On Hold", "Closed Accepted", "Closed Lost", "Closed Dead"];

function draftFromQuote(detail) {
  return {
    name: detail.quote.name || "",
    stage: detail.quote.stage || "Draft",
    paymentMethod: detail.quote.paymentMethod || "",
    deliveryTime: detail.quote.deliveryTime || "",
    expiration: detail.quote.expiration ? String(detail.quote.expiration).slice(0, 10) : "",
    observations: detail.quote.observations || "",
    lines: detail.lines.map((line) => ({
      productId: line.productId || null,
      name: line.name || line.catalogProductName || "",
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatAmount: line.vatAmount
    }))
  };
}

function QuoteDrawer({ id, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.quote(id).then((data) => {
      setDetail(data);
      setDraft(draftFromQuote(data));
    });
  }, [id]);

  if (!detail || !draft) return null;
  const { quote, groups } = detail;

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateLine(index, key, value) {
    setDraft((current) => ({ ...current, lines: current.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)) }));
  }

  function addLine() {
    setDraft((current) => ({ ...current, lines: [...current.lines, { name: "", quantity: 1, unitPrice: 0, vatAmount: 0 }] }));
  }

  function removeLine(index) {
    setDraft((current) => ({ ...current, lines: current.lines.filter((_, i) => i !== index) }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateQuote(id, draft);
      setDetail(updated);
      setDraft(draftFromQuote(updated));
      setEditing(false);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar la cotizacion #${quote.number}? Esta accion no se puede deshacer.`)) return;
    await api.deleteQuote(id);
    onChanged?.();
    onClose();
  }

  const preview = editing
    ? draft.lines.reduce(
        (acc, line) => ({
          subtotal: acc.subtotal + Number(line.quantity || 0) * Number(line.unitPrice || 0),
          tax: acc.tax + Number(line.vatAmount || 0)
        }),
        { subtotal: 0, tax: 0 }
      )
    : null;

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <div>
          <span className="pill">Cotizacion #{quote.number}</span>
          {editing ? <input className="title-input" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} /> : <h2>{quote.name}</h2>}
          <p>
            {quote.accountName || "Sin cliente"} ·{" "}
            {editing ? (
              <select value={draft.stage} onChange={(event) => updateDraft("stage", event.target.value)}>
                {quoteStages.map((stage) => <option key={stage}>{stage}</option>)}
              </select>
            ) : (
              quote.stage
            )}
          </p>
        </div>
        <div className="action-row">
          <button className="icon-button" onClick={() => (editing ? save() : setEditing(true))} title={editing ? "Guardar" : "Editar"} disabled={saving}>
            {editing ? <Save size={18} /> : <Pencil size={18} />}
          </button>
          <button className="icon-button" onClick={remove} title="Eliminar">
            <Trash2 size={18} />
          </button>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="quote-summary">
        <Info icon={BadgeDollarSign} label="Subtotal" value={formatMoney(editing ? preview.subtotal : quote.subtotal)} />
        <Info icon={BadgeDollarSign} label="IVA" value={formatMoney(editing ? preview.tax : quote.tax)} />
        <Info icon={BadgeDollarSign} label="Total" value={formatMoney(editing ? preview.subtotal + preview.tax : quote.total)} />
        {editing ? (
          <div className="info">
            <CalendarClock size={18} />
            <span>Vence</span>
            <input type="date" value={draft.expiration} onChange={(event) => updateDraft("expiration", event.target.value)} />
          </div>
        ) : (
          <Info icon={CalendarClock} label="Vence" value={shortDate(quote.expiration)} />
        )}
      </div>
      {editing ? (
        <div className="form-grid">
          <label>Forma de pago<input value={draft.paymentMethod} onChange={(event) => updateDraft("paymentMethod", event.target.value)} /></label>
          <label>Tiempo de entrega<input value={draft.deliveryTime} onChange={(event) => updateDraft("deliveryTime", event.target.value)} /></label>
          <label className="wide">Observaciones<textarea value={draft.observations} onChange={(event) => updateDraft("observations", event.target.value)} /></label>
        </div>
      ) : (
        <div className="quote-addresses">
          <MiniRow title="Facturacion" meta={quote.billingAddress || "Sin direccion"} />
          <MiniRow title="Entrega" meta={quote.shippingAddress || "Sin direccion"} />
        </div>
      )}
      <div className="table-block">
        <div className="panel-title">
          <strong>Lineas</strong>
          <span>{formatNumber(draft.lines.length)} productos</span>
          {editing ? (
            <button type="button" className="mini-action" onClick={addLine}>
              <Plus size={15} /> Linea
            </button>
          ) : null}
        </div>
        {editing ? (
          <div className="quote-lines-editor">
            {draft.lines.map((line, index) => (
              <div className="line-editor" key={index}>
                <input placeholder="Producto" value={line.name} onChange={(event) => updateLine(index, "name", event.target.value)} required />
                <input type="number" min="0" step="0.01" placeholder="Cantidad" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} />
                <input type="number" min="0" step="0.01" placeholder="Unitario" value={line.unitPrice} onChange={(event) => updateLine(index, "unitPrice", event.target.value)} />
                <input type="number" min="0" step="0.01" placeholder="IVA" value={line.vatAmount} onChange={(event) => updateLine(index, "vatAmount", event.target.value)} />
                <button type="button" className="icon-button" onClick={() => removeLine(index)} title="Quitar linea" disabled={draft.lines.length <= 1}><X size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Unitario</th>
                <th>IVA</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.number}</td>
                  <td>{line.name || line.catalogProductName}</td>
                  <td>{formatNumber(line.quantity)}</td>
                  <td>{formatMoney(line.unitPrice)}</td>
                  <td>{formatMoney(line.vatAmount)}</td>
                  <td>{formatMoney(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!editing ? (
        <Panel title="Grupos" count={groups.length}>
          {groups.map((group) => <MiniRow key={group.id} title={group.name} meta={`${formatMoney(group.subtotal)} · IVA ${formatMoney(group.tax)} · Total ${formatMoney(group.total)}`} />)}
        </Panel>
      ) : null}
      {!editing && quote.observations ? <Panel title="Observaciones" count={1}><MiniRow title="Condiciones" meta={quote.observations} /></Panel> : null}
    </aside>
  );
}

const recordFieldsByEntity = {
  contacts: [["name", "Nombre"], ["title", "Cargo"], ["department", "Departamento"], ["phone", "Telefono"], ["email", "Email"]],
  opportunities: [["name", "Nombre"], ["stage", "Etapa", "select", opportunityStages], ["type", "Tipo"], ["amount", "Monto", "number"], ["probability", "Probabilidad %", "number"], ["closeDate", "Cierre esperado", "date"]],
  leads: [["name", "Nombre"], ["accountName", "Empresa"], ["status", "Estado"], ["source", "Fuente"], ["phone", "Telefono"], ["email", "Email"], ["city", "Ciudad"], ["country", "Pais"]],
  products: [["name", "Producto"], ["partNumber", "Codigo"], ["type", "Tipo"], ["price", "Precio", "number"], ["cost", "Costo", "number"]],
  cases: [["name", "Asunto"], ["status", "Estado", "select", caseStatuses], ["priority", "Prioridad"], ["type", "Tipo"], ["description", "Descripcion", "textarea"]],
  notes: [["title", "Titulo"], ["description", "Nota", "textarea"]],
  calls: [["title", "Asunto"], ["status", "Estado", "select", meetingCallStatuses], ["dateStart", "Inicio", "datetime-local"], ["durationMinutes", "Duracion minutos", "number"], ["description", "Descripcion", "textarea"]],
  meetings: [["title", "Asunto"], ["status", "Estado", "select", meetingCallStatuses], ["dateStart", "Inicio", "datetime-local"], ["durationMinutes", "Duracion minutos", "number"], ["description", "Descripcion", "textarea"]],
  tasks: [["title", "Asunto"], ["status", "Estado", "select", taskStatuses], ["priority", "Prioridad", "select", taskPriorities], ["dateStart", "Inicio", "datetime-local"], ["dueDate", "Vence", "date"], ["description", "Descripcion", "textarea"]],
  accion: [["name", "Nombre"], ["status", "Estado"], ["type", "Tipo"], ["startDate", "Inicio", "date"], ["endDate", "Fin", "date"], ["total", "Total", "number"]],
  diseno: [["name", "Nombre"], ["status", "Estado"], ["type", "Tipo"], ["startDate", "Inicio", "date"], ["endDate", "Fin", "date"], ["total", "Total", "number"]],
  plan_de_accion: [["name", "Nombre"], ["status", "Estado"], ["type", "Tipo"], ["startDate", "Inicio", "date"], ["endDate", "Fin", "date"], ["total", "Total", "number"]],
  cartera: [["name", "Nombre"], ["status", "Estado"], ["type", "Tipo"], ["startDate", "Inicio", "date"], ["endDate", "Fin", "date"], ["total", "Total", "number"]]
};

function formatFieldValue(key, value, type) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (moneyFieldKeys.has(key)) return formatMoney(value);
  if (type === "date" || type === "datetime-local") return shortDate(value);
  return String(value);
}

function RecordDrawer({ entity, record, onClose, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(record);
    setEditing(false);
  }, [record.id]);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateEntity(entity, record.id, draft);
      setDraft(updated);
      setEditing(false);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("¿Eliminar este registro? Esta accion no se puede deshacer.")) return;
    try {
      await api.deleteEntity(entity, record.id);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  const fields = recordFieldsByEntity[entity] || [];
  const title = record.name || record.title || "Registro";

  return (
    <aside className="drawer related-drawer">
      <div className="drawer-head">
        <div>
          {record.accountName ? <span className="pill">{record.accountName}</span> : null}
          <h2>{title}</h2>
          <p>{moduleLabels[entity] || entity}</p>
        </div>
        <div className="action-row">
          <button className="icon-button" onClick={() => (editing ? save() : setEditing(true))} title={editing ? "Guardar" : "Editar"} disabled={saving}>
            {editing ? <Save size={18} /> : <Pencil size={18} />}
          </button>
          <button className="icon-button" onClick={remove} title="Eliminar">
            <Trash2 size={18} />
          </button>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <div className="form-grid">
        {fields.map(([key, label, type, options]) => (
          <label key={key} className={type === "textarea" ? "wide" : ""}>
            {label}
            {!editing ? (
              <strong className="static-value">{formatFieldValue(key, draft[key], type)}</strong>
            ) : type === "select" ? (
              <select value={draft[key] || ""} onChange={(event) => update(key, event.target.value)}>
                {options.map((option) => <option key={option}>{option}</option>)}
              </select>
            ) : type === "textarea" ? (
              <textarea value={draft[key] || ""} onChange={(event) => update(key, event.target.value)} />
            ) : (
              <input type={type || "text"} value={draft[key] ?? ""} onChange={(event) => update(key, event.target.value)} />
            )}
          </label>
        ))}
      </div>
    </aside>
  );
}

function CreateModal({ entity, accountId, onClose, onCreated }) {
  const [form, setForm] = useState({ accountId, country: "Colombia", lines: [{ name: "", quantity: 1, unitPrice: 0, vatAmount: 0 }] });
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountId) {
      setAccountName("");
      return;
    }
    api.account(accountId).then((data) => setAccountName(data.account?.name || "")).catch(() => setAccountName(""));
  }, [accountId]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function pickAccount(account) {
    if (account) {
      update("accountId", account.id);
      setAccountName(account.name);
    } else {
      update("accountId", null);
      setAccountName("");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = entity === "accounts" ? await api.createAccount(form) : await api.createEntity(entity, form);
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>Crear {moduleLabels[entity] || entity}</h2>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        {entity === "quotes" ? (
          <QuoteForm form={form} setForm={setForm} update={update} accountName={accountName} onPickAccount={pickAccount} />
        ) : (
          <EntityForm entity={entity} form={form} update={update} accountName={accountName} onPickAccount={pickAccount} />
        )}
        {error ? <div className="alert">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
          <button className="primary-button" disabled={saving}><Save size={17} /><span>{saving ? "Guardando" : "Guardar"}</span></button>
        </div>
      </form>
    </div>
  );
}

function AccountPicker({ onPick }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.accounts({ search: query, pageSize: 8 }).then((data) => setResults(data.items));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="picker">
      <input
        placeholder="Buscar cliente por nombre, ciudad o telefono..."
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length ? (
        <div className="picker-results">
          {results.map((account) => (
            <button
              type="button"
              key={account.id}
              onClick={() => {
                onPick(account);
                setOpen(false);
                setQuery("");
              }}
            >
              <strong>{account.name}</strong>
              <span>{[account.industry, account.city].filter(Boolean).join(" · ") || "Sin clasificacion"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ClientField({ entity, form, accountName, onPickAccount }) {
  if (entity === "accounts" || entity === "products" || entity === "leads") return null;
  if (form.accountId && accountName) {
    return (
      <label className="wide">
        Cliente
        <div className="picker-selected">
          <span>{accountName}</span>
          <button type="button" className="mini-action" onClick={() => onPickAccount(null)}>Cambiar</button>
        </div>
      </label>
    );
  }
  return (
    <label className="wide">
      Cliente
      <AccountPicker onPick={onPickAccount} />
    </label>
  );
}

function EntityForm({ entity, form, update, accountName, onPickAccount }) {
  const client = <ClientField entity={entity} form={form} accountName={accountName} onPickAccount={onPickAccount} />;

  if (entity === "accounts") {
    return (
      <div className="form-grid">
        <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
        <label>Tipo<input value={form.type || ""} onChange={(event) => update("type", event.target.value)} /></label>
        <label>Industria<input value={form.industry || ""} onChange={(event) => update("industry", event.target.value)} /></label>
        <label>Telefono<input value={form.phone || ""} onChange={(event) => update("phone", event.target.value)} /></label>
        <label>Email<input type="email" value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
        <label>Ciudad<input value={form.city || ""} onChange={(event) => update("city", event.target.value)} /></label>
        <label>Pais<input value={form.country || ""} onChange={(event) => update("country", event.target.value)} /></label>
        <label className="wide">Direccion<textarea value={form.address || ""} onChange={(event) => update("address", event.target.value)} /></label>
        <label className="wide">Descripcion<textarea value={form.description || ""} onChange={(event) => update("description", event.target.value)} /></label>
      </div>
    );
  }

  if (entity === "contacts") {
    return (
      <div className="form-grid">
        {client}
        <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
        <label>Cargo<input value={form.title || ""} onChange={(event) => update("title", event.target.value)} /></label>
        <label>Departamento<input value={form.department || ""} onChange={(event) => update("department", event.target.value)} /></label>
        <label>Telefono<input value={form.phone || ""} onChange={(event) => update("phone", event.target.value)} /></label>
        <label>Email<input type="email" value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
      </div>
    );
  }

  if (entity === "opportunities") {
    return (
      <div className="form-grid">
        {client}
        <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
        <label>Etapa<select value={form.stage || opportunityStages[0]} onChange={(event) => update("stage", event.target.value)}>{opportunityStages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
        <label>Tipo<input value={form.type || ""} onChange={(event) => update("type", event.target.value)} /></label>
        <label>Monto<input type="number" min="0" step="0.01" value={form.amount || ""} onChange={(event) => update("amount", event.target.value)} /></label>
        <label>Probabilidad %<input type="number" min="0" max="100" value={form.probability || ""} onChange={(event) => update("probability", event.target.value)} /></label>
        <label>Cierre esperado<input type="date" value={form.closeDate || ""} onChange={(event) => update("closeDate", event.target.value)} /></label>
      </div>
    );
  }

  if (["calls", "meetings", "tasks"].includes(entity)) {
    return (
      <div className="form-grid">
        {client}
        <label>Asunto<input value={form.title || ""} onChange={(event) => update("title", event.target.value)} required /></label>
        <label>Estado<select value={form.status || (entity === "tasks" ? taskStatuses[0] : meetingCallStatuses[0])} onChange={(event) => update("status", event.target.value)}>{(entity === "tasks" ? taskStatuses : meetingCallStatuses).map((status) => <option key={status}>{status}</option>)}</select></label>
        {entity === "tasks" ? <label>Prioridad<select value={form.priority || taskPriorities[0]} onChange={(event) => update("priority", event.target.value)}>{taskPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label> : null}
        <label>Inicio<input type="datetime-local" value={form.dateStart || ""} onChange={(event) => update("dateStart", event.target.value)} /></label>
        {entity === "tasks" ? <label>Vence<input type="date" value={form.dueDate || ""} onChange={(event) => update("dueDate", event.target.value)} /></label> : <label>Duracion minutos<input type="number" min="0" value={form.durationMinutes || ""} onChange={(event) => update("durationMinutes", event.target.value)} /></label>}
        <label className="wide">Descripcion<textarea value={form.description || ""} onChange={(event) => update("description", event.target.value)} /></label>
      </div>
    );
  }

  if (entity === "notes") {
    return (
      <div className="form-grid">
        {client}
        <label>Titulo<input value={form.title || ""} onChange={(event) => update("title", event.target.value)} required /></label>
        <label className="wide">Nota<textarea value={form.description || ""} onChange={(event) => update("description", event.target.value)} /></label>
      </div>
    );
  }

  if (entity === "cases") {
    return (
      <div className="form-grid">
        {client}
        <label>Asunto<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
        <label>Estado<select value={form.status || caseStatuses[0]} onChange={(event) => update("status", event.target.value)}>{caseStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>Prioridad<input value={form.priority || ""} onChange={(event) => update("priority", event.target.value)} /></label>
        <label>Tipo<input value={form.type || ""} onChange={(event) => update("type", event.target.value)} /></label>
        <label className="wide">Descripcion<textarea value={form.description || ""} onChange={(event) => update("description", event.target.value)} /></label>
      </div>
    );
  }

  if (entity === "products") {
    return (
      <div className="form-grid">
        <label>Producto<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
        <label>Codigo<input value={form.partNumber || ""} onChange={(event) => update("partNumber", event.target.value)} /></label>
        <label>Tipo<input value={form.type || ""} onChange={(event) => update("type", event.target.value)} /></label>
        <label>Precio<input type="number" min="0" step="0.01" value={form.price || ""} onChange={(event) => update("price", event.target.value)} /></label>
        <label>Costo<input type="number" min="0" step="0.01" value={form.cost || ""} onChange={(event) => update("cost", event.target.value)} /></label>
      </div>
    );
  }

  if (entity === "leads") {
    return (
      <div className="form-grid">
        <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
        <label>Empresa<input value={form.accountName || ""} onChange={(event) => update("accountName", event.target.value)} /></label>
        <label>Estado<input value={form.status || "New"} onChange={(event) => update("status", event.target.value)} /></label>
        <label>Fuente<input value={form.source || ""} onChange={(event) => update("source", event.target.value)} /></label>
        <label>Telefono<input value={form.phone || ""} onChange={(event) => update("phone", event.target.value)} /></label>
        <label>Email<input type="email" value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
        <label>Ciudad<input value={form.city || ""} onChange={(event) => update("city", event.target.value)} /></label>
        <label>Pais<input value={form.country || ""} onChange={(event) => update("country", event.target.value)} /></label>
      </div>
    );
  }

  return (
    <div className="form-grid">
      {client}
      <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
      <label>Estado<input value={form.status || ""} onChange={(event) => update("status", event.target.value)} /></label>
      <label>Tipo<input value={form.type || ""} onChange={(event) => update("type", event.target.value)} /></label>
      <label>Inicio<input type="date" value={form.startDate || ""} onChange={(event) => update("startDate", event.target.value)} /></label>
      <label>Fin<input type="date" value={form.endDate || ""} onChange={(event) => update("endDate", event.target.value)} /></label>
      <label>Total<input type="number" min="0" step="0.01" value={form.total || ""} onChange={(event) => update("total", event.target.value)} /></label>
    </div>
  );
}

function QuoteForm({ form, setForm, update, accountName, onPickAccount }) {
  const [context, setContext] = useState(null);

  useEffect(() => {
    if (!form.accountId) {
      setContext(null);
      return;
    }
    api.quoteContext(form.accountId).then(setContext).catch(() => setContext(null));
  }, [form.accountId]);

  useEffect(() => {
    if (!context) return;
    setForm((current) => ({
      ...current,
      paymentMethod: current.paymentMethod || context.defaults.paymentMethod || "",
      deliveryTime: current.deliveryTime || context.defaults.deliveryTime || "",
      observations: current.observations || context.defaults.observations || ""
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  function updateLine(index, key, value) {
    const lines = form.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line));
    setForm({ ...form, lines });
  }
  function addLine() {
    setForm({ ...form, lines: [...form.lines, { name: "", quantity: 1, unitPrice: 0, vatAmount: 0 }] });
  }
  function removeLine(index) {
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) });
  }
  return (
    <div className="form-grid">
      <ClientField entity="quotes" form={form} accountName={accountName} onPickAccount={onPickAccount} />
      {context ? <div className="form-note wide">Proximo numero de cotizacion: #{context.nextNumber}</div> : null}
      <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} /></label>
      <label>Forma de pago<input value={form.paymentMethod || ""} onChange={(event) => update("paymentMethod", event.target.value)} /></label>
      <label>Vencimiento<input type="date" value={form.expiration || ""} onChange={(event) => update("expiration", event.target.value)} /></label>
      <label className="wide">Observaciones<textarea value={form.observations || ""} onChange={(event) => update("observations", event.target.value)} /></label>
      <div className="wide quote-lines-editor">
        <div className="panel-title">
          <strong>Productos</strong>
          <button type="button" className="mini-action" onClick={addLine}>
            <Plus size={15} /> Linea
          </button>
        </div>
        {form.lines.map((line, index) => (
          <div className="line-editor" key={index}>
            <input placeholder="Producto" value={line.name} onChange={(event) => updateLine(index, "name", event.target.value)} required />
            <input type="number" min="0" step="0.01" placeholder="Cantidad" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} />
            <input type="number" min="0" step="0.01" placeholder="Unitario" value={line.unitPrice} onChange={(event) => updateLine(index, "unitPrice", event.target.value)} />
            <input type="number" min="0" step="0.01" placeholder="IVA" value={line.vatAmount} onChange={(event) => updateLine(index, "vatAmount", event.target.value)} />
            <button type="button" className="icon-button" onClick={() => removeLine(index)} title="Quitar linea" disabled={form.lines.length <= 1}><X size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value, editing, field, draft, setDraft }) {
  return (
    <div className="info">
      <Icon size={18} />
      <span>{label}</span>
      {editing && field ? <input value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /> : <strong>{value || "Sin dato"}</strong>}
    </div>
  );
}

function Panel({ title, count, children }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <strong>{title}</strong>
        <span>{formatNumber(count)}</span>
      </div>
      <div className="mini-list">{children || <span className="empty-small">Sin registros</span>}</div>
    </div>
  );
}

function MiniRow({ title, meta }) {
  return (
    <div className="mini-row">
      <strong>{title}</strong>
      <span>{meta || "Sin detalle"}</span>
    </div>
  );
}

function MigrationView() {
  const [migration, setMigration] = useState(null);
  useEffect(() => {
    api.migration().then(setMigration);
  }, []);
  return (
    <section className="migration-view">
      <div className="migration-banner">
        <ShieldCheck size={24} />
        <div>
          <strong>SQLite listo para operar</strong>
          <span>Los datos legacy se conservan para futura migracion a PostgreSQL o MySQL.</span>
        </div>
      </div>
      <div className="table-block">
        <table>
          <thead><tr><th>Tabla</th><th>Registros</th></tr></thead>
          <tbody>{(migration?.topTables || []).map((row) => <tr key={row.table}><td>{row.table}</td><td>{formatNumber(row.rows)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
