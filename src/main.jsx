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
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
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
  addQuoteAttachment: (quoteId, body) => request(`/api/quotes/${quoteId}/attachments`, { method: "POST", body: JSON.stringify(body) }),
  quoteAttachment: (quoteId, attachmentId) => request(`/api/quotes/${quoteId}/attachments/${attachmentId}`),
  deleteQuoteAttachment: (quoteId, attachmentId) => request(`/api/quotes/${quoteId}/attachments/${attachmentId}`, { method: "DELETE" }),
  catalogs: () => request("/api/catalogs"),
  company: () => request("/api/company"),
  updateCompany: (body) => request("/api/company", { method: "PUT", body: JSON.stringify(body) }),
  migration: () => request("/api/migration"),
  nomenclatorCategories: () => request("/api/nomenclators"),
  nomenclatorItems: (category) => request(`/api/nomenclators/${category}`),
  createNomenclatorItem: (category, value) => request(`/api/nomenclators/${category}`, { method: "POST", body: JSON.stringify({ value }) }),
  updateNomenclatorItem: (category, id, value) => request(`/api/nomenclators/${category}/${id}`, { method: "PATCH", body: JSON.stringify({ value }) }),
  deleteNomenclatorItem: (category, id) => request(`/api/nomenclators/${category}/${id}`, { method: "DELETE" }),
  provinceItems: () => request("/api/nomenclators/province"),
  createProvince: (country, name) => request("/api/nomenclators/province", { method: "POST", body: JSON.stringify({ country, name }) }),
  updateProvince: (id, name) => request(`/api/nomenclators/province/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteProvince: (id) => request(`/api/nomenclators/province/${id}`, { method: "DELETE" }),
  roles: () => request("/api/roles"),
  authUsers: () => request("/api/auth-users"),
  createAuthUser: (body) => request("/api/auth-users", { method: "POST", body: JSON.stringify(body) }),
  updateAuthUser: (id, body) => request(`/api/auth-users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAuthUser: (id) => request(`/api/auth-users/${id}`, { method: "DELETE" })
};

