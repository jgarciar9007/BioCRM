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
  quote: (id) => request(`/api/quotes/${id}`),
  migration: () => request("/api/migration")
};

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
  campaigns: Activity,
  targets: UserRound,
  target_lists: ClipboardList,
  contracts: FileText,
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
  contracts: "Contratos",
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
  const [directory, setDirectory] = useState({ industries: [], statuses: [], users: [] });
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
      {quoteId ? <QuoteDrawer id={quoteId} onClose={() => setQuoteId(null)} /> : null}
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
  const [filters, setFilters] = useState({ search: "", industry: "", status: "", pageSize: 60 });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.accounts(filters).then((data) => {
      setAccounts(data);
      if (!selectedId && data.items[0]) onSelect(data.items[0].id);
    });
  }, [filters, refreshKey]);

  useEffect(() => {
    if (selectedId) api.account(selectedId).then(setSelected);
  }, [selectedId, refreshKey]);

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
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Estado</option>
              {directory.statuses.map((item) => <option key={item}>{item}</option>)}
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
        {selected ? <AccountDetail selected={selected} onCreate={onCreate} onQuote={onQuote} /> : <div className="empty">Selecciona un cliente</div>}
      </section>
    </div>
  );
}

function AccountDetail({ selected, onCreate, onQuote }) {
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

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <span className={`pill ${account.status === "Eliminado" ? "danger" : ""}`}>{account.status}</span>
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
          { key: "contracts", title: "Contratos", icon: FileText, items: related.contracts || [], create: "contracts" },
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
      {relatedView ? <RelatedDrawer account={account} relation={relatedView} onClose={() => setRelatedView(null)} onCreate={onCreate} onQuote={onQuote} /> : null}
      <section className="timeline legacy-panels">
        <Panel title="Contactos" count={related.contacts.length}>
          {related.contacts.slice(0, 8).map((item) => <MiniRow key={item.id} title={item.name} meta={[item.title, item.phone, item.email].filter(Boolean).join(" · ")} />)}
        </Panel>
        <Panel title="Cotizaciones" count={related.quotes.length}>
          {related.quotes.slice(0, 10).map((quote) => (
            <button className="mini-row clickable" key={quote.id} onClick={() => onQuote(quote.id)}>
              <strong>{quote.name}</strong>
              <span>#{quote.number} · {quote.stage} · {formatMoney(quote.total)}</span>
            </button>
          ))}
        </Panel>
        <Panel title="Actividades" count={related.activities.length}>
          {related.activities.slice(0, 10).map((item) => <MiniRow key={item.id} title={item.title} meta={`${item.type} · ${item.status || ""} · ${shortDate(item.dateStart || item.dueDate)}`} />)}
        </Panel>
        <Panel title="Casos y facturas" count={related.cases.length + related.invoices.length}>
          {related.cases.slice(0, 5).map((item) => <MiniRow key={item.id} title={item.name} meta={`${item.status || ""} · ${item.priority || ""}`} />)}
          {related.invoices.slice(0, 5).map((item) => <MiniRow key={item.id} title={item.name} meta={`${item.status || ""} · ${formatMoney(item.total)}`} />)}
        </Panel>
      </section>
    </div>
  );
}

