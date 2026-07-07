import cors from "cors";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const app = express();
const root = process.cwd();
const dbFile = path.join(root, "data", "biocrm.sqlite");
const distDir = path.join(root, "dist");
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || "127.0.0.1";

if (!fs.existsSync(dbFile)) {
  console.error("No existe data/biocrm.sqlite. Ejecuta: npm run import:suitecrm");
  process.exit(1);
}

const db = new DatabaseSync(dbFile);
db.exec("PRAGMA foreign_keys = ON;");

const existingTables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const modules = [
  { id: "home", label: "Inicio", group: "Principal" },
  { id: "accounts", label: "Cuentas", group: "Ventas" },
  { id: "contacts", label: "Contactos", group: "Ventas" },
  { id: "opportunities", label: "Oportunidades", group: "Ventas" },
  { id: "leads", label: "Clientes Potenciales", group: "Marketing" },
  { id: "quotes", label: "Cotizaciones", group: "Ventas" },
  { id: "products", label: "Productos", group: "Ventas" },
  { id: "invoices", label: "Facturas", group: "Ventas" },
  { id: "documents", label: "Documentos", group: "Colaboracion" },
  { id: "emails", label: "Correos", group: "Colaboracion", genericModule: "Correos" },
  { id: "projects", label: "Proyectos", group: "Colaboracion" },
  { id: "campaigns", label: "Campanas", group: "Marketing", genericModule: "Campanas" },
  { id: "calls", label: "Llamadas", group: "Actividades", activityType: "Llamada" },
  { id: "meetings", label: "Reuniones", group: "Actividades", activityType: "Reunion" },
  { id: "tasks", label: "Tareas", group: "Actividades", activityType: "Tarea" },
  { id: "notes", label: "Notas", group: "Colaboracion" },
  { id: "cases", label: "Casos", group: "Soporte" },
  { id: "targets", label: "Publico Objetivo", group: "Marketing", genericModule: "Publico Objetivo" },
  { id: "target_lists", label: "Publico Objetivo - Listas", group: "Marketing", genericModule: "Publico Objetivo - Listas" },
  { id: "contracts", label: "Contratos", group: "Ventas", genericModule: "Contratos" },
  { id: "calendar", label: "Calendario", group: "Actividades", allActivities: true },
  { id: "accion", label: "Accion", group: "Personalizados", genericModule: "acciones" },
  { id: "diseno", label: "Diseno", group: "Personalizados", genericModule: "disenos" },
  { id: "plan_de_accion", label: "Plan_De_Accion", group: "Personalizados", genericModule: "planesAccion" },
  { id: "cartera", label: "Cartera", group: "Personalizados", genericModule: "cartera" },
  { id: "migration", label: "Migracion", group: "Sistema" }
];

const entityConfig = {
  accounts: { table: "accounts", searchable: ["name", "phone", "email", "city", "country", "industry", "status"], defaultOrder: "name COLLATE NOCASE ASC" },
  contacts: { table: "contacts", searchable: ["name", "phone", "email", "city", "country", "title"], defaultOrder: "name COLLATE NOCASE ASC" },
  opportunities: { table: "opportunities", searchable: ["name", "stage", "type"], defaultOrder: "updated_at DESC" },
  leads: { table: "leads", searchable: ["name", "account_name", "phone", "email", "city", "country", "status"], defaultOrder: "updated_at DESC" },
  quotes: { table: "quotes", searchable: ["name", "number", "stage", "approval_status", "invoice_status"], defaultOrder: "CAST(number AS INTEGER) DESC" },
  products: { table: "products", searchable: ["name", "part_number", "type"], defaultOrder: "name COLLATE NOCASE ASC" },
  invoices: { table: "invoices", searchable: ["name", "number", "status"], defaultOrder: "created_at DESC" },
  cases: { table: "cases", searchable: ["name", "number", "status", "priority", "type"], defaultOrder: "updated_at DESC" },
  documents: { table: "documents", searchable: ["name", "status", "category"], defaultOrder: "updated_at DESC" },
  notes: { table: "notes", searchable: ["title", "description"], defaultOrder: "updated_at DESC" },
  projects: { table: "projects", searchable: ["name", "status", "priority"], defaultOrder: "updated_at DESC" }
};

function createId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || "").split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const incoming = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === incoming.length && crypto.timingSafeEqual(expected, incoming);
}

function publicRow(row) {
  if (!row) return null;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "legacy_json") result.legacy = parseJson(value);
    else if (key.endsWith("_json")) result[key.replace(/_json$/, "").replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = parseJson(value, []);
    else result[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return result;
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params).map(publicRow);
}

function get(sql, params = []) {
  return publicRow(db.prepare(sql).get(...params));
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params.map((value) => (value === undefined ? null : value)));
}

function hasTable(table) {
  return existingTables.has(table);
}

function audit(req, action, entity, entityId, before, after) {
  run("INSERT INTO audit_log VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    createId(),
    req.user?.id || null,
    action,
    entity,
    entityId || null,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
    nowIso()
  ]);
}

function tokenFrom(req) {
  const header = req.get("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  return null;
}

function requireAuth(req, res, next) {
  const token = tokenFrom(req);
  if (!token) return res.status(401).json({ error: "Sesion requerida" });
  const session = get(
    `SELECT s.token, s.expires_at, u.id, u.username, u.display_name, u.role
     FROM sessions s JOIN auth_users u ON u.id = s.user_id
     WHERE s.token = ? AND u.active = 1`,
    [token]
  );
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    if (session) run("DELETE FROM sessions WHERE token = ?", [token]);
    return res.status(401).json({ error: "Sesion expirada" });
  }
  req.user = { id: session.id, username: session.username, displayName: session.displayName, role: session.role };
  req.token = token;
  next();
}