function withCurrent(list, current) {
  if (!current || list.includes(current)) return list;
  return [current, ...list];
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function openDataUrl(dataUrl) {
  const win = window.open(dataUrl, "_blank");
  if (!win) window.alert("El navegador bloqueo la ventana. Habilita las ventanas emergentes para ver el adjunto.");
}

const maxAttachmentBytes = 8 * 1024 * 1024;

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
  company: Settings,
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

const creatable = new Set(["accounts", "contacts", "opportunities", "quotes", "products", "cases", "leads", "notes", "calls", "meetings", "tasks", "accion", "diseno", "plan_de_accion"]);

const TECNICO_COMERCIAL_MODULES = new Set(["home", "accounts", "opportunities", "quotes", "products"]);

function roleCanWrite(role, entity) {
  if (role === "admin") return true;
  if (role === "lectura") return false;
  if (role === "tecnico_comercial") return TECNICO_COMERCIAL_MODULES.has(entity);
  return true;
}

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
  const role = user.role || "admin";
  const [summary, setSummary] = useState(null);
  const [modules, setModules] = useState([]);
  const [directory, setDirectory] = useState({ industries: [], users: [] });
  const [catalogs, setCatalogs] = useState({});
  const [activeView, setActiveView] = useState("home");
  const [subEntity, setSubEntity] = useState(null);
  const [createFor, setCreateFor] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [quoteId, setQuoteId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const createEntity = subEntity || activeView;

  useEffect(() => {
    setSubEntity(null);
  }, [activeView]);

  useEffect(() => {
    Promise.all([api.summary(), api.modules(), api.directory(), api.catalogs()])
      .then(([summaryData, moduleData, directoryData, catalogsData]) => {
        setSummary(summaryData);
        setModules(moduleData.modules);
        setDirectory(directoryData);
        setCatalogs(catalogsData);
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
            {creatable.has(createEntity) && roleCanWrite(role, createEntity) ? (
              <button className="primary-button" onClick={() => setCreateFor(createEntity)}>
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
            catalogs={catalogs}
            role={role}
            selectedId={selectedAccountId}
            onSelect={setSelectedAccountId}
            onCreate={setCreateFor}
            onQuote={setQuoteId}
            refreshKey={refreshKey}
          />
        ) : activeView === "migration" ? (
          <MigrationView />
        ) : activeView === "company" ? (
          <CompanySettings role={role} />
        ) : activeView === "nomenclators" ? (
          <NomencladoresView />
        ) : activeView === "users" ? (
          <UsersView currentUserId={user.id} />
        ) : activeView === "accion" ? (
          <AccionesView catalogs={catalogs} role={role} onQuote={setQuoteId} refreshKey={refreshKey} onSubEntityChange={setSubEntity} />
        ) : (
          <EntityView entity={activeView} module={modules.find((item) => item.id === activeView)} catalogs={catalogs} role={role} onQuote={setQuoteId} refreshKey={refreshKey} />
        )}
      </section>

      {createFor ? (
        <CreateModal
          entity={createFor}
          accountId={selectedAccountId}
          directory={directory}
          catalogs={catalogs}
          onClose={() => setCreateFor(null)}
          onCreated={(created) => {
            setCreateFor(null);
            setRefreshKey((key) => key + 1);
            if (createFor === "quotes" && created.quote?.id) setQuoteId(created.quote.id);
          }}
        />
      ) : null}
      {quoteId ? <QuoteDrawer id={quoteId} onClose={() => setQuoteId(null)} onChanged={() => setRefreshKey((key) => key + 1)} catalogs={catalogs} role={role} /> : null}
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

function AccountWorkspace({ directory, catalogs, role, selectedId, onSelect, onCreate, onQuote, refreshKey }) {
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
          {roleCanWrite(role, "accounts") ? (
            <button className="mini-action" onClick={() => onCreate("accounts")}>
              <Plus size={15} /> Nuevo
            </button>
          ) : null}
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
            directory={directory}
            catalogs={catalogs}
            role={role}
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
          catalogs={catalogs}
          role={role}
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

function AccountDetail({ selected, directory, catalogs, role, onCreate, onQuote, onOpenRecord, onDeleted }) {
  const { account, related } = selected;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account);
  const [relatedView, setRelatedView] = useState(null);
  const canWrite = roleCanWrite(role, "accounts");
  const provinceOptions = withCurrent(catalogs.provincesByCountry?.[draft.country] || [], account.state);

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
          {roleCanWrite(role, "quotes") ? (
            <button className="primary-button" onClick={() => onCreate("quotes")}>
              <FileText size={17} />
              <span>Cotizar</span>
            </button>
          ) : null}
          {canWrite ? (
            <>
              <button className="icon-button" onClick={() => (editing ? save() : setEditing(true))} title={editing ? "Guardar" : "Editar"}>
                {editing ? <Save size={18} /> : <Pencil size={18} />}
              </button>
              <button className="icon-button" onClick={remove} title="Eliminar cliente">
                <Trash2 size={18} />
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="quick-create">
        {["contacts", "quotes", "calls", "meetings", "tasks", "notes", "cases"].filter((item) => roleCanWrite(role, item)).map((item) => (
          <button key={item} onClick={() => onCreate(item)}>
            <Plus size={15} />
            <span>{moduleLabels[item]}</span>
          </button>
        ))}
      </div>
      <div className="info-grid">
        <Info icon={Phone} label="Telefono" value={account.phone} editing={editing} field="phone" draft={draft} setDraft={setDraft} />
        <Info icon={Mail} label="Email" value={account.email} editing={editing} field="email" draft={draft} setDraft={setDraft} />
        <SelectInfo icon={Building2} label="Tipo" value={account.type} editing={editing} field="type" draft={draft} setDraft={setDraft} options={withCurrent(catalogs.accountTypes || [], account.type)} />
        <SelectInfo icon={Package} label="Industria" value={account.industry} editing={editing} field="industry" draft={draft} setDraft={setDraft} options={withCurrent(directory.industries || [], account.industry)} />
        <Info icon={MapPin} label="Ciudad" value={account.city} editing={editing} field="city" draft={draft} setDraft={setDraft} />
        <SelectInfo icon={MapPin} label="Departamento/Estado" value={account.state} editing={editing} field="state" draft={draft} setDraft={setDraft} options={provinceOptions} />
        <SelectInfo icon={MapPin} label="Pais" value={account.country} editing={editing} field="country" draft={draft} setDraft={setDraft} options={withCurrent(catalogs.countries || [], account.country)} />
      </div>
      {editing ? (
        <div className="form-grid">
          <label className="wide">Direccion<textarea value={draft.address || ""} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
          <label className="wide">Descripcion<textarea value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        </div>
      ) : account.address || account.description ? (
        <div className="panel">
          {account.address ? <MiniRow title="Direccion" meta={account.address} /> : null}
          {account.description ? <MiniRow title="Descripcion" meta={account.description} /> : null}
        </div>
      ) : null}
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
          role={role}
          onClose={() => setRelatedView(null)}
          onCreate={onCreate}
          onQuote={onQuote}
          onOpenRecord={onOpenRecord}
        />
      ) : null}
    </div>
  );
}

function EntityView({ entity, module, catalogs, role, onQuote, refreshKey }) {
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
          catalogs={catalogs}
          role={role}
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
  acciones: "accion",
  planesAccion: "plan_de_accion"
};

function RelatedDrawer({ account, relation, role, onClose, onCreate, onQuote, onOpenRecord }) {
  const items = relation.items || [];
  const canCreate = creatable.has(relation.create) && roleCanWrite(role, relation.create);

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
    if (["disenos", "acciones", "planesAccion"].includes(relation.key)) {
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
          {relation.key === "activities" && roleCanWrite(role, "tasks") ? (
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
    lines: detail.lines.map((line) => {
      const base = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const derivedRate = base > 0 ? Math.round((Number(line.vatAmount || 0) / base) * 100) : 0;
      return {
        productId: line.productId || null,
        name: line.name || line.catalogProductName || "",
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate ?? derivedRate
      };
    })
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function buildQuotePrintHtml({ quote, lines, company }) {
  const rows = lines
    .map(
      (line) => `
        <tr>
          <td>${line.number}</td>
          <td>${escapeHtml(line.name || line.catalogProductName || "")}</td>
          <td class="num">${formatNumber(line.quantity)}</td>
          <td class="num">${formatMoney(line.unitPrice)}</td>
          <td class="num">${formatMoney(line.vatAmount)}</td>
          <td class="num">${formatMoney(line.total)}</td>
        </tr>`
    )
    .join("");

  const companyContact = [company.address, company.city, company.country].filter(Boolean).map(escapeHtml).join(", ");
  const companyChannels = [company.phone, company.email, company.website].filter(Boolean).map(escapeHtml).join(" &middot; ");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Cotizacion #${escapeHtml(quote.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #10233f; margin: 0; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 3px solid #11a8d8; padding-bottom: 18px; margin-bottom: 24px; }
  .header img { display: block; max-width: 180px; max-height: 70px; object-fit: contain; margin-bottom: 8px; }
  .company-name { font-size: 20px; font-weight: 800; color: #0b2545; margin: 0 0 4px; }
  .company-meta { font-size: 12px; color: #5c7084; line-height: 1.6; }
  .doc-title { text-align: right; white-space: nowrap; }
  .doc-title h1 { margin: 0; font-size: 26px; color: #0b2545; letter-spacing: .03em; }
  .doc-title p { margin: 4px 0 0; color: #5c7084; font-size: 13px; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
  .party { flex: 1; }
  .party h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #11a8d8; }
  .party p { margin: 2px 0; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #0b2545; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; padding: 10px 8px; text-align: left; }
  th.num { text-align: right; }
  td { padding: 9px 8px; border-bottom: 1px solid #e5edf3; font-size: 13px; }
  td.num { text-align: right; }
  tbody tr:nth-child(even) { background: #f7fbfd; }
  .totals { margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .totals .grand { border-top: 2px solid #0b2545; margin-top: 4px; padding-top: 10px; font-size: 17px; font-weight: 800; color: #0b2545; }
  .notes { margin-top: 24px; font-size: 13px; color: #3c4d45; }
  .notes h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #11a8d8; margin-bottom: 6px; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #96a3ad; }
  @page { margin: 16mm; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      ${company.logo ? `<img src="${company.logo}" alt="logo" />` : ""}
      <div class="company-name">${escapeHtml(company.name || "")}</div>
      <div class="company-meta">
        ${company.taxId ? `NIT ${escapeHtml(company.taxId)}<br/>` : ""}
        ${companyContact}${companyContact ? "<br/>" : ""}
        ${companyChannels}
      </div>
    </div>
    <div class="doc-title">
      <h1>COTIZACION</h1>
      <p>No. ${escapeHtml(quote.number)}</p>
      <p>Fecha: ${escapeHtml(shortDate(quote.createdAt) || "-")}</p>
      <p>Vence: ${escapeHtml(shortDate(quote.expiration) || "Sin vencimiento")}</p>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <h3>Cliente</h3>
      <p><strong>${escapeHtml(quote.accountName || "Sin cliente")}</strong></p>
      <p>${escapeHtml(quote.billingAddress || "Sin direccion")}</p>
    </div>
    <div class="party">
      <h3>Entrega</h3>
      <p>${escapeHtml(quote.shippingAddress || quote.billingAddress || "Sin direccion")}</p>
    </div>
    <div class="party">
      <h3>Condiciones</h3>
      <p>Forma de pago: ${escapeHtml(quote.paymentMethod || "N/A")}</p>
      <p>Tiempo de entrega: ${escapeHtml(quote.deliveryTime || "N/A")}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Producto</th><th class="num">Cant.</th><th class="num">Unitario</th><th class="num">IVA</th><th class="num">Total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${formatMoney(quote.subtotal)}</span></div>
    <div><span>IVA</span><span>${formatMoney(quote.tax)}</span></div>
    ${Number(quote.discount || 0) ? `<div><span>Descuento</span><span>-${formatMoney(quote.discount)}</span></div>` : ""}
    <div class="grand"><span>Total</span><span>${formatMoney(quote.total)}</span></div>
  </div>
  ${quote.observations ? `<div class="notes"><h3>Observaciones</h3><p>${escapeHtml(quote.observations)}</p></div>` : ""}
  <div class="footer">Documento generado por BIOCRM &middot; ${escapeHtml(company.name || "")}</div>
</body>
</html>`;
}

function QuoteDrawer({ id, onClose, onChanged, catalogs, role }) {
  const canWrite = roleCanWrite(role, "quotes");
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ivaRates = catalogs?.ivaRates?.length ? catalogs.ivaRates : [0, 5, 19];

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
    setDraft((current) => ({ ...current, lines: [...current.lines, { name: "", quantity: 1, unitPrice: 0, vatRate: 19 }] }));
  }

  function removeLine(index) {
    setDraft((current) => ({ ...current, lines: current.lines.filter((_, i) => i !== index) }));
  }

  async function refreshDetail() {
    const refreshed = await api.quote(id);
    setDetail(refreshed);
    return refreshed;
  }

  async function uploadAttachments(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setError("");
    for (const file of files) {
      if (file.size > maxAttachmentBytes) {
        window.alert(`"${file.name}" supera el tamano maximo permitido (8 MB).`);
        continue;
      }
      try {
        const data = await readFileAsDataUrl(file);
        await api.addQuoteAttachment(id, { name: file.name, mimeType: file.type, data });
      } catch (err) {
        setError(err.message);
      }
    }
    await refreshDetail();
  }

  async function removeAttachment(attachmentId) {
    if (!window.confirm("¿Eliminar este adjunto?")) return;
    await api.deleteQuoteAttachment(id, attachmentId);
    await refreshDetail();
  }

  async function viewAttachment(attachmentId) {
    const full = await api.quoteAttachment(id, attachmentId);
    openDataUrl(full.data);
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

  async function print() {
    setError("");
    let company;
    try {
      company = await api.company();
    } catch {
      company = { name: "Empresa" };
    }
    const win = window.open("", "_blank");
    if (!win) {
      setError("El navegador bloqueo la ventana de impresion. Habilita las ventanas emergentes para este sitio.");
      return;
    }
    win.document.open();
    win.document.write(buildQuotePrintHtml({ quote, lines: detail.lines, company }));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  const preview = editing
    ? draft.lines.reduce(
        (acc, line) => {
          const base = Number(line.quantity || 0) * Number(line.unitPrice || 0);
          return { subtotal: acc.subtotal + base, tax: acc.tax + base * (Number(line.vatRate || 0) / 100) };
        },
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
          {!editing ? (
            <button className="icon-button" onClick={print} title="Imprimir cotizacion">
              <Printer size={18} />
            </button>
          ) : null}
          {canWrite ? (
            <>
              <button className="icon-button" onClick={() => (editing ? save() : setEditing(true))} title={editing ? "Guardar" : "Editar"} disabled={saving}>
                {editing ? <Save size={18} /> : <Pencil size={18} />}
              </button>
              <button className="icon-button" onClick={remove} title="Eliminar">
                <Trash2 size={18} />
              </button>
            </>
          ) : null}
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
            <div className="line-editor line-editor-head">
              <span>Producto</span>
              <span>Cantidad</span>
              <span>Precio unitario</span>
              <span>IVA</span>
              <span>Importe</span>
              <span></span>
            </div>
            {draft.lines.map((line, index) => (
              <div className="line-editor" key={index}>
                <input placeholder="Nombre del producto" value={line.name} onChange={(event) => updateLine(index, "name", event.target.value)} required />
                <input type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} />
                <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, "unitPrice", event.target.value)} />
                <select value={line.vatRate ?? 19} onChange={(event) => updateLine(index, "vatRate", event.target.value)}>
                  {withCurrent(ivaRates, line.vatRate).map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
                </select>
                <span className="line-amount">{formatMoney(lineAmount(line))}</span>
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
      <div className="table-block">
        <div className="panel-title">
          <strong>Adjuntos</strong>
          {canWrite ? (
            <label className="mini-action file-picker">
              <Paperclip size={15} /> Adjuntar
              <input type="file" multiple onChange={uploadAttachments} />
            </label>
          ) : null}
        </div>
        {detail.attachments.length ? (
          <div className="mini-list">
            {detail.attachments.map((file) => (
              <div className="attachment-row" key={file.id}>
                <button type="button" className="attachment-link" onClick={() => viewAttachment(file.id)}>{file.name}</button>
                <span className="attachment-size">{formatFileSize(file.size)}</span>
                {canWrite ? <button type="button" className="icon-button" onClick={() => removeAttachment(file.id)} title="Eliminar adjunto"><Trash2 size={14} /></button> : null}
              </div>
            ))}
          </div>
        ) : (
          <span className="empty-small">Sin adjuntos</span>
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

function recordFieldsFor(entity, catalogs) {
  const c = catalogs || {};
  switch (entity) {
    case "contacts":
      return [["name", "Nombre"], ["title", "Cargo"], ["department", "Departamento", "select", c.departments || []], ["phone", "Telefono"], ["email", "Email"]];
    case "opportunities":
      return [["name", "Nombre"], ["stage", "Etapa", "select", opportunityStages], ["type", "Tipo"], ["amount", "Monto", "number"], ["probability", "Probabilidad %", "number"], ["closeDate", "Cierre esperado", "date"]];
    case "leads":
      return [["name", "Nombre"], ["accountName", "Empresa"], ["status", "Estado", "select", c.leadStatuses || []], ["source", "Fuente", "select", c.leadSources || []], ["phone", "Telefono"], ["email", "Email"], ["city", "Ciudad"], ["country", "Pais", "select", c.countries || []]];
    case "products":
      return [["name", "Producto"], ["partNumber", "Codigo"], ["type", "Tipo", "select", c.productTypes || []], ["price", "Precio", "number"], ["cost", "Costo", "number"]];
    case "cases":
      return [["name", "Asunto"], ["status", "Estado", "select", caseStatuses], ["priority", "Prioridad"], ["type", "Tipo"], ["description", "Descripcion", "textarea"]];
    case "notes":
      return [["title", "Titulo"], ["description", "Nota", "textarea"]];
    case "calls":
      return [["title", "Asunto"], ["status", "Estado", "select", meetingCallStatuses], ["dateStart", "Inicio", "datetime-local"], ["durationMinutes", "Duracion minutos", "number"], ["description", "Descripcion", "textarea"]];
    case "meetings":
      return [["title", "Asunto"], ["status", "Estado", "select", meetingCallStatuses], ["dateStart", "Inicio", "datetime-local"], ["durationMinutes", "Duracion minutos", "number"], ["description", "Descripcion", "textarea"]];
    case "tasks":
      return [["title", "Asunto"], ["status", "Estado", "select", taskStatuses], ["priority", "Prioridad", "select", taskPriorities], ["dateStart", "Inicio", "datetime-local"], ["dueDate", "Vence", "date"], ["description", "Descripcion", "textarea"]];
    case "diseno":
      return [["name", "Nombre"], ["status", "Estado", "select", c.disenoStatuses || []], ["type", "Tipo"], ["startDate", "Inicio", "date"], ["endDate", "Fin", "date"]];
    default:
      return [["name", "Nombre"], ["status", "Estado"], ["type", "Tipo"], ["startDate", "Inicio", "date"], ["endDate", "Fin", "date"], ["total", "Total", "number"]];
  }
}

function formatFieldValue(key, value, type) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  if (moneyFieldKeys.has(key)) return formatMoney(value);
  if (type === "date" || type === "datetime-local") return shortDate(value);
  return String(value);
}

function RecordDrawer({ entity, record, catalogs, role, onClose, onChanged }) {
  const canWrite = roleCanWrite(role, entity);
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

  const fields = recordFieldsFor(entity, catalogs);
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
          {canWrite ? (
            <>
              <button className="icon-button" onClick={() => (editing ? save() : setEditing(true))} title={editing ? "Guardar" : "Editar"} disabled={saving}>
                {editing ? <Save size={18} /> : <Pencil size={18} />}
              </button>
              <button className="icon-button" onClick={remove} title="Eliminar">
                <Trash2 size={18} />
              </button>
            </>
          ) : null}
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
                <option value="">Selecciona</option>
                {withCurrent(options, draft[key]).map((option) => <option key={option}>{option}</option>)}
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

function CreateModal({ entity, accountId, directory, catalogs, onClose, onCreated }) {
  const [form, setForm] = useState({ accountId, country: "Colombia", lines: [{ name: "", quantity: 1, unitPrice: 0, vatRate: 19 }], attachments: [] });
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
      const { attachments, ...payload } = form;
      const created = entity === "accounts" ? await api.createAccount(payload) : await api.createEntity(entity, payload);
      if (entity === "quotes" && attachments?.length && created.quote?.id) {
        for (const file of attachments) {
          await api.addQuoteAttachment(created.quote.id, file).catch(() => {});
        }
      }
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
          <QuoteForm form={form} setForm={setForm} update={update} accountName={accountName} onPickAccount={pickAccount} catalogs={catalogs} />
        ) : (
          <EntityForm entity={entity} form={form} update={update} accountName={accountName} onPickAccount={pickAccount} directory={directory} catalogs={catalogs} />
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

function EntityForm({ entity, form, update, accountName, onPickAccount, directory, catalogs }) {
  const client = <ClientField entity={entity} form={form} accountName={accountName} onPickAccount={onPickAccount} />;

  if (entity === "accounts") {
    return (
      <div className="form-grid">
        <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
        <label>Tipo<select value={form.type || ""} onChange={(event) => update("type", event.target.value)}><option value="">Selecciona tipo</option>{withCurrent(catalogs.accountTypes || [], form.type).map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Industria<select value={form.industry || ""} onChange={(event) => update("industry", event.target.value)}><option value="">Selecciona industria</option>{withCurrent(directory.industries || [], form.industry).map((industry) => <option key={industry}>{industry}</option>)}</select></label>
        <label>Telefono<input value={form.phone || ""} onChange={(event) => update("phone", event.target.value)} /></label>
        <label>Email<input type="email" value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
        <label>Ciudad<input value={form.city || ""} onChange={(event) => update("city", event.target.value)} /></label>
        <label>Pais<select value={form.country || "Colombia"} onChange={(event) => update("country", event.target.value)}>{withCurrent(catalogs.countries || [], form.country).map((country) => <option key={country}>{country}</option>)}</select></label>
        <label>Departamento/Estado<select value={form.state || ""} onChange={(event) => update("state", event.target.value)}><option value="">Selecciona</option>{withCurrent(catalogs.provincesByCountry?.[form.country || "Colombia"] || [], form.state).map((province) => <option key={province}>{province}</option>)}</select></label>
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
        <label>Departamento<select value={form.department || ""} onChange={(event) => update("department", event.target.value)}><option value="">Selecciona departamento</option>{withCurrent(catalogs.departments || [], form.department).map((department) => <option key={department}>{department}</option>)}</select></label>
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
        <label>Tipo<select value={form.type || ""} onChange={(event) => update("type", event.target.value)}><option value="">Selecciona tipo</option>{withCurrent(catalogs.productTypes || [], form.type).map((type) => <option key={type}>{type}</option>)}</select></label>
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
        <label>Estado<select value={form.status || "New"} onChange={(event) => update("status", event.target.value)}>{withCurrent(catalogs.leadStatuses || [], form.status).map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>Fuente<select value={form.source || ""} onChange={(event) => update("source", event.target.value)}><option value="">Selecciona fuente</option>{withCurrent(catalogs.leadSources || [], form.source).map((source) => <option key={source}>{source}</option>)}</select></label>
        <label>Telefono<input value={form.phone || ""} onChange={(event) => update("phone", event.target.value)} /></label>
        <label>Email<input type="email" value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
        <label>Ciudad<input value={form.city || ""} onChange={(event) => update("city", event.target.value)} /></label>
        <label>Pais<select value={form.country || "Colombia"} onChange={(event) => update("country", event.target.value)}>{withCurrent(catalogs.countries || [], form.country).map((country) => <option key={country}>{country}</option>)}</select></label>
      </div>
    );
  }

  if (entity === "diseno") {
    return (
      <div className="form-grid">
        {client}
        <label>Nombre<input value={form.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
        <label>Estado<select value={form.status || catalogs.disenoStatuses?.[0] || ""} onChange={(event) => update("status", event.target.value)}>{withCurrent(catalogs.disenoStatuses || [], form.status).map((status) => <option key={status}>{status}</option>)}</select></label>
        <label>Tipo<input value={form.type || ""} onChange={(event) => update("type", event.target.value)} /></label>
        <label>Inicio<input type="date" value={form.startDate || ""} onChange={(event) => update("startDate", event.target.value)} /></label>
        <label>Fin<input type="date" value={form.endDate || ""} onChange={(event) => update("endDate", event.target.value)} /></label>
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

function lineAmount(line) {
  const base = Number(line.quantity || 0) * Number(line.unitPrice || 0);
  return base + base * (Number(line.vatRate || 0) / 100);
}

function QuoteForm({ form, setForm, update, accountName, onPickAccount, catalogs }) {
  const [context, setContext] = useState(null);
  const ivaRates = catalogs?.ivaRates?.length ? catalogs.ivaRates : [0, 5, 19];

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
    setForm({ ...form, lines: [...form.lines, { name: "", quantity: 1, unitPrice: 0, vatRate: 19 }] });
  }
  function removeLine(index) {
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) });
  }

  async function onFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    for (const file of files) {
      if (file.size > maxAttachmentBytes) {
        window.alert(`"${file.name}" supera el tamano maximo permitido (8 MB).`);
        continue;
      }
      const data = await readFileAsDataUrl(file);
      setForm((current) => ({ ...current, attachments: [...(current.attachments || []), { name: file.name, mimeType: file.type, data, size: file.size }] }));
    }
  }
  function removeAttachment(index) {
    setForm((current) => ({ ...current, attachments: current.attachments.filter((_, i) => i !== index) }));
  }

  const totals = form.lines.reduce(
    (acc, line) => {
      const base = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return { subtotal: acc.subtotal + base, tax: acc.tax + base * (Number(line.vatRate || 0) / 100) };
    },
    { subtotal: 0, tax: 0 }
  );

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
        <div className="line-editor line-editor-head">
          <span>Producto</span>
          <span>Cantidad</span>
          <span>Precio unitario</span>
          <span>IVA</span>
          <span>Importe</span>
          <span></span>
        </div>
        {form.lines.map((line, index) => (
          <div className="line-editor" key={index}>
            <input placeholder="Nombre del producto" value={line.name} onChange={(event) => updateLine(index, "name", event.target.value)} required />
            <input type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} />
            <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(index, "unitPrice", event.target.value)} />
            <select value={line.vatRate ?? 19} onChange={(event) => updateLine(index, "vatRate", event.target.value)}>
              {withCurrent(ivaRates, line.vatRate).map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
            </select>
            <span className="line-amount">{formatMoney(lineAmount(line))}</span>
            <button type="button" className="icon-button" onClick={() => removeLine(index)} title="Quitar linea" disabled={form.lines.length <= 1}><X size={16} /></button>
          </div>
        ))}
        <div className="line-totals">
          <span>Subtotal <strong>{formatMoney(totals.subtotal)}</strong></span>
          <span>IVA <strong>{formatMoney(totals.tax)}</strong></span>
          <span>Total <strong>{formatMoney(totals.subtotal + totals.tax)}</strong></span>
        </div>
      </div>
      <div className="wide quote-lines-editor">
        <div className="panel-title">
          <strong>Adjuntos</strong>
          <label className="mini-action file-picker">
            <Paperclip size={15} /> Adjuntar
            <input type="file" multiple onChange={onFilesSelected} />
          </label>
        </div>
        {(form.attachments || []).length ? (
          <div className="mini-list">
            {form.attachments.map((file, index) => (
              <div className="attachment-row" key={index}>
                <span>{file.name}</span>
                <span className="attachment-size">{formatFileSize(file.size)}</span>
                <button type="button" className="icon-button" onClick={() => removeAttachment(index)} title="Quitar adjunto"><X size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <span className="empty-small">Sin adjuntos. Puedes agregar fichas tecnicas, imagenes u ordenes de compra.</span>
        )}
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

function SelectInfo({ icon: Icon, label, value, editing, field, draft, setDraft, options }) {
  return (
    <div className="info">
      <Icon size={18} />
      <span>{label}</span>
      {editing ? (
        <select value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}>
          <option value="">Selecciona</option>
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : (
        <strong>{value || "Sin dato"}</strong>
      )}
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

function AccionesView({ catalogs, role, onQuote, refreshKey, onSubEntityChange }) {
  const [tab, setTab] = useState("accion");

  useEffect(() => {
    onSubEntityChange?.(tab);
  }, [tab]);

  const module = tab === "accion" ? { id: "accion", label: "Acciones", group: "Personalizados" } : { id: "plan_de_accion", label: "Planes de accion", group: "Personalizados" };

  return (
    <div>
      <div className="tab-switch">
        <button className={tab === "accion" ? "tab-button active" : "tab-button"} onClick={() => setTab("accion")}>Acciones</button>
        <button className={tab === "plan_de_accion" ? "tab-button active" : "tab-button"} onClick={() => setTab("plan_de_accion")}>Planes de accion</button>
      </div>
      <EntityView entity={tab} module={module} catalogs={catalogs} role={role} onQuote={onQuote} refreshKey={refreshKey} />
    </div>
  );
}

function CompanySettings({ role }) {
  const canWrite = !role || role === "admin";
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.company().then(setDraft);
  }, []);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function onLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("logo", String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateCompany(draft);
      setDraft(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!draft) return null;

  return (
    <section className="company-settings">
      <form className="panel" onSubmit={save}>
        <div className="panel-title">
          <strong>Datos de la empresa emisora</strong>
          <span>Se usan para imprimir las cotizaciones</span>
        </div>
        <fieldset className="form-grid" disabled={!canWrite}>
          <label>Nombre<input value={draft.name || ""} onChange={(event) => update("name", event.target.value)} required /></label>
          <label>NIT / Identificacion fiscal<input value={draft.taxId || ""} onChange={(event) => update("taxId", event.target.value)} /></label>
          <label>Telefono<input value={draft.phone || ""} onChange={(event) => update("phone", event.target.value)} /></label>
          <label>Email<input type="email" value={draft.email || ""} onChange={(event) => update("email", event.target.value)} /></label>
          <label>Sitio web<input value={draft.website || ""} onChange={(event) => update("website", event.target.value)} /></label>
          <label>Ciudad<input value={draft.city || ""} onChange={(event) => update("city", event.target.value)} /></label>
          <label>Pais<input value={draft.country || ""} onChange={(event) => update("country", event.target.value)} /></label>
          <label className="wide">Direccion<input value={draft.address || ""} onChange={(event) => update("address", event.target.value)} /></label>
          <label className="wide">Logo (aparece en la cotizacion impresa)<input type="file" accept="image/*" onChange={onLogoChange} /></label>
          {draft.logo ? (
            <div className="wide company-logo-preview">
              <img src={draft.logo} alt="Logo" />
              <button type="button" className="mini-action" onClick={() => update("logo", "")}>Quitar logo</button>
            </div>
          ) : null}
        </fieldset>
        {error ? <div className="alert">{error}</div> : null}
        {canWrite ? (
          <div className="modal-actions">
            {saved ? <span className="form-note">Datos guardados</span> : <span />}
            <button className="primary-button" disabled={saving}><Save size={17} /><span>{saving ? "Guardando" : "Guardar"}</span></button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function NomencladoresView() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    api.nomenclatorCategories().then((data) => {
      setCategories(data.categories);
      setActiveCategory((current) => current || data.categories[0]?.id || null);
    });
  }, []);

  return (
    <div>
      <div className="tab-switch">
        {categories.map((category) => (
          <button
            key={category.id}
            className={activeCategory === category.id ? "tab-button active" : "tab-button"}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
      {activeCategory === "province" ? (
        <ProvinceNomenclatorTab />
      ) : activeCategory ? (
        <SimpleNomenclatorTab key={activeCategory} category={activeCategory} label={categories.find((item) => item.id === activeCategory)?.label} />
      ) : null}
    </div>
  );
}

function SimpleNomenclatorTab({ category, label }) {
  const [items, setItems] = useState([]);
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.nomenclatorItems(category).then((data) => setItems(data.items));
  }

  useEffect(load, [category]);

  async function addItem(event) {
    event.preventDefault();
    if (!newValue.trim()) return;
    setError("");
    try {
      await api.createNomenclatorItem(category, newValue.trim());
      setNewValue("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveEdit(id) {
    if (!editValue.trim()) return;
    try {
      await api.updateNomenclatorItem(category, id, editValue.trim());
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(id) {
    if (!window.confirm("¿Eliminar este valor del nomenclador?")) return;
    try {
      await api.deleteNomenclatorItem(category, id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="table-block">
      <div className="panel-title">
        <strong>{label}</strong>
        <span>{formatNumber(items.length)} valores</span>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <form className="nomenclator-add-row" onSubmit={addItem}>
        <input placeholder="Nuevo valor" value={newValue} onChange={(event) => setNewValue(event.target.value)} />
        <button className="primary-button" type="submit"><Plus size={16} /><span>Agregar</span></button>
      </form>
      <div className="mini-list">
        {items.map((item) => (
          <div className="nomenclator-row" key={item.id}>
            {editingId === item.id ? (
              <input value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />
            ) : (
              <span>{item.value}</span>
            )}
            <div className="action-row">
              {editingId === item.id ? (
                <button type="button" className="icon-button" onClick={() => saveEdit(item.id)} title="Guardar"><Save size={15} /></button>
              ) : (
                <button type="button" className="icon-button" onClick={() => { setEditingId(item.id); setEditValue(item.value); }} title="Editar"><Pencil size={15} /></button>
              )}
              <button type="button" className="icon-button" onClick={() => removeItem(item.id)} title="Eliminar"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {!items.length ? <span className="empty-small">Sin valores</span> : null}
      </div>
    </div>
  );
}

function ProvinceNomenclatorTab() {
  const [items, setItems] = useState([]);
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState("");

  function load() {
    api.provinceItems().then((data) => setItems(data.items));
  }

  useEffect(() => {
    load();
    api.nomenclatorItems("country").then((data) => {
      const values = data.items.map((item) => item.value);
      setCountries(values);
      setCountry((current) => current || values[0] || "");
    });
  }, []);

  const filtered = items.filter((item) => item.country === country);

  async function addItem(event) {
    event.preventDefault();
    if (!newValue.trim() || !country) return;
    setError("");
    try {
      await api.createProvince(country, newValue.trim());
      setNewValue("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveEdit(id) {
    if (!editValue.trim()) return;
    try {
      await api.updateProvince(id, editValue.trim());
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(id) {
    if (!window.confirm("¿Eliminar esta provincia/estado?")) return;
    try {
      await api.deleteProvince(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="table-block">
      <div className="panel-title">
        <strong>Provincias / Estados</strong>
        <span>{formatNumber(filtered.length)} en {country || "..."}</span>
      </div>
      <div className="filters single">
        <label className="selectbox">
          <MapPin size={16} />
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            {countries.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <form className="nomenclator-add-row" onSubmit={addItem}>
        <input placeholder="Nueva provincia o estado" value={newValue} onChange={(event) => setNewValue(event.target.value)} />
        <button className="primary-button" type="submit"><Plus size={16} /><span>Agregar</span></button>
      </form>
      <div className="mini-list">
        {filtered.map((item) => (
          <div className="nomenclator-row" key={item.id}>
            {editingId === item.id ? (
              <input value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />
            ) : (
              <span>{item.name}</span>
            )}
            <div className="action-row">
              {editingId === item.id ? (
                <button type="button" className="icon-button" onClick={() => saveEdit(item.id)} title="Guardar"><Save size={15} /></button>
              ) : (
                <button type="button" className="icon-button" onClick={() => { setEditingId(item.id); setEditValue(item.name); }} title="Editar"><Pencil size={15} /></button>
              )}
              <button type="button" className="icon-button" onClick={() => removeItem(item.id)} title="Eliminar"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {!filtered.length ? <span className="empty-small">Sin provincias registradas para este pais</span> : null}
      </div>
    </div>
  );
}

const roleLabels = {
  admin: "Administrador",
  comercial: "Comercial",
  tecnico_comercial: "Tecnico comercial",
  lectura: "Solo lectura"
};

function UsersView({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", role: "comercial" });
  const [error, setError] = useState("");

  function load() {
    api.authUsers().then((data) => setUsers(data.items));
  }

  useEffect(() => {
    load();
    api.roles().then((data) => setRoles(data.roles));
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createUser(event) {
    event.preventDefault();
    setError("");
    try {
      await api.createAuthUser(form);
      setForm({ username: "", password: "", displayName: "", role: "comercial" });
      setCreating(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeRole(user, role) {
    try {
      await api.updateAuthUser(user.id, { role });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(user) {
    try {
      await api.updateAuthUser(user.id, { active: !user.active });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeUser(user) {
    if (!window.confirm(`¿Desactivar el usuario "${user.displayName}"? No podra volver a iniciar sesion.`)) return;
    try {
      await api.deleteAuthUser(user.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="table-block">
      <div className="panel-title">
        <strong>Usuarios</strong>
        <button type="button" className="mini-action" onClick={() => setCreating((value) => !value)}>
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      {creating ? (
        <form className="form-grid nomenclator-create-user" onSubmit={createUser}>
          <label>Usuario<input value={form.username} onChange={(event) => update("username", event.target.value)} required /></label>
          <label>Nombre completo<input value={form.displayName} onChange={(event) => update("displayName", event.target.value)} required /></label>
          <label>Contrasena<input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} required /></label>
          <label>Rol<select value={form.role} onChange={(event) => update("role", event.target.value)}>{roles.map((role) => <option key={role} value={role}>{roleLabels[role] || role}</option>)}</select></label>
          <div className="wide modal-actions">
            <button type="button" className="icon-button" onClick={() => setCreating(false)}><X size={18} /></button>
            <button className="primary-button" type="submit"><Save size={17} /><span>Guardar</span></button>
          </div>
        </form>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.displayName}</td>
              <td>
                <select value={user.role} onChange={(event) => changeRole(user, event.target.value)} disabled={user.id === currentUserId}>
                  {roles.map((role) => <option key={role} value={role}>{roleLabels[role] || role}</option>)}
                </select>
              </td>
              <td><span className={`pill ${user.active ? "" : "danger"}`}>{user.active ? "Activo" : "Inactivo"}</span></td>
              <td>
                <div className="action-row">
                  <button type="button" className="icon-button" onClick={() => toggleActive(user)} title={user.active ? "Desactivar" : "Activar"} disabled={user.id === currentUserId}>
                    {user.active ? <X size={15} /> : <Check size={15} />}
                  </button>
                  <button type="button" className="icon-button" onClick={() => removeUser(user)} title="Eliminar" disabled={user.id === currentUserId}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
