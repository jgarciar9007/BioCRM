import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const sourceFile = path.join(root, "respaldo_suitecrm.sql");
const dataDir = path.join(root, "data");
const outputFile = path.join(dataDir, "biocrm-data.json");
const reportFile = path.join(dataDir, "migration-report.json");
const sqliteFile = path.join(dataDir, "biocrm.sqlite");

const selectedTables = new Set([
  "accounts",
  "accounts_cstm",
  "accounts_contacts",
  "contacts",
  "contacts_cstm",
  "contacts_accounts_1_c",
  "users",
  "users_cstm",
  "opportunities",
  "opportunities_cstm",
  "accounts_opportunities",
  "opportunities_contacts",
  "leads",
  "leads_cstm",
  "calls",
  "calls_contacts",
  "calls_users",
  "meetings",
  "meetings_cstm",
  "meetings_contacts",
  "meetings_leads",
  "meetings_users",
  "tasks",
  "tasks_cstm",
  "notes",
  "emails",
  "emails_cstm",
  "emails_text",
  "emails_beans",
  "emails_email_addr_rel",
  "email_addresses",
  "email_addr_bean_rel",
  "cases",
  "cases_cstm",
  "documents",
  "documents_cstm",
  "documents_accounts",
  "documents_cases",
  "documents_contacts",
  "documents_opportunities",
  "aos_quotes",
  "aos_quotes_cstm",
  "aos_contracts",
  "aos_contracts_cstm",
  "aos_invoices",
  "aos_quotes_aos_invoices_c",
  "aos_products",
  "aos_products_cstm",
  "aos_products_quotes",
  "aos_line_item_groups",
  "aos_pdf_templates",
  "currencies",
  "campaigns",
  "campaigns_cstm",
  "project",
  "project_cstm",
  "project_task",
  "projects_accounts",
  "projects_contacts",
  "projects_opportunities",
  "prospects",
  "prospect_lists",
  "prospect_lists_prospects",
  "sie_cartera",
  "sie_cartera_cstm",
  "sie_cartera_accounts_c",
  "sie_diseno",
  "sie_diseno_cstm",
  "sie_diseno_accounts_c",
  "sie_accion",
  "sie_accion_cstm",
  "sie_accion_cases_c",
  "sie_plan_de_accion",
  "sie_plan_de_accion_cstm",
  "sie_plan_de_accion_sie_accion_1_c",
  "sie_plan_de_accion_sie_accion_c"
]);

const text = fs.readFileSync(sourceFile, "utf8");
fs.mkdirSync(dataDir, { recursive: true });