function paginate(req, baseSql, countSql, params, orderBy) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 40), 1), 200);
  const offset = (page - 1) * pageSize;
  const total = db.prepare(countSql).get(...params).total;
  const items = all(`${baseSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  return { page, pageSize, total, items };
}

function searchWhere(config, search) {
  if (!search) return { sql: "1=1", params: [] };
  const like = `%${search}%`;
  return {
    sql: `(${config.searchable.map((column) => `${column} LIKE ?`).join(" OR ")})`,
    params: config.searchable.map(() => like)
  };
}

function accountLinkSql(module, alias = "") {
  const idColumn = alias ? `${alias}.id` : "id";
  return {
    sql: `${idColumn} IN (
      SELECT target_id FROM entity_links
      WHERE source_module = 'accounts' AND source_id = ? AND target_module = ? AND deleted = 0
      UNION
      SELECT source_id FROM entity_links
      WHERE target_module = 'accounts' AND target_id = ? AND source_module = ? AND deleted = 0
    )`,
    params: (accountId) => [accountId, module, accountId, module]
  };
}

function accountLinkedRows(accountId, module, sql, extraParams = []) {
  const link = accountLinkSql(module);
  return all(sql.replace("{accountLink}", link.sql), [...extraParams, ...link.params(accountId)]);
}

function genericAccountRows(accountId, recordModule, linkModule, limit = 100) {
  const link = accountLinkSql(linkModule, "g");
  return all(
    `SELECT g.*, a.name AS account_name
     FROM generic_records g
     LEFT JOIN accounts a ON a.id = g.account_id
     WHERE g.module = ? AND (g.account_id = ? OR ${link.sql})
     ORDER BY COALESCE(g.start_date, g.end_date, g.name) DESC
     LIMIT ${limit}`,
    [recordModule, accountId, ...link.params(accountId)]
  );
}

function getEntityConfig(entity) {
  const module = modules.find((item) => item.id === entity);
  if (module?.allActivities) return { allActivities: true };
  if (module?.activityType) return { activityType: module.activityType };
  if (module?.genericModule) return { genericModule: module.genericModule };
  return entityConfig[entity];
}

function quoteTotals(lines, shipping = 0) {
  const subtotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || line.unit_price || 0), 0);
  const discount = lines.reduce((sum, line) => sum + Number(line.discountAmount || line.discount_amount || 0), 0);
  const tax = lines.reduce((sum, line) => sum + lineTax(line), 0);
  return { subtotal, discount, tax, shipping: Number(shipping || 0), total: subtotal - discount + tax + Number(shipping || 0) };
}

function percentValue(value) {
  const parsed = Number(String(value || "").replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineTax(line) {
  if (line.vatAmount !== undefined && line.vatAmount !== null && line.vatAmount !== "") return Number(line.vatAmount || 0);
  if (line.vat_amount !== undefined && line.vat_amount !== null && line.vat_amount !== "") return Number(line.vat_amount || 0);
  const base = Number(line.quantity || 0) * Number(line.unitPrice || line.unit_price || 0) - Number(line.discountAmount || line.discount_amount || 0);
  return base * (percentValue(line.vatRate || line.vat_rate) / 100);
}

function addressFromParts(parts) {
  return [parts.street, parts.city, parts.state, parts.postalCode, parts.country].filter(Boolean).join(", ");
}

app.get("/api/health", (req, res) => {
  const generatedAt = get("SELECT value FROM app_meta WHERE key = 'generated_at'")?.value;
  res.json({ ok: true, generatedAt, sqlite: path.relative(root, dbFile) });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare("SELECT * FROM auth_users WHERE username = ? AND active = 1").get(username || "");
  if (!user || !verifyPassword(password || "", user.password_hash)) return res.status(401).json({ error: "Usuario o contrasena invalida" });
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 10).toISOString();
  run("INSERT INTO sessions VALUES (?, ?, ?, ?)", [token, user.id, expiresAt, nowIso()]);
  res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role }, expiresAt });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  run("DELETE FROM sessions WHERE token = ?", [req.token]);
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.use("/api", requireAuth);

app.get("/api/modules", (req, res) => {
  res.json({ modules });
});

app.get("/api/summary", (req, res) => {
  const summary = parseJson(get("SELECT value FROM app_meta WHERE key = 'summary'")?.value, {});
  const topTables = all("SELECT table_name, rows_count AS rows FROM migration_tables ORDER BY rows_count DESC LIMIT 18").map((row) => ({ table: row.tableName, rows: row.rows }));
  res.json({ meta: { sourceFile: get("SELECT value FROM app_meta WHERE key = 'source_file'")?.value }, summary, topTables });
});

app.get("/api/recent-work", (req, res) => {
  const items = all(`
    SELECT * FROM (
      SELECT
        'Cotizacion' AS kind,
        'quotes' AS entity,
        q.id,
        q.name,
        a.name AS account_name,
        q.stage AS status,
        q.total AS amount,
        q.updated_at AS date_value,
        CASE WHEN q.number IS NOT NULL THEN '#' || q.number ELSE NULL END AS reference
      FROM quotes q
      LEFT JOIN accounts a ON a.id = q.account_id
      WHERE q.deleted = 0

      UNION ALL

      SELECT
        act.type AS kind,
        CASE act.type WHEN 'Llamada' THEN 'calls' WHEN 'Reunion' THEN 'meetings' WHEN 'Tarea' THEN 'tasks' ELSE 'calendar' END AS entity,
        act.id,
        act.title AS name,
        COALESCE(a.name, ca.name, csa.name) AS account_name,
        act.status,
        NULL AS amount,
        COALESCE(act.date_start, act.due_date) AS date_value,
        act.parent_type AS reference
      FROM activities act
      LEFT JOIN accounts a ON a.id = act.parent_id
      LEFT JOIN contacts c ON c.id = act.parent_id
      LEFT JOIN accounts ca ON ca.id = c.account_id
      LEFT JOIN cases cs ON cs.id = act.parent_id
      LEFT JOIN accounts csa ON csa.id = cs.account_id
      WHERE act.deleted = 0

      UNION ALL

      SELECT
        'Caso' AS kind,
        'cases' AS entity,
        cs.id,
        cs.name,
        a.name AS account_name,
        cs.status,
        NULL AS amount,
        cs.updated_at AS date_value,
        CASE WHEN cs.number IS NOT NULL THEN '#' || cs.number ELSE cs.priority END AS reference
      FROM cases cs
      LEFT JOIN accounts a ON a.id = cs.account_id
      WHERE cs.deleted = 0

      UNION ALL

      SELECT
        'Documento' AS kind,
        'documents' AS entity,
        d.id,
        d.name,
        a.name AS account_name,
        d.status,
        NULL AS amount,
        d.updated_at AS date_value,
        d.category AS reference
      FROM documents d
      LEFT JOIN entity_links el ON el.source_module = 'documents' AND el.source_id = d.id AND el.target_module = 'accounts' AND el.deleted = 0
      LEFT JOIN accounts a ON a.id = el.target_id
      WHERE d.deleted = 0

      UNION ALL

      SELECT
        CASE g.module
          WHEN 'disenos' THEN 'Diseno'
          WHEN 'cartera' THEN 'Cartera'
          WHEN 'acciones' THEN 'Accion'
          WHEN 'planesAccion' THEN 'Plan de accion'
          WHEN 'Correos' THEN 'Correo'
          ELSE g.module
        END AS kind,
        CASE g.module
          WHEN 'disenos' THEN 'diseno'
          WHEN 'acciones' THEN 'accion'
          WHEN 'planesAccion' THEN 'plan_de_accion'
          WHEN 'Correos' THEN 'emails'
          ELSE g.module
        END AS entity,
        g.id,
        g.name,
        a.name AS account_name,
        g.status,
        g.total AS amount,
        COALESCE(g.end_date, g.start_date) AS date_value,
        g.type AS reference
      FROM generic_records g
      LEFT JOIN accounts a ON a.id = g.account_id
      WHERE g.deleted = 0
    )
    WHERE date_value IS NOT NULL AND date_value <> ''
    ORDER BY date_value DESC
    LIMIT 32
  `);
  res.json({ items });
});

app.get("/api/directory", (req, res) => {
  res.json({
    industries: all("SELECT DISTINCT industry FROM accounts WHERE industry IS NOT NULL AND industry <> '' ORDER BY industry").map((row) => row.industry),
    statuses: all("SELECT DISTINCT status FROM accounts WHERE status IS NOT NULL AND status <> '' ORDER BY status").map((row) => row.status),
    users: all("SELECT id, user_name, full_name, status, title, department, email, phone FROM users ORDER BY full_name"),
    currencies: hasTable("currencies") ? all("SELECT id, name, symbol, iso4217, conversion_rate, status FROM currencies WHERE deleted = 0 ORDER BY name") : [],
    quoteTemplates: hasTable("quote_templates") ? all("SELECT id, name, type, active FROM quote_templates WHERE deleted = 0 AND active = 1 ORDER BY name") : []
  });
});

app.get("/api/accounts", (req, res) => {
  const config = entityConfig.accounts;
  const search = searchWhere(config, req.query.search || "");
  const filters = [...search.params];
  let where = search.sql;
  for (const [column, value] of [
    ["industry", req.query.industry],
    ["status", req.query.status],
    ["assigned_user_id", req.query.owner]
  ]) {
    if (value) {
      where += ` AND ${column} = ?`;
      filters.push(value);
    }
  }
  res.json(paginate(req, `SELECT * FROM accounts WHERE ${where}`, `SELECT COUNT(*) AS total FROM accounts WHERE ${where}`, filters, config.defaultOrder));
});

app.get("/api/accounts/:id", (req, res) => {
  const account = get("SELECT * FROM accounts WHERE id = ?", [req.params.id]);
  if (!account) return res.status(404).json({ error: "Cuenta no encontrada" });
  const accountId = req.params.id;
  const needle = `%${req.params.id}%`;
  const contactLink = accountLinkSql("contacts", "c");
  const opportunityLink = accountLinkSql("opportunities", "o");
  const quoteLink = accountLinkSql("quotes", "q");
  const invoiceLink = accountLinkSql("invoices", "i");
  const caseLink = accountLinkSql("cases", "cs");
  const projectLink = accountLinkSql("projects", "p");
  res.json({
    account,
    related: {
      contacts: all(`SELECT DISTINCT c.* FROM contacts c WHERE c.account_id = ? OR c.account_ids_json LIKE ? OR ${contactLink.sql} ORDER BY c.name LIMIT 100`, [accountId, needle, ...contactLink.params(accountId)]),
      opportunities: all(`SELECT DISTINCT o.* FROM opportunities o WHERE o.account_ids_json LIKE ? OR ${opportunityLink.sql} ORDER BY o.updated_at DESC LIMIT 100`, [needle, ...opportunityLink.params(accountId)]),
      activities: all(
        `SELECT DISTINCT act.*
         FROM activities act
         WHERE act.parent_id = ?
            OR act.id IN (
              SELECT el.source_id
              FROM entity_links el
              WHERE el.deleted = 0
                AND el.source_module IN ('calls', 'meetings', 'tasks')
                AND (
                  (el.target_module = 'accounts' AND el.target_id = ?)
                  OR (el.target_module = 'contacts' AND el.target_id IN (
                    SELECT c.id FROM contacts c WHERE c.account_id = ? OR c.account_ids_json LIKE ? OR ${contactLink.sql}
                  ))
                )
            )
         ORDER BY COALESCE(act.date_start, act.due_date) DESC
         LIMIT 100`,
        [accountId, accountId, accountId, needle, ...contactLink.params(accountId)]
      ),
      notes: all(
        `SELECT DISTINCT n.*
         FROM notes n
         WHERE n.parent_id = ?
            OR n.contact_id IN (SELECT c.id FROM contacts c WHERE c.account_id = ? OR c.account_ids_json LIKE ? OR ${contactLink.sql})
         ORDER BY n.updated_at DESC
         LIMIT 100`,
        [accountId, accountId, needle, ...contactLink.params(accountId)]
      ),
      quotes: all(`SELECT DISTINCT q.* FROM quotes q WHERE q.account_id = ? OR ${quoteLink.sql} ORDER BY CAST(q.number AS INTEGER) DESC LIMIT 100`, [accountId, ...quoteLink.params(accountId)]),
      invoices: all(`SELECT DISTINCT i.* FROM invoices i WHERE i.account_id = ? OR ${invoiceLink.sql} ORDER BY i.created_at DESC LIMIT 100`, [accountId, ...invoiceLink.params(accountId)]),
      cases: all(`SELECT DISTINCT cs.* FROM cases cs WHERE cs.account_id = ? OR ${caseLink.sql} ORDER BY cs.updated_at DESC LIMIT 100`, [accountId, ...caseLink.params(accountId)]),
      documents: all(
        `SELECT DISTINCT d.*
         FROM documents d
         WHERE d.legacy_json LIKE ?
            OR d.id IN (
              SELECT el.source_id
              FROM entity_links el
              WHERE el.source_module = 'documents'
                AND el.deleted = 0
                AND (
                  (el.target_module = 'accounts' AND el.target_id = ?)
                  OR (el.target_module = 'cases' AND el.target_id IN (SELECT id FROM cases WHERE account_id = ?))
                  OR (el.target_module = 'contacts' AND el.target_id IN (SELECT c.id FROM contacts c WHERE c.account_id = ? OR c.account_ids_json LIKE ? OR ${contactLink.sql}))
                  OR (el.target_module = 'opportunities' AND el.target_id IN (SELECT o.id FROM opportunities o WHERE o.account_ids_json LIKE ? OR ${opportunityLink.sql}))
                )
            )
         ORDER BY d.updated_at DESC
         LIMIT 100`,
        [needle, accountId, accountId, accountId, needle, ...contactLink.params(accountId), needle, ...opportunityLink.params(accountId)]
      ),
      projects: all(`SELECT DISTINCT p.* FROM projects p WHERE ${projectLink.sql} ORDER BY p.updated_at DESC LIMIT 100`, projectLink.params(accountId)),
      emails: genericAccountRows(accountId, "Correos", "emails"),
      contracts: genericAccountRows(accountId, "Contratos", "contracts"),
      disenos: genericAccountRows(accountId, "disenos", "disenos"),
      cartera: genericAccountRows(accountId, "cartera", "cartera"),
      acciones: genericAccountRows(accountId, "acciones", "acciones"),
      planesAccion: genericAccountRows(accountId, "planesAccion", "planesAccion")
    }
  });
});

app.post("/api/accounts", (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: "El nombre del cliente es obligatorio" });
  const id = createId();
  const record = {
    id,
    name: body.name,
    type: body.type || "Customer",
    industry: body.industry || null,
    status: body.status || "Activo",
    assignedUserId: body.assignedUserId || req.user.id,
    assignedUser: body.assignedUser || req.user.displayName,
    phone: body.phone || null,
    website: body.website || null,
    email: body.email || null,
    city: body.city || null,
    state: body.state || null,
    country: body.country || "Colombia",
    address: body.address || null,
    description: body.description || null,
    deleted: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    localUpdatedAt: nowIso(),
    legacy: { source: "biocrm" }
  };
  run("INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [record.id, record.name, record.type, record.industry, record.status, record.assignedUserId, record.assignedUser, record.phone, record.website, record.email, record.city, record.state, record.country, record.address, record.description, 0, record.createdAt, record.updatedAt, record.localUpdatedAt, JSON.stringify(record.legacy)]);
  audit(req, "create", "accounts", id, null, record);
  res.status(201).json(record);
});

app.patch("/api/accounts/:id", (req, res) => {
  const before = get("SELECT * FROM accounts WHERE id = ?", [req.params.id]);
  if (!before) return res.status(404).json({ error: "Cuenta no encontrada" });
  const allowed = ["name", "type", "industry", "status", "phone", "website", "email", "city", "state", "country", "address", "description"];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(patch).length) return res.json(before);
  const assignments = Object.keys(patch).map((key) => `${key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)} = ?`).join(", ");
  run(`UPDATE accounts SET ${assignments}, updated_at = ?, local_updated_at = ? WHERE id = ?`, [...Object.values(patch), nowIso(), nowIso(), req.params.id]);
  const after = get("SELECT * FROM accounts WHERE id = ?", [req.params.id]);
  audit(req, "update", "accounts", req.params.id, before, after);
  res.json(after);
});

app.get("/api/entities/:entity", (req, res) => {
  const config = getEntityConfig(req.params.entity);
  if (!config) return res.status(404).json({ error: "Entidad no disponible" });
  if (config.activityType) {
    const joins = "LEFT JOIN accounts a ON a.id = act.parent_id LEFT JOIN contacts c ON c.id = act.parent_id LEFT JOIN cases cs ON cs.id = act.parent_id LEFT JOIN opportunities o ON o.id = act.parent_id LEFT JOIN leads l ON l.id = act.parent_id";
    const parentName = "COALESCE(a.name, c.name, cs.name, o.name, l.name) AS parent_name";
    const search = req.query.search ? "AND (act.title LIKE ? OR act.status LIKE ? OR act.description LIKE ? OR a.name LIKE ? OR c.name LIKE ? OR cs.name LIKE ? OR o.name LIKE ? OR l.name LIKE ?)" : "";
    const params = [config.activityType, ...(req.query.search ? Array(8).fill(`%${req.query.search}%`) : [])];
    return res.json(paginate(req, `SELECT act.*, ${parentName} FROM activities act ${joins} WHERE act.type = ? ${search}`, `SELECT COUNT(*) AS total FROM activities act ${joins} WHERE act.type = ? ${search}`, params, "COALESCE(date_start, due_date) DESC"));
  }
  if (config.allActivities) {
    const joins = "LEFT JOIN accounts a ON a.id = act.parent_id LEFT JOIN contacts c ON c.id = act.parent_id LEFT JOIN cases cs ON cs.id = act.parent_id LEFT JOIN opportunities o ON o.id = act.parent_id LEFT JOIN leads l ON l.id = act.parent_id";
    const parentName = "COALESCE(a.name, c.name, cs.name, o.name, l.name) AS parent_name";
    const search = req.query.search ? "WHERE (act.title LIKE ? OR act.status LIKE ? OR act.description LIKE ? OR a.name LIKE ? OR c.name LIKE ? OR cs.name LIKE ? OR o.name LIKE ? OR l.name LIKE ?)" : "";
    const params = req.query.search ? Array(8).fill(`%${req.query.search}%`) : [];
    return res.json(paginate(req, `SELECT act.*, ${parentName} FROM activities act ${joins} ${search}`, `SELECT COUNT(*) AS total FROM activities act ${joins} ${search}`, params, "COALESCE(date_start, due_date) DESC"));
  }
  if (req.params.entity === "contacts") {
    const accountNameSql = "(SELECT a.name FROM accounts a WHERE a.id = c.account_id OR c.account_ids_json LIKE '%' || a.id || '%' LIMIT 1)";
    const search = req.query.search ? `WHERE (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.title LIKE ? OR EXISTS (SELECT 1 FROM accounts ax WHERE (ax.id = c.account_id OR c.account_ids_json LIKE '%' || ax.id || '%') AND ax.name LIKE ?))` : "";
    const params = req.query.search ? Array(5).fill(`%${req.query.search}%`) : [];
    return res.json(paginate(req, `SELECT c.*, ${accountNameSql} AS account_name FROM contacts c ${search}`, `SELECT COUNT(*) AS total FROM contacts c ${search}`, params, "c.name COLLATE NOCASE ASC"));
  }
  if (req.params.entity === "opportunities") {
    const search = req.query.search ? "WHERE (o.name LIKE ? OR o.stage LIKE ? OR o.type LIKE ? OR EXISTS (SELECT 1 FROM accounts ax WHERE o.account_ids_json LIKE '%' || ax.id || '%' AND ax.name LIKE ?))" : "";
    const params = req.query.search ? Array(4).fill(`%${req.query.search}%`) : [];
    return res.json(paginate(req, `SELECT o.*, (SELECT name FROM accounts ax WHERE o.account_ids_json LIKE '%' || ax.id || '%' LIMIT 1) AS account_name FROM opportunities o ${search}`, `SELECT COUNT(*) AS total FROM opportunities o ${search}`, params, "o.updated_at DESC"));
  }
  if (["invoices", "cases"].includes(req.params.entity)) {
    const table = config.table;
    const search = req.query.search ? `WHERE (e.name LIKE ? OR e.status LIKE ? OR a.name LIKE ?${req.params.entity === "cases" ? " OR e.priority LIKE ?" : ""})` : "";
    const params = req.query.search ? Array(req.params.entity === "cases" ? 4 : 3).fill(`%${req.query.search}%`) : [];
    return res.json(paginate(req, `SELECT e.*, a.name AS account_name FROM ${table} e LEFT JOIN accounts a ON a.id = e.account_id ${search}`, `SELECT COUNT(*) AS total FROM ${table} e LEFT JOIN accounts a ON a.id = e.account_id ${search}`, params, config.defaultOrder.replace("updated_at", "e.updated_at").replace("created_at", "e.created_at")));
  }
  if (req.params.entity === "notes") {
    const search = req.query.search ? "WHERE (n.title LIKE ? OR n.description LIKE ? OR a.name LIKE ?)" : "";
    const params = req.query.search ? Array(3).fill(`%${req.query.search}%`) : [];
    return res.json(paginate(req, `SELECT n.*, a.name AS parent_name FROM notes n LEFT JOIN accounts a ON a.id = n.parent_id ${search}`, `SELECT COUNT(*) AS total FROM notes n LEFT JOIN accounts a ON a.id = n.parent_id ${search}`, params, "n.updated_at DESC"));
  }
  if (config.genericModule) {
    const search = req.query.search ? "AND (g.name LIKE ? OR g.status LIKE ? OR g.type LIKE ? OR a.name LIKE ?)" : "";
    const params = [config.genericModule, ...(req.query.search ? [`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`] : [])];
    return res.json(paginate(req, `SELECT g.*, a.name AS account_name FROM generic_records g LEFT JOIN accounts a ON a.id = g.account_id WHERE g.module = ? ${search}`, `SELECT COUNT(*) AS total FROM generic_records g LEFT JOIN accounts a ON a.id = g.account_id WHERE g.module = ? ${search}`, params, "g.name COLLATE NOCASE ASC"));
  }
  if (req.params.entity === "quotes") {
    const search = req.query.search
      ? "WHERE (q.name LIKE ? OR q.number LIKE ? OR q.stage LIKE ? OR q.approval_status LIKE ? OR q.invoice_status LIKE ? OR a.name LIKE ?)"
      : "";
    const params = req.query.search ? Array(6).fill(`%${req.query.search}%`) : [];
    return res.json(paginate(
      req,
      `SELECT q.*, a.name AS account_name FROM quotes q LEFT JOIN accounts a ON a.id = q.account_id ${search}`,
      `SELECT COUNT(*) AS total FROM quotes q LEFT JOIN accounts a ON a.id = q.account_id ${search}`,
      params,
      "CAST(q.number AS INTEGER) DESC"
    ));
  }
  const search = searchWhere(config, req.query.search || "");
  res.json(paginate(req, `SELECT * FROM ${config.table} WHERE ${search.sql}`, `SELECT COUNT(*) AS total FROM ${config.table} WHERE ${search.sql}`, search.params, config.defaultOrder));
});

app.post("/api/entities/:entity", (req, res) => {
  const config = getEntityConfig(req.params.entity);
  const body = req.body || {};
  if (!config) return res.status(404).json({ error: "Entidad no disponible" });
  if (req.params.entity === "quotes") return createQuote(req, res);
  if (!body.name && !body.title) return res.status(400).json({ error: "Nombre obligatorio" });
  const id = createId();
  const createdAt = nowIso();
  if (config.activityType) {
    run("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, config.activityType, body.title || body.name, body.status || "Planificada", body.priority || "Media", body.dateStart || createdAt, body.dueDate || null, body.durationMinutes || 0, body.parentType || "Accounts", body.parentId || body.accountId || null, body.contactId || null, "[]", JSON.stringify([req.user.id]), body.description || null, 0, JSON.stringify({ source: "biocrm" })]);
    const after = get("SELECT * FROM activities WHERE id = ?", [id]);
    audit(req, "create", "activities", id, null, after);
    return res.status(201).json(after);
  }
  if (config.genericModule) {
    run("INSERT INTO generic_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, config.genericModule, body.name, body.accountId || null, body.status || null, body.type || null, body.startDate || null, body.endDate || null, body.total || 0, 0, JSON.stringify({ source: "biocrm" })]);
    const after = get("SELECT * FROM generic_records WHERE id = ?", [id]);
    audit(req, "create", "generic_records", id, null, after);
    return res.status(201).json(after);
  }
  if (req.params.entity === "contacts") {
    run("INSERT INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, body.name, body.title || null, body.department || null, body.accountId || null, JSON.stringify([body.accountId].filter(Boolean)), body.phone || null, body.email || null, body.city || null, body.state || null, body.country || null, body.address || null, req.user.id, 0, createdAt, createdAt, JSON.stringify({ source: "biocrm" })]);
  } else if (req.params.entity === "products") {
    run("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, body.name, body.partNumber || null, body.type || null, body.categoryId || null, body.price || 0, body.cost || 0, 0, createdAt, createdAt, JSON.stringify({ source: "biocrm" })]);
  } else if (req.params.entity === "cases") {
    run("INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, body.number || null, body.name, body.accountId || null, body.status || "Nuevo", body.priority || "Media", body.type || null, body.description || null, 0, createdAt, createdAt, JSON.stringify({ source: "biocrm" })]);
  } else if (req.params.entity === "opportunities") {
    run("INSERT INTO opportunities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, body.name, body.stage || "Prospeccion", body.type || null, Number(body.amount || 0), Number(body.probability || 0), body.closeDate || null, req.user.id, JSON.stringify([body.accountId].filter(Boolean)), JSON.stringify([body.contactId].filter(Boolean)), 0, createdAt, createdAt, JSON.stringify({ source: "biocrm" })]);
  } else if (req.params.entity === "leads") {
    run("INSERT INTO leads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, body.name, body.accountName || null, body.status || "Nuevo", body.source || null, body.phone || null, body.email || null, body.city || null, body.country || null, 0, createdAt, createdAt, JSON.stringify({ source: "biocrm" })]);
  } else if (req.params.entity === "notes") {
    run("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, body.title || body.name, body.parentType || "Accounts", body.parentId || body.accountId || null, body.contactId || null, body.description || null, body.fileName || null, req.user.id, 0, createdAt, createdAt, JSON.stringify({ source: "biocrm" })]);
  } else {
    return res.status(400).json({ error: "Creacion no implementada para este modulo" });
  }
  const after = get(`SELECT * FROM ${config.table} WHERE id = ?`, [id]);
  audit(req, "create", req.params.entity, id, null, after);
  res.status(201).json(after);
});

function quoteDetail(id) {
  const quote = get(
    `SELECT q.*, a.name AS account_name, c.name AS contact_name, o.name AS opportunity_name, u.full_name AS assigned_user_name
     FROM quotes q
     LEFT JOIN accounts a ON a.id = q.account_id
     LEFT JOIN contacts c ON c.id = q.contact_id
     LEFT JOIN opportunities o ON o.id = q.opportunity_id
     LEFT JOIN users u ON u.id = q.assigned_user_id
     WHERE q.id = ?`,
    [id]
  );
  if (!quote) return null;
  const groups = all("SELECT * FROM quote_groups WHERE quote_id = ? ORDER BY number, name", [id]);
  const lines = all(
    `SELECT l.*, p.name AS catalog_product_name, p.part_number AS catalog_part_number, p.type AS catalog_product_type, p.legacy_json AS product_legacy_json
     FROM quote_lines l
     LEFT JOIN products p ON p.id = l.product_id
     WHERE l.quote_id = ?
     ORDER BY l.group_id, l.number, l.name`,
    [id]
  );
  return { quote, groups, lines };
}

function accountQuoteDefaults(accountId) {
  const account = get("SELECT * FROM accounts WHERE id = ?", [accountId]);
  if (!account) return null;
  const legacy = account.legacy || {};
  const billing = {
    street: legacy.billing_address_street || account.address,
    city: legacy.billing_address_city || account.city,
    state: legacy.billing_address_state || account.state,
    postalCode: legacy.billing_address_postalcode || null,
    country: legacy.billing_address_country || account.country
  };
  const shipping = {
    street: legacy.shipping_address_street || legacy.billing_address_street || account.address,
    city: legacy.shipping_address_city || legacy.billing_address_city || account.city,
    state: legacy.shipping_address_state || legacy.billing_address_state || account.state,
    postalCode: legacy.shipping_address_postalcode || legacy.billing_address_postalcode || null,
    country: legacy.shipping_address_country || legacy.billing_address_country || account.country
  };
  const lastQuote = get("SELECT * FROM quotes WHERE account_id = ? ORDER BY updated_at DESC LIMIT 1", [accountId]);
  return {
    account,
    billing,
    shipping,
    lastQuote,
    contacts: all("SELECT id, name, title, phone, email FROM contacts WHERE account_id = ? OR account_ids_json LIKE ? ORDER BY name LIMIT 200", [accountId, `%${accountId}%`]),
    opportunities: all("SELECT id, name, stage, amount, close_date FROM opportunities WHERE account_ids_json LIKE ? ORDER BY updated_at DESC LIMIT 200", [`%${accountId}%`])
  };
}

app.get("/api/quote-context", (req, res) => {
  const accountContext = req.query.accountId ? accountQuoteDefaults(req.query.accountId) : null;
  const nextNumber = (db.prepare("SELECT MAX(CAST(number AS INTEGER)) AS max_number FROM quotes").get().max_number || 0) + 1;
  const template = hasTable("quote_templates") ? get("SELECT id, name FROM quote_templates WHERE deleted = 0 AND active = 1 ORDER BY name LIMIT 1") : null;
  const currency = hasTable("currencies")
    ? get("SELECT id, name, symbol, iso4217 FROM currencies WHERE id = '-99'") || get("SELECT id, name, symbol, iso4217 FROM currencies WHERE deleted = 0 ORDER BY name LIMIT 1")
    : null;
  res.json({
    nextNumber,
    accountContext,
    users: all("SELECT id, full_name, email, phone FROM users ORDER BY full_name"),
    currencies: hasTable("currencies") ? all("SELECT id, name, symbol, iso4217 FROM currencies WHERE deleted = 0 ORDER BY name") : [],
    templates: hasTable("quote_templates") ? all("SELECT id, name, type FROM quote_templates WHERE deleted = 0 AND active = 1 ORDER BY name") : [],
    products: all("SELECT id, name, part_number, type, price, cost, legacy_json FROM products WHERE deleted = 0 ORDER BY name COLLATE NOCASE LIMIT 500"),
    defaults: {
      stage: "Draft",
      approvalStatus: "Approved",
      invoiceStatus: "Not Invoiced",
      originCountry: accountContext?.lastQuote?.originCountry || accountContext?.account?.country || "COLOMBIA",
      assignedUserId: accountContext?.lastQuote?.assignedUserId || req.user.id,
      currencyId: accountContext?.lastQuote?.currencyId || currency?.id || "-99",
      templateIds: accountContext?.lastQuote?.templateIds?.length ? accountContext.lastQuote.templateIds : [template?.id].filter(Boolean),
      paymentMethod: accountContext?.lastQuote?.paymentMethod || "",
      deliveryTime: accountContext?.lastQuote?.deliveryTime || "",
      observations: accountContext?.lastQuote?.observations || ""
    }
  });
});

app.get("/api/quotes/:id", (req, res) => {
  const detail = quoteDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: "Cotizacion no encontrada" });
  res.json(detail);
});

function createQuote(req, res) {
  const body = req.body || {};
  if (!body.accountId) return res.status(400).json({ error: "Cliente obligatorio para cotizar" });
  if (!Array.isArray(body.lines) || body.lines.length === 0) return res.status(400).json({ error: "La cotizacion necesita al menos una linea" });
  const id = createId();
  const nextNumber = body.number || (db.prepare("SELECT MAX(CAST(number AS INTEGER)) AS max_number FROM quotes").get().max_number || 0) + 1;
  const currency = (hasTable("currencies") ? get("SELECT id, name, symbol, iso4217 FROM currencies WHERE id = ?", [body.currencyId || "-99"]) : null) || { id: body.currencyId || "-99", name: "US Dollars", symbol: "$", iso4217: "USD" };
  const templateIds = Array.isArray(body.templateIds) ? body.templateIds.filter(Boolean) : [body.templateId].filter(Boolean);
  const templateNames = templateIds.map((templateId) => (hasTable("quote_templates") ? get("SELECT name FROM quote_templates WHERE id = ?", [templateId])?.name : null) || templateId);
  const billing = body.billing || {};
  const shipping = body.shipping || {};
  const billingAddress = body.billingAddress || addressFromParts(billing);
  const shippingAddress = body.shippingAddress || addressFromParts(shipping);
  const totals = quoteTotals(body.lines, body.shippingAmount || 0);
  const createdAt = nowIso();
  db.exec("BEGIN");
  try {
    run("INSERT INTO quotes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      id,
      String(nextNumber),
      body.name || `Cotizacion ${nextNumber}`,
      body.accountId,
      body.contactId || null,
      body.opportunityId || null,
      body.stage || "Draft",
      body.approvalStatus || "Approved",
      body.approvalIssue || null,
      body.invoiceStatus || "Not Invoiced",
      body.term || null,
      body.terms || null,
      body.paymentMethod || null,
      body.deliveryTime || null,
      body.observations || null,
      body.originCountry || null,
      JSON.stringify(templateIds),
      JSON.stringify(templateNames),
      totals.subtotal,
      totals.discount,
      totals.tax,
      totals.shipping,
      Number(body.shippingTax || 0),
      totals.total,
      currency.id,
      currency.name,
      currency.symbol,
      currency.iso4217,
      body.expiration || null,
      billingAddress || null,
      shippingAddress || null,
      billing.street || null,
      billing.city || null,
      billing.state || null,
      billing.postalCode || null,
      billing.country || null,
      shipping.street || null,
      shipping.city || null,
      shipping.state || null,
      shipping.postalCode || null,
      shipping.country || null,
      body.description || null,
      body.assignedUserId || req.user.id,
      body.assignedUser || req.user.displayName,
      0,
      createdAt,
      createdAt,
      JSON.stringify({ source: "biocrm", templateIds, templateNames })
    ]);
    const groupId = createId();
    run("INSERT INTO quote_groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [groupId, id, 1, body.groupName || "Grupo principal", totals.subtotal, totals.discount, totals.tax, totals.total, currency.id, 0, JSON.stringify({ source: "biocrm" })]);
    const stmt = db.prepare("INSERT INTO quote_lines VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    body.lines.forEach((line, index) => {
      const quantity = Number(line.quantity || 1);
      const unitPrice = Number(line.unitPrice || 0);
      const discountAmount = Number(line.discountAmount || 0);
      const vatAmount = lineTax(line);
      const total = quantity * unitPrice - discountAmount + vatAmount;
      const lineId = createId();
      stmt.run(lineId, id, groupId, line.productId || null, index + 1, line.name || "Producto", line.partNumber || null, line.description || null, quantity, Number(line.costPrice || 0), Number(line.listPrice || unitPrice), unitPrice, Number(line.discount || 0), discountAmount, line.discountType || "Amount", line.vatRate || null, vatAmount, total, currency.id, 0, JSON.stringify({ source: "biocrm" }));
      if (line.productId) {
        run("INSERT INTO entity_links VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [createId(), "quote_lines", lineId, "products", line.productId, "product", "biocrm_quote_lines", createdAt, 0, JSON.stringify({ source: "biocrm" })]);
      }
    });
    for (const [targetModule, targetId, relationship] of [
      ["accounts", body.accountId, "account"],
      ["contacts", body.contactId, "contact"],
      ["opportunities", body.opportunityId, "opportunity"]
    ]) {
      if (targetId) run("INSERT INTO entity_links VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [createId(), "quotes", id, targetModule, targetId, relationship, "biocrm_quotes", createdAt, 0, JSON.stringify({ source: "biocrm" })]);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const after = quoteDetail(id);
  audit(req, "create", "quotes", id, null, after);
  res.status(201).json(after);
}

app.get("/api/migration", (req, res) => {
  res.json({
    topTables: all("SELECT table_name, rows_count AS rows FROM migration_tables ORDER BY rows_count DESC LIMIT 30").map((row) => ({ table: row.tableName, rows: row.rows })),
    selectedTableCounts: Object.fromEntries(db.prepare("SELECT table_name, rows_count FROM migration_tables ORDER BY table_name").all().map((row) => [row.table_name, row.rows_count]))
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta API no encontrada" });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith("/api")) {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
  next(err);
});

const indexFile = path.join(distDir, "index.html");

if (fs.existsSync(indexFile)) {
  app.use(express.static(distDir, { index: false }));
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.sendFile(indexFile);
  });
} else {
  app.get("/", (req, res) => {
    res
      .status(503)
      .send("BIOCRM API activa. Ejecuta npm run build para publicar el frontend en dist/.");
  });
}

app.listen(port, host, () => {
  console.log(`BIOCRM API y web en http://${host}:${port}`);
  if (!fs.existsSync(indexFile)) {
    console.log("Frontend dist/ no encontrado; usa Vite en desarrollo o ejecuta npm run build.");
  }
});