function EntityView({ entity, module, onQuote, refreshKey }) {
  const [data, setData] = useState({ items: [], total: 0 });
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");

  useEffect(() => {
    api.entity(entity, { search, pageSize: 80 }).then(setData);
  }, [entity, search, refreshKey]);

  function detailFor(item) {
    if (entity === "quotes") return item.accountName || "Sin cliente relacionado";
    if (entity === "opportunities") return [item.stage, formatMoney(item.amount)].filter(Boolean).join(" · ");
    if (entity === "products") return [item.partNumber, item.type].filter(Boolean).join(" · ");
    if (entity === "contacts") return [item.title, item.email, item.phone].filter(Boolean).join(" · ");
    if (entity === "calls" || entity === "meetings" || entity === "tasks" || entity === "calendar") return [item.type, item.status, shortDate(item.dateStart || item.dueDate)].filter(Boolean).join(" · ");
    return [item.status, item.stage, item.type, item.city, item.country].filter(Boolean).join(" · ") || "Sin clasificacion";
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
      <EntityList2 items={data.items} entity={entity} onQuote={onQuote} />
      <div className="entity-grid">
        {data.items.map((item) => (
          <button className="entity-card" key={item.id} onClick={() => entity === "quotes" && onQuote(item.id)}>
            <strong>{item.name || item.title}</strong>
            {entity === "quotes" ? <span>{item.accountName || "Sin cliente relacionado"}</span> : null}
            <span>{[item.status, item.stage, item.type, item.city, item.country].filter(Boolean).join(" · ") || "Sin clasificacion"}</span>
            {"total" in item ? <b>{formatMoney(item.total)}</b> : null}
            {item.number ? <small>#{item.number}</small> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function EntityList({ items, entity, detailFor, onQuote }) {
  if (entity === "contacts") {
    return (
      <div className="table-block entity-table">
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Cargo</th>
              <th>Departamento</th>
              <th>Telefono</th>
              <th>Email</th>
              <th>Ubicacion</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name || "Sin nombre"}</strong></td>
                <td>{item.title || "Sin cargo"}</td>
                <td>{item.department || "Sin departamento"}</td>
                <td>{item.phone || "Sin telefono"}</td>
                <td>{item.email || "Sin email"}</td>
                <td>{[item.city, item.state, item.country].filter(Boolean).join(" · ") || "Sin ubicacion"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="table-block entity-table">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Detalle</th>
            <th>Estado</th>
            <th>Importe</th>
            <th>Referencia</th>
            <th>Actualizado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={entity === "quotes" ? "clickable-row" : ""} onClick={() => entity === "quotes" && onQuote(item.id)}>
              <td><strong>{item.name || item.title || item.documentName || "Sin nombre"}</strong></td>
              <td>{detailFor(item)}</td>
              <td>{item.status || item.stage || item.approvalStatus || "Sin estado"}</td>
              <td>{("total" in item || "amount" in item || "price" in item) ? formatMoney(item.total || item.amount || item.price) : "Sin importe"}</td>
              <td>{item.number ? `#${item.number}` : item.partNumber || item.type || "Sin referencia"}</td>
              <td>{shortDate(item.updatedAt || item.createdAt || item.dateStart || item.dueDate) || "Sin fecha"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntityList2({ items, entity, onQuote }) {
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
            <tr key={item.id} className={entity === "quotes" ? "clickable-row" : ""} onClick={() => entity === "quotes" && onQuote(item.id)}>
              {columns.map(([label, render]) => <td key={label}>{render(item)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelatedDrawer({ account, relation, onClose, onCreate, onQuote }) {
  const items = relation.items || [];
  const canCreate = creatable.has(relation.create);

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
            onClick={() => relation.key === "quotes" && onQuote(item.id)}
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

function QuoteDrawer({ id, onClose }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.quote(id).then(setDetail);
  }, [id]);

  if (!detail) return null;
  const { quote, groups, lines } = detail;

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <div>
          <span className="pill">Cotizacion #{quote.number}</span>
          <h2>{quote.name}</h2>
          <p>{quote.accountName || "Sin cliente"} · {quote.stage}</p>
        </div>
        <button className="icon-button" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="quote-summary">
        <Info icon={BadgeDollarSign} label="Subtotal" value={formatMoney(quote.subtotal)} />
        <Info icon={BadgeDollarSign} label="IVA" value={formatMoney(quote.tax)} />
        <Info icon={BadgeDollarSign} label="Total" value={formatMoney(quote.total)} />
        <Info icon={CalendarClock} label="Vence" value={shortDate(quote.expiration)} />
      </div>
      <div className="quote-addresses">
        <MiniRow title="Facturacion" meta={quote.billingAddress || "Sin direccion"} />
        <MiniRow title="Entrega" meta={quote.shippingAddress || "Sin direccion"} />
      </div>
      <div className="table-block">
        <div className="panel-title">
          <strong>Lineas</strong>
          <span>{formatNumber(lines.length)} productos</span>
        </div>
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
            {lines.map((line) => (
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
      </div>
      <Panel title="Grupos" count={groups.length}>
        {groups.map((group) => <MiniRow key={group.id} title={group.name} meta={`${formatMoney(group.subtotal)} · IVA ${formatMoney(group.tax)} · Total ${formatMoney(group.total)}`} />)}
      </Panel>
      {quote.observations ? <Panel title="Observaciones" count={1}><MiniRow title="Condiciones" meta={quote.observations} /></Panel> : null}
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
          <QuoteForm form={form} setForm={setForm} update={update} accountName={accountName} />
        ) : (
          <EntityForm entity={entity} form={form} update={update} accountName={accountName} />
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

function ClientField({ accountName, entity }) {
  if (entity === "accounts" || entity === "products" || entity === "leads") return null;
  if (accountName) return <label>Cliente<input value={accountName} readOnly /></label>;
  return <div className="form-note wide">Para relacionar este registro, crealo desde la ficha de un cliente.</div>;
}

function EntityForm({ entity, form, update, accountName }) {
  const client = <ClientField accountName={accountName} entity={entity} />;

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
        <label>Etapa<select value={form.stage || "Prospeccion"} onChange={(event) => update("stage", event.target.value)}><option>Prospeccion</option><option>Calificacion</option><option>Propuesta</option><option>Negociacion</option><option>Ganada</option><option>Perdida</option></select></label>
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
        <label>Estado<select value={form.status || "Planificada"} onChange={(event) => update("status", event.target.value)}><option>Planificada</option><option>En proceso</option><option>Completada</option><option>Cancelada</option></select></label>
        {entity === "tasks" ? <label>Prioridad<select value={form.priority || "Media"} onChange={(event) => update("priority", event.target.value)}><option>Alta</option><option>Media</option><option>Baja</option></select></label> : null}
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
        <label>Estado<select value={form.status || "Nuevo"} onChange={(event) => update("status", event.target.value)}><option>Nuevo</option><option>Asignado</option><option>En proceso</option><option>Cerrado</option></select></label>
        <label>Prioridad<select value={form.priority || "Media"} onChange={(event) => update("priority", event.target.value)}><option>Alta</option><option>Media</option><option>Baja</option></select></label>
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
        <label>Estado<input value={form.status || "Nuevo"} onChange={(event) => update("status", event.target.value)} /></label>
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

function QuoteForm({ form, setForm, update, accountName }) {
  function updateLine(index, key, value) {
    const lines = form.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line));
    setForm({ ...form, lines });
  }
  return (
    <div className="form-grid">
      {accountName ? <label>Cliente<input value={accountName} readOnly /></label> : <div className="form-note">Crea la cotizacion desde la ficha de un cliente para relacionarla correctamente.</div>}
      <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} /></label>
      <label>Forma de pago<input value={form.paymentMethod || ""} onChange={(event) => update("paymentMethod", event.target.value)} /></label>
      <label>Vencimiento<input type="date" value={form.expiration || ""} onChange={(event) => update("expiration", event.target.value)} /></label>
      <label className="wide">Observaciones<textarea value={form.observations || ""} onChange={(event) => update("observations", event.target.value)} /></label>
      <div className="wide quote-lines-editor">
        <div className="panel-title">
          <strong>Productos</strong>
          <button type="button" className="mini-action" onClick={() => setForm({ ...form, lines: [...form.lines, { name: "", quantity: 1, unitPrice: 0, vatAmount: 0 }] })}>
            <Plus size={15} /> Linea
          </button>
        </div>
        {form.lines.map((line, index) => (
          <div className="line-editor" key={index}>
            <input placeholder="Producto" value={line.name} onChange={(event) => updateLine(index, "name", event.target.value)} required />
            <input type="number" min="0" step="0.01" placeholder="Cantidad" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} />
            <input type="number" min="0" step="0.01" placeholder="Unitario" value={line.unitPrice} onChange={(event) => updateLine(index, "unitPrice", event.target.value)} />
            <input type="number" min="0" step="0.01" placeholder="IVA" value={line.vatAmount} onChange={(event) => updateLine(index, "vatAmount", event.target.value)} />
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