function extractColumns(sql) {
  const columns = {};
  const tableRegex = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\)\s+ENGINE=/g;
  let match;
  while ((match = tableRegex.exec(sql))) {
    const table = match[1];
    columns[table] = [];
    for (const line of match[2].split(/\r?\n/)) {
      const col = line.match(/^\s*`([^`]+)`/);
      if (col) columns[table].push(col[1]);
    }
  }
  return columns;
}

function parseScalar(raw) {
  const value = raw.trim();
  if (!value || value.toUpperCase() === "NULL") return null;
  return value;
}

function parseTuples(valuesSql) {
  const tuples = [];
  let tuple = null;
  let value = "";
  let inString = false;
  let escaping = false;

  const pushValue = () => {
    tuple.push(parseScalar(value));
    value = "";
  };

  for (let i = 0; i < valuesSql.length; i += 1) {
    const ch = valuesSql[i];
    if (inString) {
      if (escaping) {
        const map = { n: "\n", r: "\r", t: "\t", 0: "\0", b: "\b", Z: "\u001a" };
        value += Object.prototype.hasOwnProperty.call(map, ch) ? map[ch] : ch;
        escaping = false;
      } else if (ch === "\\") {
        escaping = true;
      } else if (ch === "'") {
        inString = false;
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === "'") {
      inString = true;
      continue;
    }
    if (ch === "(" && tuple === null) {
      tuple = [];
      value = "";
      continue;
    }
    if (!tuple) continue;
    if (ch === ",") {
      pushValue();
      continue;
    }
    if (ch === ")") {
      pushValue();
      tuples.push(tuple);
      tuple = null;
      value = "";
      continue;
    }
    value += ch;
  }
  return tuples;
}

function countTuples(valuesSql) {
  let count = 0;
  let inString = false;
  let escaping = false;
  for (let i = 0; i < valuesSql.length; i += 1) {
    const ch = valuesSql[i];
    if (inString) {
      if (escaping) escaping = false;
      else if (ch === "\\") escaping = true;
      else if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") inString = true;
    else if (ch === "(") count += 1;
  }
  return count;
}

function compact(row) {
  const cleaned = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (value !== null && value !== "" && value !== "http://") cleaned[key] = value;
  }
  return cleaned;
}

function mergeCustom(baseRows, customRows) {
  const customById = new Map(customRows.map((row) => [row.id_c, row]));
  return baseRows.map((row) => ({
    ...row,
    custom: compact(customById.get(row.id) || {})
  }));
}

function rowsToObjects(table, tuples, columns) {
  const tableColumns = columns[table] || [];
  return tuples.map((tuple) => Object.fromEntries(tableColumns.map((col, index) => [col, tuple[index] ?? null])));
}

function normalizeName(...parts) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function notDeleted(row) {
  return String(row.deleted ?? "0") !== "1";
}

function value(row, ...keys) {
  for (const key of keys) {
    if (row?.[key] !== null && row?.[key] !== undefined && row?.[key] !== "") return row[key];
  }
  return null;
}

function relationIds(rows, leftKeys, rightKeys, options = {}) {
  const map = new Map();
  const sourceRows = options.includeDeleted ? rows : rows.filter(notDeleted);
  for (const row of sourceRows) {
    const left = value(row, ...leftKeys);
    const right = value(row, ...rightKeys);
    if (!left || !right) continue;
    if (!map.has(left)) map.set(left, new Set());
    map.get(left).add(right);
  }
  return map;
}

function setToArray(map, key) {
  return Array.from(map.get(key) || []);
}

function asNumber(input) {
  const number = Number(input || 0);
  return Number.isFinite(number) ? number : 0;
}

function asMoney(input) {
  if (input === null || input === undefined || input === "") return 0;
  const normalized = String(input).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  return asNumber(normalized);
}

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function parseMultiEnum(value) {
  return String(value || "")
    .split("^")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinAddress(...parts) {
  return parts.filter(Boolean).join(", ");
}

const columns = extractColumns(text);
const imported = {};
const rowCounts = {};
const insertRegex = /INSERT INTO `([^`]+)` VALUES ([\s\S]*?);(?:\r?\n|$)/g;
let insertMatch;

while ((insertMatch = insertRegex.exec(text))) {
  const table = insertMatch[1];
  const valuesSql = insertMatch[2];
  const count = countTuples(valuesSql);
  rowCounts[table] = (rowCounts[table] || 0) + count;
  if (selectedTables.has(table)) {
    const tuples = parseTuples(valuesSql);
    imported[table] = (imported[table] || []).concat(rowsToObjects(table, tuples, columns));
  }
}

for (const table of selectedTables) {
  imported[table] ||= [];
}

const emailAddressById = new Map(
  imported.email_addresses
    .filter(notDeleted)
    .map((row) => [row.id, row.email_address])
    .filter(([, email]) => email)
);

const beanEmails = new Map();
for (const row of imported.email_addr_bean_rel.filter(notDeleted)) {
  const email = emailAddressById.get(row.email_address_id);
  if (!email || !row.bean_module || !row.bean_id) continue;
  const key = `${row.bean_module}:${row.bean_id}`;
  if (!beanEmails.has(key)) beanEmails.set(key, []);
  beanEmails.get(key).push({ email, primary: row.primary_address === "1" });
}

function primaryEmail(module, id, fallback = null) {
  if (fallback) return fallback;
  const rows = beanEmails.get(`${module}:${id}`) || [];
  return rows.find((row) => row.primary)?.email || rows[0]?.email || null;
}

const users = mergeCustom(imported.users, imported.users_cstm).map((row) => ({
  id: row.id,
  userName: row.user_name,
  fullName: normalizeName(row.first_name, row.last_name) || row.user_name,
  status: row.status,
  title: row.title,
  department: row.department,
  email: primaryEmail("Users", row.id, row.email1),
  phone: value(row, "phone_work", "phone_mobile", "phone_home"),
  legacy: compact(row)
}));
const userById = new Map(users.map((user) => [user.id, user]));
const currencies = [
  { id: "-99", name: "US Dollars", symbol: "$", iso4217: "USD", conversionRate: 1, status: "Active", deleted: false, legacy: { source: "suitecrm-default" } },
  ...imported.currencies.map((row) => ({
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    iso4217: row.iso4217,
    conversionRate: asNumber(row.conversion_rate || 1),
    status: row.status,
    deleted: row.deleted === "1",
    legacy: compact(row)
  }))
].filter((row, index, rows) => row.id && rows.findIndex((item) => item.id === row.id) === index);
const currencyById = new Map(currencies.map((currency) => [currency.id, currency]));

const quoteTemplates = imported.aos_pdf_templates.map((row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  active: row.active === "1",
  deleted: row.deleted === "1",
  legacy: compact(row)
}));
const quoteTemplateById = new Map(quoteTemplates.map((template) => [template.id, template]));

const accountContacts = relationIds(
  [...imported.accounts_contacts, ...imported.contacts_accounts_1_c],
  ["account_id", "account_ida", "account_id_c", "accounts_ida"],
  ["contact_id", "contact_idb", "contacts_idb"]
);
const contactAccounts = relationIds(
  [...imported.accounts_contacts, ...imported.contacts_accounts_1_c],
  ["contact_id", "contact_idb", "contacts_idb"],
  ["account_id", "account_ida", "account_id_c", "accounts_ida"]
);
const accountOpportunities = relationIds(
  imported.accounts_opportunities,
  ["account_id", "account_ida"],
  ["opportunity_id", "opportunity_idb"]
);
const opportunityAccounts = relationIds(
  imported.accounts_opportunities,
  ["opportunity_id", "opportunity_idb"],
  ["account_id", "account_ida"]
);
const opportunityContacts = relationIds(
  imported.opportunities_contacts,
  ["opportunity_id", "opportunity_ida"],
  ["contact_id", "contact_idb"]
);

const accounts = mergeCustom(imported.accounts, imported.accounts_cstm).map((row) => ({
  id: row.id,
  name: row.name || "Sin nombre",
  type: row.account_type,
  industry: row.industry,
  status: row.deleted === "1" ? "Eliminado" : value(row.custom, "estado_c") || "Activo",
  assignedUserId: row.assigned_user_id,
  assignedUser: userById.get(row.assigned_user_id)?.fullName || row.assigned_user_id,
  phone: value(row, "phone_office", "phone_alternate", "phone_fax"),
  website: row.website,
  email: primaryEmail("Accounts", row.id, value(row.custom, "email_c")),
  city: value(row, "billing_address_city", "shipping_address_city"),
  state: value(row, "billing_address_state", "shipping_address_state"),
  country: value(row, "billing_address_country", "shipping_address_country"),
  address: value(row, "billing_address_street", "shipping_address_street"),
  description: row.description,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  contactIds: setToArray(accountContacts, row.id),
  opportunityIds: setToArray(accountOpportunities, row.id),
  legacy: compact(row)
}));

const contacts = mergeCustom(imported.contacts, imported.contacts_cstm).map((row) => ({
  id: row.id,
  name: normalizeName(row.salutation, row.first_name, row.last_name) || row.last_name || "Sin nombre",
  title: row.title,
  department: row.department,
  accountId: row.account_id,
  accountIds: Array.from(new Set([row.account_id, ...setToArray(contactAccounts, row.id)].filter(Boolean))),
  phone: value(row, "phone_work", "phone_mobile", "phone_home", "phone_other"),
  email: primaryEmail("Contacts", row.id, row.email1),
  city: value(row, "primary_address_city", "alt_address_city"),
  state: value(row, "primary_address_state", "alt_address_state"),
  country: value(row, "primary_address_country", "alt_address_country"),
  address: value(row, "primary_address_street", "alt_address_street"),
  assignedUserId: row.assigned_user_id,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const opportunities = mergeCustom(imported.opportunities, imported.opportunities_cstm).map((row) => ({
  id: row.id,
  name: row.name || "Sin nombre",
  stage: row.sales_stage,
  type: row.opportunity_type,
  amount: Number(row.amount || row.amount_usdollar || 0) || 0,
  currencyId: row.currency_id,
  probability: Number(row.probability || 0) || 0,
  closeDate: row.date_closed,
  assignedUserId: row.assigned_user_id,
  accountIds: setToArray(opportunityAccounts, row.id),
  contactIds: setToArray(opportunityContacts, row.id),
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const callContacts = relationIds(imported.calls_contacts, ["call_id"], ["contact_id"]);
const meetingContacts = relationIds(imported.meetings_contacts, ["meeting_id"], ["contact_id"]);
const callUsers = relationIds(imported.calls_users, ["call_id"], ["user_id"]);
const meetingUsers = relationIds(imported.meetings_users, ["meeting_id"], ["user_id"]);

const activities = [
  ...imported.calls.map((row) => ({
    id: row.id,
    type: "Llamada",
    title: row.name || "Llamada",
    status: row.status,
    dateStart: row.date_start,
    durationMinutes: Number(row.duration_hours || 0) * 60 + Number(row.duration_minutes || 0),
    parentType: row.parent_type,
    parentId: row.parent_id,
    contactIds: setToArray(callContacts, row.id),
    userIds: Array.from(new Set([row.assigned_user_id, ...setToArray(callUsers, row.id)].filter(Boolean))),
    description: row.description,
    deleted: row.deleted === "1",
    legacy: compact(row)
  })),
  ...mergeCustom(imported.meetings, imported.meetings_cstm).map((row) => ({
    id: row.id,
    type: "Reunion",
    title: row.name || "Reunion",
    status: row.status,
    dateStart: row.date_start,
    durationMinutes: Number(row.duration_hours || 0) * 60 + Number(row.duration_minutes || 0),
    parentType: row.parent_type,
    parentId: row.parent_id,
    contactIds: setToArray(meetingContacts, row.id),
    userIds: Array.from(new Set([row.assigned_user_id, ...setToArray(meetingUsers, row.id)].filter(Boolean))),
    description: row.description,
    deleted: row.deleted === "1",
    legacy: compact(row)
  })),
  ...mergeCustom(imported.tasks, imported.tasks_cstm).map((row) => ({
    id: row.id,
    type: "Tarea",
    title: row.name || "Tarea",
    status: row.status,
    priority: row.priority,
    dateStart: row.date_start,
    dueDate: row.date_due,
    parentType: row.parent_type,
    parentId: row.parent_id,
    contactId: row.contact_id,
    userIds: [row.assigned_user_id].filter(Boolean),
    description: row.description,
    deleted: row.deleted === "1",
    legacy: compact(row)
  }))
].sort((a, b) => String(b.dateStart || b.dueDate || "").localeCompare(String(a.dateStart || a.dueDate || "")));

const notes = imported.notes.map((row) => ({
  id: row.id,
  title: row.name || "Nota",
  parentType: row.parent_type,
  parentId: row.parent_id,
  contactId: row.contact_id,
  description: row.description,
  fileName: row.filename,
  assignedUserId: row.assigned_user_id,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const quotes = mergeCustom(imported.aos_quotes, imported.aos_quotes_cstm).map((row) => ({
  id: row.id,
  number: row.number,
  name: row.name || `Cotizacion ${row.number || ""}`.trim(),
  accountId: row.billing_account_id || row.account_id,
  contactId: row.billing_contact_id,
  opportunityId: row.opportunity_id,
  stage: row.stage,
  approvalStatus: row.approval_status,
  approvalIssue: row.approval_issue,
  invoiceStatus: row.invoice_status,
  term: row.term,
  terms: row.terms_c,
  paymentMethod: row.custom?.forma_de_pago_c || row.term,
  deliveryTime: row.custom?.tiempo_de_entrega_c,
  observations: row.custom?.observaciones_c,
  originCountry: row.custom?.paisorigen_c,
  templateIds: parseMultiEnum(row.template_ddown_c),
  templateNames: parseMultiEnum(row.template_ddown_c).map((id) => quoteTemplateById.get(id)?.name || id),
  subtotal: asNumber(row.subtotal_amount || row.total_amt),
  discount: asNumber(row.discount_amount),
  tax: asNumber(row.tax_amount || row.subtotal_tax_amount),
  shipping: asNumber(row.shipping_amount),
  shippingTax: asNumber(row.shipping_tax_amt),
  total: asNumber(row.total_amount || row.total_amt || row.subtotal_amount),
  currencyId: row.currency_id,
  currencyName: currencyById.get(row.currency_id)?.name || (row.currency_id === "-99" ? "US Dollars" : row.currency_id),
  currencySymbol: currencyById.get(row.currency_id)?.symbol || "$",
  currencyIso: currencyById.get(row.currency_id)?.iso4217 || (row.currency_id === "-99" ? "USD" : null),
  expiration: row.expiration,
  billingStreet: row.billing_address_street,
  billingCity: row.billing_address_city,
  billingState: row.billing_address_state,
  billingPostalCode: row.billing_address_postalcode,
  billingCountry: row.billing_address_country,
  shippingStreet: row.shipping_address_street,
  shippingCity: row.shipping_address_city,
  shippingState: row.shipping_address_state,
  shippingPostalCode: row.shipping_address_postalcode,
  shippingCountry: row.shipping_address_country,
  billingAddress: joinAddress(row.billing_address_street, row.billing_address_city, row.billing_address_state, row.billing_address_postalcode, row.billing_address_country),
  shippingAddress: joinAddress(row.shipping_address_street, row.shipping_address_city, row.shipping_address_state, row.shipping_address_postalcode, row.shipping_address_country),
  description: row.description,
  assignedUserId: row.assigned_user_id,
  assignedUser: userById.get(row.assigned_user_id)?.fullName || row.assigned_user_id,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const quoteGroups = imported.aos_line_item_groups
  .filter((row) => row.parent_type === "AOS_Quotes" && row.parent_id)
  .map((row) => ({
    id: row.id,
    quoteId: row.parent_id,
    number: asNumber(row.number),
    name: row.name || "Grupo",
    subtotal: asNumber(row.subtotal_amount || row.total_amt),
    discount: asNumber(row.discount_amount),
    tax: asNumber(row.tax_amount || row.subtotal_tax_amount),
    total: asNumber(row.total_amount),
    currencyId: row.currency_id,
    deleted: row.deleted === "1",
    legacy: compact(row)
  }));

const quoteLines = imported.aos_products_quotes
  .filter((row) => row.parent_type === "AOS_Quotes" && row.parent_id)
  .map((row) => ({
    id: row.id,
    quoteId: row.parent_id,
    groupId: row.group_id,
    productId: row.product_id,
    number: asNumber(row.number),
    name: row.name || "Linea",
    partNumber: row.part_number,
    description: row.item_description || row.description,
    quantity: asNumber(row.product_qty || 1),
    costPrice: asNumber(row.product_cost_price),
    listPrice: asNumber(row.product_list_price),
    unitPrice: asNumber(row.product_unit_price || row.product_list_price),
    discount: asNumber(row.product_discount),
    discountAmount: asNumber(row.product_discount_amount),
    discountType: row.discount,
    vatRate: row.vat,
    vatAmount: asNumber(row.vat_amt),
    total: asNumber(row.product_total_price),
    currencyId: row.currency_id,
    deleted: row.deleted === "1",
    legacy: compact(row)
  }));

const invoices = imported.aos_invoices.map((row) => ({
  id: row.id,
  number: row.number,
  name: row.name || `Factura ${row.number || ""}`.trim(),
  accountId: row.billing_account_id,
  contactId: row.billing_contact_id,
  status: row.status,
  total: Number(row.total_amount || row.total_amt || 0) || 0,
  dueDate: row.due_date,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const products = mergeCustom(imported.aos_products, imported.aos_products_cstm).map((row) => ({
  id: row.id,
  name: row.name || "Producto",
  partNumber: row.part_number,
  type: value(row.custom, "tipo_producto_c", "tipo_de_impresion_c") || row.type,
  categoryId: row.aos_product_category_id,
  price: Number(row.price || row.price_usdollar || 0) || 0,
  cost: Number(row.cost || row.cost_usdollar || 0) || 0,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const cases = mergeCustom(imported.cases, imported.cases_cstm).map((row) => ({
  id: row.id,
  number: row.case_number,
  name: row.name || `Caso ${row.case_number || ""}`.trim(),
  accountId: row.account_id,
  status: row.status,
  priority: row.priority,
  type: row.type,
  description: row.description,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const leads = mergeCustom(imported.leads, imported.leads_cstm).map((row) => ({
  id: row.id,
  name: normalizeName(row.first_name, row.last_name) || row.account_name || "Lead",
  accountName: row.account_name,
  status: row.status,
  source: row.lead_source,
  phone: value(row, "phone_work", "phone_mobile", "phone_home"),
  email: primaryEmail("Leads", row.id, row.email1),
  city: row.primary_address_city,
  country: row.primary_address_country,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const documents = mergeCustom(imported.documents, imported.documents_cstm).map((row) => ({
  id: row.id,
  name: row.document_name || row.name || "Documento",
  status: row.status_id,
  category: value(row.custom, "categoria_c") || row.category_id,
  subcategory: row.subcategory_id,
  activeDate: row.active_date,
  expirationDate: row.exp_date,
  assignedUserId: row.assigned_user_id,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const projects = imported.project.map((row) => ({
  id: row.id,
  name: row.name || "Proyecto",
  status: row.status,
  priority: row.priority,
  startDate: row.estimated_start_date,
  endDate: row.estimated_end_date,
  assignedUserId: row.assigned_user_id,
  createdAt: row.date_entered,
  updatedAt: row.date_modified,
  deleted: row.deleted === "1",
  legacy: compact(row)
}));

const caseById = new Map(cases.map((row) => [row.id, row]));
const contactById = new Map(contacts.map((row) => [row.id, row]));
const quoteById = new Map(quotes.map((row) => [row.id, row]));
const invoiceById = new Map(invoices.map((row) => [row.id, row]));
const opportunityById = new Map(opportunities.map((row) => [row.id, row]));

const disenoAccounts = relationIds(
  imported.sie_diseno_accounts_c,
  ["sie_diseno_accountssie_diseno_idb"],
  ["sie_diseno_accountsaccounts_ida"],
  { includeDeleted: true }
);
const carteraAccounts = relationIds(
  imported.sie_cartera_accounts_c,
  ["sie_cartera_accountssie_cartera_idb"],
  ["sie_cartera_accountsaccounts_ida"],
  { includeDeleted: true }
);
const accionCases = relationIds(
  imported.sie_accion_cases_c,
  ["sie_accion_casessie_accion_idb"],
  ["sie_accion_casescases_ida"],
  { includeDeleted: true }
);
const planActions = relationIds(
  [...imported.sie_plan_de_accion_sie_accion_c, ...imported.sie_plan_de_accion_sie_accion_1_c],
  ["sie_plan_de_accion_sie_accionsie_plan_de_accion_idb", "sie_plan_de_accion_sie_accion_1sie_plan_de_accion_idb"],
  ["sie_plan_de_accion_sie_accionsie_accion_ida", "sie_plan_de_accion_sie_accion_1sie_accion_ida"],
  { includeDeleted: true }
);

function firstRelated(map, key) {
  return setToArray(map, key)[0] || null;
}

function accountIdsForBean(module, id) {
  if (!module || !id) return [];
  if (module === "Accounts") return [id];
  if (module === "Contacts") return contactById.get(id)?.accountIds || setToArray(contactAccounts, id);
  if (module === "Cases") return [caseById.get(id)?.accountId].filter(Boolean);
  if (module === "AOS_Quotes") return [quoteById.get(id)?.accountId].filter(Boolean);
  if (module === "AOS_Invoices") return [invoiceById.get(id)?.accountId].filter(Boolean);
  if (module === "Opportunities") return opportunityById.get(id)?.accountIds || [];
  return [];
}

function accountIdForAction(actionId) {
  return setToArray(accionCases, actionId)
    .map((caseId) => caseById.get(caseId)?.accountId)
    .find(Boolean) || null;
}

function accountIdForPlan(planId) {
  return setToArray(planActions, planId)
    .map(accountIdForAction)
    .find(Boolean) || null;
}

const emailTextById = new Map(imported.emails_text.map((row) => [row.email_id, row]));
const emailAddressesByEmailId = new Map();
for (const row of imported.emails_email_addr_rel.filter(notDeleted)) {
  const email = emailAddressById.get(row.email_address_id);
  if (!email || !row.email_id) continue;
  if (!emailAddressesByEmailId.has(row.email_id)) emailAddressesByEmailId.set(row.email_id, {});
  const bucket = emailAddressesByEmailId.get(row.email_id);
  const type = row.address_type || "address";
  bucket[type] ||= [];
  bucket[type].push(email);
}
const emailBeansByEmailId = new Map();
for (const row of imported.emails_beans.filter(notDeleted)) {
  if (!row.email_id || !row.bean_id || !row.bean_module) continue;
  if (!emailBeansByEmailId.has(row.email_id)) emailBeansByEmailId.set(row.email_id, []);
  emailBeansByEmailId.get(row.email_id).push(row);
}

function emailAccountIds(row) {
  const ids = new Set(accountIdsForBean(row.parent_type, row.parent_id));
  for (const link of emailBeansByEmailId.get(row.id) || []) {
    for (const id of accountIdsForBean(link.bean_module, link.bean_id)) ids.add(id);
  }
  return Array.from(ids);
}

const customModules = {
  cartera: mergeCustom(imported.sie_cartera, imported.sie_cartera_cstm).map((row) => ({
    id: row.id,
    name: row.name || "Cartera",
    accountId: firstRelated(carteraAccounts, row.id),
    status: row.estado_cartera,
    type: row.politica_cartera,
    startDate: row.fecha_de_cobro || row.date_entered,
    endDate: row.fecha_resultado_comercial || row.date_modified,
    total: asMoney(row.valor_a_cobrar),
    deleted: row.deleted === "1",
    legacy: compact(row)
  })),
  disenos: imported.sie_diseno.map((row) => ({
    id: row.id,
    name: row.name || "Diseno",
    accountId: firstRelated(disenoAccounts, row.id),
    status: row.estado,
    type: value(row, "producto", "material"),
    startDate: row.fecha_recepcion_arte || row.date_entered,
    endDate: row.fec_aprob_arte_real || row.date_modified,
    deleted: row.deleted === "1",
    legacy: compact(row)
  })),
  acciones: mergeCustom(imported.sie_accion, imported.sie_accion_cstm).map((row) => ({
    id: row.id,
    name: row.name || "Accion",
    accountId: accountIdForAction(row.id),
    status: row.status || null,
    type: row.type || null,
    startDate: row.date_entered,
    endDate: row.date_modified,
    deleted: row.deleted === "1",
    legacy: { ...compact(row), caseIds: setToArray(accionCases, row.id) }
  })),
  planesAccion: mergeCustom(imported.sie_plan_de_accion, imported.sie_plan_de_accion_cstm).map((row) => ({
    id: row.id,
    name: row.name || "Plan de accion",
    accountId: accountIdForPlan(row.id),
    status: row.verificacion ? "Verificado" : null,
    type: row.accion_correctiva ? "Accion correctiva" : null,
    startDate: row.date_entered,
    endDate: row.date_modified,
    deleted: row.deleted === "1",
    legacy: { ...compact(row), actionIds: setToArray(planActions, row.id) }
  }))
};

const genericRecords = [
  ...imported.campaigns.map((row) => ({ id: row.id, module: "Campanas", name: row.name, status: row.status, type: row.campaign_type, startDate: row.start_date, endDate: row.end_date, deleted: row.deleted === "1", legacy: compact(row) })),
  ...imported.prospect_lists.map((row) => ({ id: row.id, module: "Publico Objetivo - Listas", name: row.name, status: row.list_type, type: row.list_type, deleted: row.deleted === "1", legacy: compact(row) })),
  ...imported.prospects.map((row) => ({ id: row.id, module: "Publico Objetivo", name: normalizeName(row.first_name, row.last_name) || row.account_name || row.name, status: row.status, type: row.prospect_type, deleted: row.deleted === "1", legacy: compact(row) })),
  ...mergeCustom(imported.emails, imported.emails_cstm).map((row) => {
    const text = emailTextById.get(row.id) || {};
    const accountIds = emailAccountIds(row);
    return {
      id: row.id,
      module: "Correos",
      name: row.name || text.description || "Correo",
      accountId: accountIds[0] || null,
      status: row.status,
      type: row.type,
      startDate: row.date_sent || row.date_entered,
      deleted: row.deleted === "1",
      legacy: {
        ...compact(row),
        text: compact(text),
        addresses: emailAddressesByEmailId.get(row.id) || {},
        accountIds
      }
    };
  }),
  ...imported.aos_contracts.map((row) => ({ id: row.id, module: "Contratos", name: row.name, status: row.status, type: row.type, startDate: row.start_date, endDate: row.end_date, total: asNumber(row.total_contract_value), accountId: row.contract_account_id, deleted: row.deleted === "1", legacy: compact(row) })),
  ...imported.aos_pdf_templates.map((row) => ({ id: row.id, module: "PDF - Plantillas", name: row.name, status: row.active, type: row.type, deleted: row.deleted === "1", legacy: compact(row) })),
  ...Object.entries(customModules).flatMap(([module, rows]) => rows.map((row) => ({ ...row, module })))
];

function suiteModule(module) {
  return {
    Accounts: "accounts",
    Contacts: "contacts",
    Opportunities: "opportunities",
    AOS_Quotes: "quotes",
    AOS_Invoices: "invoices",
    Cases: "cases",
    Leads: "leads",
    Users: "users",
    Project: "projects",
    Documents: "documents"
  }[module] || null;
}

function genericModuleKey(module) {
  return {
    Correos: "emails",
    Contratos: "contracts",
    Campanas: "campaigns",
    "Publico Objetivo": "targets",
    "Publico Objetivo - Listas": "target_lists",
    cartera: "cartera",
    disenos: "disenos",
    acciones: "acciones",
    planesAccion: "planesAccion"
  }[module] || module;
}

const entityLinks = [];
const seenEntityLinks = new Set();

function addLink(row, sourceTable, sourceModule, sourceId, targetModule, targetId, relationship = sourceTable) {
  if (!sourceModule || !sourceId || !targetModule || !targetId) return;
  const key = `${sourceTable}:${sourceModule}:${sourceId}:${targetModule}:${targetId}`;
  if (seenEntityLinks.has(key)) return;
  seenEntityLinks.add(key);
  const legacyId = row?.id || row?.id_c || `${sourceModule}:${sourceId}:${targetModule}:${targetId}`;
  entityLinks.push({
    id: `${sourceTable}:${legacyId}:${sourceModule}:${sourceId}:${targetModule}:${targetId}`,
    sourceModule,
    sourceId,
    targetModule,
    targetId,
    relationship,
    sourceTable,
    dateModified: row?.date_modified || null,
    deleted: row?.deleted === "1",
    legacy: compact(row)
  });
}

function addRelationRows(rows, sourceTable, sourceModule, sourceKeys, targetModule, targetKeys, relationship = sourceTable) {
  for (const row of rows) {
    addLink(row, sourceTable, sourceModule, value(row, ...sourceKeys), targetModule, value(row, ...targetKeys), relationship);
  }
}

addRelationRows(imported.accounts_contacts, "accounts_contacts", "accounts", ["account_id"], "contacts", ["contact_id"]);
addRelationRows(imported.contacts_accounts_1_c, "contacts_accounts_1_c", "accounts", ["account_ida", "account_id_c", "accounts_ida"], "contacts", ["contact_idb", "contacts_idb"]);
addRelationRows(imported.accounts_opportunities, "accounts_opportunities", "accounts", ["account_id", "account_ida"], "opportunities", ["opportunity_id", "opportunity_idb"]);
addRelationRows(imported.opportunities_contacts, "opportunities_contacts", "opportunities", ["opportunity_id", "opportunity_ida"], "contacts", ["contact_id", "contact_idb"]);
addRelationRows(imported.calls_contacts, "calls_contacts", "calls", ["call_id"], "contacts", ["contact_id"]);
addRelationRows(imported.calls_users, "calls_users", "calls", ["call_id"], "users", ["user_id"]);
addRelationRows(imported.meetings_contacts, "meetings_contacts", "meetings", ["meeting_id"], "contacts", ["contact_id"]);
addRelationRows(imported.meetings_leads, "meetings_leads", "meetings", ["meeting_id"], "leads", ["lead_id"]);
addRelationRows(imported.meetings_users, "meetings_users", "meetings", ["meeting_id"], "users", ["user_id"]);
addRelationRows(imported.documents_accounts, "documents_accounts", "documents", ["document_id"], "accounts", ["account_id"]);
addRelationRows(imported.documents_cases, "documents_cases", "documents", ["document_id"], "cases", ["case_id"]);
addRelationRows(imported.documents_contacts, "documents_contacts", "documents", ["document_id"], "contacts", ["contact_id"]);
addRelationRows(imported.documents_opportunities, "documents_opportunities", "documents", ["document_id"], "opportunities", ["opportunity_id"]);
addRelationRows(imported.aos_quotes_aos_invoices_c, "aos_quotes_aos_invoices_c", "quotes", ["aos_quotes77d9_quotes_ida"], "invoices", ["aos_quotes6b83nvoices_idb"]);
addRelationRows(imported.projects_accounts, "projects_accounts", "projects", ["project_id"], "accounts", ["account_id"]);
addRelationRows(imported.projects_contacts, "projects_contacts", "projects", ["project_id"], "contacts", ["contact_id"]);
addRelationRows(imported.projects_opportunities, "projects_opportunities", "projects", ["project_id"], "opportunities", ["opportunity_id"]);
addRelationRows(imported.sie_diseno_accounts_c, "sie_diseno_accounts_c", "disenos", ["sie_diseno_accountssie_diseno_idb"], "accounts", ["sie_diseno_accountsaccounts_ida"]);
addRelationRows(imported.sie_cartera_accounts_c, "sie_cartera_accounts_c", "cartera", ["sie_cartera_accountssie_cartera_idb"], "accounts", ["sie_cartera_accountsaccounts_ida"]);
addRelationRows(imported.sie_accion_cases_c, "sie_accion_cases_c", "acciones", ["sie_accion_casessie_accion_idb"], "cases", ["sie_accion_casescases_ida"]);
addRelationRows(imported.sie_plan_de_accion_sie_accion_c, "sie_plan_de_accion_sie_accion_c", "planesAccion", ["sie_plan_de_accion_sie_accionsie_plan_de_accion_idb"], "acciones", ["sie_plan_de_accion_sie_accionsie_accion_ida"]);
addRelationRows(imported.sie_plan_de_accion_sie_accion_1_c, "sie_plan_de_accion_sie_accion_1_c", "planesAccion", ["sie_plan_de_accion_sie_accion_1sie_plan_de_accion_idb"], "acciones", ["sie_plan_de_accion_sie_accion_1sie_accion_ida"]);

for (const contact of contacts) {
  for (const accountId of contact.accountIds || []) addLink(contact.legacy, "contacts_account_id", "contacts", contact.id, "accounts", accountId, "account");
}
for (const opportunity of opportunities) {
  for (const accountId of opportunity.accountIds || []) addLink(opportunity.legacy, "opportunities_account_ids", "opportunities", opportunity.id, "accounts", accountId, "account");
  for (const contactId of opportunity.contactIds || []) addLink(opportunity.legacy, "opportunities_contact_ids", "opportunities", opportunity.id, "contacts", contactId, "contact");
}
for (const activity of activities) {
  addLink(activity.legacy, "activities_parent", activity.type === "Llamada" ? "calls" : activity.type === "Reunion" ? "meetings" : "tasks", activity.id, suiteModule(activity.parentType), activity.parentId, "parent");
  if (activity.contactId) addLink(activity.legacy, "activities_contact", activity.type === "Llamada" ? "calls" : activity.type === "Reunion" ? "meetings" : "tasks", activity.id, "contacts", activity.contactId, "contact");
  for (const contactId of activity.contactIds || []) addLink(activity.legacy, "activities_contact_ids", activity.type === "Llamada" ? "calls" : activity.type === "Reunion" ? "meetings" : "tasks", activity.id, "contacts", contactId, "contact");
  for (const userId of activity.userIds || []) addLink(activity.legacy, "activities_user_ids", activity.type === "Llamada" ? "calls" : activity.type === "Reunion" ? "meetings" : "tasks", activity.id, "users", userId, "assigned_user");
}
for (const note of notes) {
  addLink(note.legacy, "notes_parent", "notes", note.id, suiteModule(note.parentType), note.parentId, "parent");
  addLink(note.legacy, "notes_contact", "notes", note.id, "contacts", note.contactId, "contact");
}
for (const quote of quotes) {
  addLink(quote.legacy, "quotes_account", "quotes", quote.id, "accounts", quote.accountId, "account");
  addLink(quote.legacy, "quotes_contact", "quotes", quote.id, "contacts", quote.contactId, "contact");
  addLink(quote.legacy, "quotes_opportunity", "quotes", quote.id, "opportunities", quote.legacy?.opportunity_id, "opportunity");
}
for (const invoice of invoices) {
  addLink(invoice.legacy, "invoices_account", "invoices", invoice.id, "accounts", invoice.accountId, "account");
  addLink(invoice.legacy, "invoices_contact", "invoices", invoice.id, "contacts", invoice.contactId, "contact");
}
for (const caseRecord of cases) {
  addLink(caseRecord.legacy, "cases_account", "cases", caseRecord.id, "accounts", caseRecord.accountId, "account");
}
for (const document of documents) {
  addLink(document.legacy, "documents_parent", "documents", document.id, suiteModule(document.legacy?.custom?.parent_type), document.legacy?.custom?.parent_id, "parent");
}
for (const email of genericRecords.filter((row) => row.module === "Correos")) {
  for (const link of emailBeansByEmailId.get(email.id) || []) {
    addLink(link, "emails_beans", "emails", email.id, suiteModule(link.bean_module), link.bean_id, "bean");
  }
  const source = email.legacy || {};
  addLink(source, "emails_parent", "emails", email.id, suiteModule(source.parent_type), source.parent_id, "parent");
}
for (const record of genericRecords) {
  if (record.accountId) addLink(record.legacy, "generic_account", genericModuleKey(record.module), record.id, "accounts", record.accountId, "account");
}

function active(list) {
  return list.filter((item) => !item.deleted).length;
}

const tableCounts = Object.fromEntries(Object.entries(rowCounts).sort(([a], [b]) => a.localeCompare(b)));
const topTables = Object.entries(tableCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 18)
  .map(([table, rows]) => ({ table, rows }));

const data = {
  meta: {
    app: "BIOCRM",
    generatedAt: new Date().toISOString(),
    sourceFile: "respaldo_suitecrm.sql",
    sourceSizeBytes: fs.statSync(sourceFile).size,
    totalTables: Object.keys(columns).length,
    importedTables: Array.from(selectedTables).sort(),
    strategy: "Migracion normalizada con IDs legacy y campos originales preservados por registro."
  },
  summary: {
    accounts: accounts.length,
    activeAccounts: active(accounts),
    contacts: contacts.length,
    opportunities: opportunities.length,
    activities: activities.length,
    quotes: quotes.length,
    quoteLines: quoteLines.length,
    invoices: invoices.length,
    products: products.length,
    cases: cases.length,
    leads: leads.length,
    users: users.length,
    documents: documents.length,
    projects: projects.length,
    currencies: currencies.length,
    quoteTemplates: quoteTemplates.length,
    customRecords: Object.values(customModules).reduce((sum, rows) => sum + rows.length, 0),
    genericRecords: genericRecords.length,
    entityLinks: entityLinks.length
  },
  users,
  accounts,
  contacts,
  opportunities,
  activities,
  notes,
  quotes,
  quoteGroups,
  quoteLines,
  invoices,
  products,
  cases,
  leads,
  documents,
  projects,
  currencies,
  quoteTemplates,
  customModules,
  genericRecords,
  entityLinks,
  migration: {
    tableCounts,
    topTables,
    selectedTableCounts: Object.fromEntries(Array.from(selectedTables).sort().map((table) => [table, rowCounts[table] || 0])),
    warnings: [
      "El archivo SQL original se conserva como respaldo completo.",
      "Los registros marcados como deleted=1 se importan y se muestran como eliminados para no perder historial.",
      "Los campos no usados por la interfaz quedan dentro de legacy en cada entidad normalizada."
    ]
  }
};

function insertRows(db, sql, rows, mapper) {
  const statement = db.prepare(sql);
  for (const row of rows) {
    statement.run(...mapper(row).map((value) => (value === undefined ? null : value)));
  }
}

function placeholders(count) {
  return Array.from({ length: count }, () => "?").join(", ");
}

function writeSqlite(data) {
  for (const file of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const db = new DatabaseSync(sqliteFile);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE auth_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      user_name TEXT,
      full_name TEXT,
      status TEXT,
      title TEXT,
      department TEXT,
      email TEXT,
      phone TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      industry TEXT,
      status TEXT,
      assigned_user_id TEXT,
      assigned_user TEXT,
      phone TEXT,
      website TEXT,
      email TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      address TEXT,
      description TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      local_updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT,
      department TEXT,
      account_id TEXT,
      account_ids_json TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      address TEXT,
      assigned_user_id TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE opportunities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stage TEXT,
      type TEXT,
      amount REAL NOT NULL DEFAULT 0,
      probability REAL NOT NULL DEFAULT 0,
      close_date TEXT,
      assigned_user_id TEXT,
      account_ids_json TEXT NOT NULL,
      contact_ids_json TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT,
      priority TEXT,
      date_start TEXT,
      due_date TEXT,
      duration_minutes REAL,
      parent_type TEXT,
      parent_id TEXT,
      contact_id TEXT,
      contact_ids_json TEXT NOT NULL,
      user_ids_json TEXT NOT NULL,
      description TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      parent_type TEXT,
      parent_id TEXT,
      contact_id TEXT,
      description TEXT,
      file_name TEXT,
      assigned_user_id TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      part_number TEXT,
      type TEXT,
      category_id TEXT,
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE currencies (
      id TEXT PRIMARY KEY,
      name TEXT,
      symbol TEXT,
      iso4217 TEXT,
      conversion_rate REAL NOT NULL DEFAULT 1,
      status TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE quote_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      active INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE quotes (
      id TEXT PRIMARY KEY,
      number TEXT,
      name TEXT NOT NULL,
      account_id TEXT,
      contact_id TEXT,
      opportunity_id TEXT,
      stage TEXT,
      approval_status TEXT,
      approval_issue TEXT,
      invoice_status TEXT,
      term TEXT,
      terms TEXT,
      payment_method TEXT,
      delivery_time TEXT,
      observations TEXT,
      origin_country TEXT,
      template_ids_json TEXT NOT NULL,
      template_names_json TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      shipping REAL NOT NULL DEFAULT 0,
      shipping_tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      currency_id TEXT,
      currency_name TEXT,
      currency_symbol TEXT,
      currency_iso TEXT,
      expiration TEXT,
      billing_address TEXT,
      shipping_address TEXT,
      billing_street TEXT,
      billing_city TEXT,
      billing_state TEXT,
      billing_postalcode TEXT,
      billing_country TEXT,
      shipping_street TEXT,
      shipping_city TEXT,
      shipping_state TEXT,
      shipping_postalcode TEXT,
      shipping_country TEXT,
      description TEXT,
      assigned_user_id TEXT,
      assigned_user TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE quote_groups (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      number REAL,
      name TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      currency_id TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE quote_lines (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      group_id TEXT,
      product_id TEXT,
      number REAL,
      name TEXT NOT NULL,
      part_number TEXT,
      description TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      cost_price REAL NOT NULL DEFAULT 0,
      list_price REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      discount_type TEXT,
      vat_rate TEXT,
      vat_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      currency_id TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE invoices (
      id TEXT PRIMARY KEY,
      number TEXT,
      name TEXT NOT NULL,
      account_id TEXT,
      contact_id TEXT,
      status TEXT,
      total REAL NOT NULL DEFAULT 0,
      due_date TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE cases (
      id TEXT PRIMARY KEY,
      number TEXT,
      name TEXT NOT NULL,
      account_id TEXT,
      status TEXT,
      priority TEXT,
      type TEXT,
      description TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_name TEXT,
      status TEXT,
      source TEXT,
      phone TEXT,
      email TEXT,
      city TEXT,
      country TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT,
      category TEXT,
      subcategory TEXT,
      active_date TEXT,
      expiration_date TEXT,
      assigned_user_id TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT,
      priority TEXT,
      start_date TEXT,
      end_date TEXT,
      assigned_user_id TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE generic_records (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      name TEXT NOT NULL,
      account_id TEXT,
      status TEXT,
      type TEXT,
      start_date TEXT,
      end_date TEXT,
      total REAL NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE entity_links (
      id TEXT PRIMARY KEY,
      source_module TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_module TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      source_table TEXT NOT NULL,
      date_modified TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      legacy_json TEXT NOT NULL
    );

    CREATE TABLE migration_tables (
      table_name TEXT PRIMARY KEY,
      rows_count INTEGER NOT NULL
    );

    CREATE INDEX idx_accounts_name ON accounts(name);
    CREATE INDEX idx_accounts_industry ON accounts(industry);
    CREATE INDEX idx_contacts_account ON contacts(account_id);
    CREATE INDEX idx_quotes_account ON quotes(account_id);
    CREATE INDEX idx_quotes_number ON quotes(number);
    CREATE INDEX idx_quote_lines_quote ON quote_lines(quote_id);
    CREATE INDEX idx_quote_groups_quote ON quote_groups(quote_id);
    CREATE INDEX idx_activities_parent ON activities(parent_id);
    CREATE INDEX idx_generic_module ON generic_records(module);
    CREATE INDEX idx_entity_links_source ON entity_links(source_module, source_id, target_module);
    CREATE INDEX idx_entity_links_target ON entity_links(target_module, target_id, source_module);
  `);

  db.exec("BEGIN");
  try {
    const adminPassword = process.env.BIOCRM_ADMIN_PASSWORD || "BioCRM2026!";
    db.prepare("INSERT INTO auth_users (id, username, password_hash, display_name, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      crypto.randomUUID(),
      "admin",
      hashPassword(adminPassword),
      "Administrador BIOCRM",
      "admin",
      1,
      nowIso()
    );
    db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run("generated_at", data.meta.generatedAt);
    db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run("source_file", data.meta.sourceFile);
    db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run("summary", json(data.summary));

    insertRows(db, "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", data.users, (r) => [r.id, r.userName, r.fullName, r.status, r.title, r.department, r.email, r.phone, json(r.legacy)]);
    insertRows(db, "INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.accounts, (r) => [r.id, r.name, r.type, r.industry, r.status, r.assignedUserId, r.assignedUser, r.phone, r.website, r.email, r.city, r.state, r.country, r.address, r.description, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, r.localUpdatedAt || null, json(r.legacy)]);
    insertRows(db, "INSERT INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.contacts, (r) => [r.id, r.name, r.title, r.department, r.accountId, json(r.accountIds || []), r.phone, r.email, r.city, r.state, r.country, r.address, r.assignedUserId, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO opportunities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.opportunities, (r) => [r.id, r.name, r.stage, r.type, r.amount, r.probability, r.closeDate, r.assignedUserId, json(r.accountIds || []), json(r.contactIds || []), r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.activities, (r) => [r.id, r.type, r.title, r.status, r.priority, r.dateStart, r.dueDate, r.durationMinutes, r.parentType, r.parentId, r.contactId, json(r.contactIds || []), json(r.userIds || []), r.description, r.deleted ? 1 : 0, json(r.legacy)]);
    insertRows(db, "INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.notes, (r) => [r.id, r.title, r.parentType, r.parentId, r.contactId, r.description, r.fileName, r.assignedUserId, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.products, (r) => [r.id, r.name, r.partNumber, r.type, r.categoryId, r.price, r.cost, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO currencies VALUES (?, ?, ?, ?, ?, ?, ?, ?)", data.currencies, (r) => [r.id, r.name, r.symbol, r.iso4217, r.conversionRate, r.status, r.deleted ? 1 : 0, json(r.legacy)]);
    insertRows(db, "INSERT INTO quote_templates VALUES (?, ?, ?, ?, ?, ?)", data.quoteTemplates, (r) => [r.id, r.name || "Plantilla", r.type, r.active ? 1 : 0, r.deleted ? 1 : 0, json(r.legacy)]);
    insertRows(db, `INSERT INTO quotes VALUES (${placeholders(48)})`, data.quotes, (r) => [r.id, r.number, r.name, r.accountId, r.contactId, r.opportunityId || r.legacy?.opportunity_id || null, r.stage, r.approvalStatus, r.approvalIssue, r.invoiceStatus, r.term, r.terms, r.paymentMethod, r.deliveryTime, r.observations, r.originCountry, json(r.templateIds || []), json(r.templateNames || []), r.subtotal, r.discount, r.tax, r.shipping, r.shippingTax, r.total, r.currencyId, r.currencyName, r.currencySymbol, r.currencyIso, r.expiration, r.billingAddress, r.shippingAddress, r.billingStreet, r.billingCity, r.billingState, r.billingPostalCode, r.billingCountry, r.shippingStreet, r.shippingCity, r.shippingState, r.shippingPostalCode, r.shippingCountry, r.description, r.assignedUserId, r.assignedUser, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO quote_groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.quoteGroups, (r) => [r.id, r.quoteId, r.number, r.name, r.subtotal, r.discount, r.tax, r.total, r.currencyId, r.deleted ? 1 : 0, json(r.legacy)]);
    insertRows(db, "INSERT INTO quote_lines VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.quoteLines, (r) => [r.id, r.quoteId, r.groupId, r.productId, r.number, r.name, r.partNumber, r.description, r.quantity, r.costPrice, r.listPrice, r.unitPrice, r.discount, r.discountAmount, r.discountType, r.vatRate, r.vatAmount, r.total, r.currencyId, r.deleted ? 1 : 0, json(r.legacy)]);
    insertRows(db, "INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.invoices, (r) => [r.id, r.number, r.name, r.accountId, r.contactId, r.status, r.total, r.dueDate, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.cases, (r) => [r.id, r.number, r.name, r.accountId, r.status, r.priority, r.type, r.description, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO leads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.leads, (r) => [r.id, r.name, r.accountName, r.status, r.source, r.phone, r.email, r.city, r.country, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.documents, (r) => [r.id, r.name, r.status, r.category, r.subcategory, r.activeDate, r.expirationDate, r.assignedUserId, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.projects, (r) => [r.id, r.name, r.status, r.priority, r.startDate, r.endDate, r.assignedUserId, r.deleted ? 1 : 0, r.createdAt, r.updatedAt, json(r.legacy)]);
    insertRows(db, "INSERT INTO generic_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.genericRecords, (r) => [r.id, r.module, r.name || "Sin nombre", r.accountId || null, r.status, r.type, r.startDate, r.endDate, asNumber(r.total), r.deleted ? 1 : 0, json(r.legacy)]);
    insertRows(db, "INSERT INTO entity_links VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", data.entityLinks, (r) => [r.id, r.sourceModule, r.sourceId, r.targetModule, r.targetId, r.relationship, r.sourceTable, r.dateModified, r.deleted ? 1 : 0, json(r.legacy)]);
    insertRows(db, "INSERT INTO migration_tables VALUES (?, ?)", Object.entries(data.migration.tableCounts), ([table, count]) => [table, count]);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }
}

fs.writeFileSync(outputFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
fs.writeFileSync(
  reportFile,
  `${JSON.stringify(
    {
      generatedAt: data.meta.generatedAt,
      sourceFile: data.meta.sourceFile,
      totalTables: data.meta.totalTables,
      summary: data.summary,
      topTables,
      selectedTableCounts: data.migration.selectedTableCounts,
      allTableCounts: tableCounts
    },
    null,
    2
  )}\n`,
  "utf8"
);
writeSqlite(data);

console.log(`BIOCRM importado: ${accounts.length} cuentas, ${contacts.length} contactos, ${activities.length} actividades.`);
console.log(`Reporte: ${path.relative(root, reportFile)}`);
console.log(`SQLite: ${path.relative(root, sqliteFile)}`);
