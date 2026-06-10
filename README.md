# BIOCRM

Sistema local moderno para trabajar datos migrados desde SuiteCRM.

## Ejecutar

```bash
npm install
npm run import:suitecrm
npm run dev
```

Frontend: http://127.0.0.1:5173  
API: http://127.0.0.1:4177

Usuario inicial local:

- Usuario: `admin`
- Contrasena: `BioCRM2026!`

Para cambiar esa contrasena al regenerar la base:

```bash
set BIOCRM_ADMIN_PASSWORD=UnaContrasenaSegura
npm run import:suitecrm
```

## Migracion

El importador lee `respaldo_suitecrm.sql`, genera `data/biocrm.sqlite`, mantiene `data/biocrm-data.json` como respaldo normalizado y crea `data/migration-report.json`.

Si la API esta corriendo, detenla antes de regenerar SQLite porque Windows bloquea el archivo abierto.

La migracion conserva:

- IDs originales de SuiteCRM.
- Registros activos y registros con `deleted=1`.
- Campos originales dentro de `legacy` en cada entidad normalizada.
- Conteo de tablas del dump para auditoria.
- Cabecera, grupos y lineas de cotizacion (`aos_quotes`, `aos_line_item_groups`, `aos_products_quotes`).

Entidades principales:

- Cuentas
- Contactos
- Oportunidades
- Actividades
- Cotizaciones
- Facturas
- Productos
- Casos
- Leads
- Documentos
- Usuarios
- Modulos personalizados `sie_*`

## Validar

```bash
npm run check
```

Ese comando regenera la migracion y compila la aplicacion.
