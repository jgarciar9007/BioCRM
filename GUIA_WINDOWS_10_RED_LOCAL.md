# Guia paso a paso para ejecutar BIOCRM en Windows 10 y acceder desde la red local

Esta guia explica como dejar BIOCRM funcionando en una PC con Windows 10 y como abrirlo desde otros equipos de la misma red usando la IP de la PC servidor.

BIOCRM es una aplicacion local con:

- Frontend React/Vite en el puerto `5173`.
- API Node/Express en el puerto `4177`.
- Base de datos SQLite en `data\biocrm.sqlite`.
- Migracion inicial desde `respaldo_suitecrm.sql`.

La forma recomendada para red local es publicar el frontend en `0.0.0.0:5173`. El navegador de las otras PCs entra por `http://IP_DE_LA_PC:5173` y Vite reenvia internamente las llamadas `/api` hacia la API local en `127.0.0.1:4177`.

## 1. Requisitos de la PC

Recomendado:

- Windows 10 de 64 bits.
- 8 GB de RAM o mas.
- 5 GB libres en disco como minimo.
- La PC debe permanecer encendida mientras otros usuarios usen BIOCRM.
- La PC y los demas equipos deben estar en la misma red local.
- La red de Windows debe estar marcada como `Privada`, no `Publica`.

No hace falta instalar Apache, PHP, XAMPP, MySQL ni SQLite por separado. Este proyecto usa Node.js y la base SQLite integrada desde `node:sqlite`.

## 2. Programas que hay que instalar

Instala estos programas en la PC que funcionara como servidor:

1. Node.js 22.x o superior compatible con `node:sqlite`.
   - Este proyecto fue revisado con `node v22.19.0` y `npm v10.9.3`.
   - No uses Node.js 20, porque el backend importa `node:sqlite`.

2. Git para Windows, opcional.
   - Solo es necesario si vas a descargar o actualizar el proyecto desde Git.
   - Si recibes el proyecto como carpeta comprimida, no es obligatorio.

3. Visual Studio Code, opcional.
   - Util para editar archivos, revisar logs o hacer cambios.

4. Un navegador moderno.
   - Microsoft Edge, Google Chrome o Firefox.

Despues de instalar Node.js, cierra y abre PowerShell para que Windows reconozca `node`, `npm` y `npx`.

Verifica la instalacion:

```powershell
node -v
npm -v
```

Debe aparecer una version de Node 22 o superior.

## 3. Copiar el proyecto a la PC servidor

Recomendado: usa una ruta simple, por ejemplo:

```text
C:\BioCRM
```

Tambien puedes usar otra ruta, por ejemplo:

```text
D:\Proyectos de programacion\BioCRM
```

En esta guia se usara `C:\BioCRM` como ejemplo. Si tu carpeta esta en otra ruta, cambia los comandos.

La carpeta debe contener como minimo:

```text
package.json
package-lock.json
index.html
vite.config.js
server\index.mjs
scripts\import-suitecrm.mjs
src\
data\
respaldo_suitecrm.sql
```

El archivo `respaldo_suitecrm.sql` es necesario para generar la base SQLite si `data\biocrm.sqlite` no existe o si quieres regenerar la migracion.

## 4. Instalar dependencias del proyecto

Abre PowerShell en la carpeta del proyecto:

```powershell
cd C:\BioCRM
```

Instala las dependencias:

```powershell
npm ci
```

Si por alguna razon `npm ci` falla porque no existe `package-lock.json`, usa:

```powershell
npm install
```

## 5. Generar la base de datos SQLite

Si ya existe `data\biocrm.sqlite` y vas a conservar esa base, no regeneres la migracion.

Si es una instalacion nueva o quieres crear la base desde `respaldo_suitecrm.sql`, ejecuta:

```powershell
npm run import:suitecrm
```

El importador crea:

```text
data\biocrm.sqlite
data\biocrm-data.json
data\migration-report.json
```

Importante: `npm run import:suitecrm` recrea `data\biocrm.sqlite`. Si ya hay cambios hechos desde BIOCRM, deten la API y respalda `data\biocrm.sqlite` antes de regenerar.

## 6. Usuario inicial

Usuario inicial:

```text
Usuario: admin
Contrasena: BioCRM2026!
```

Para una instalacion nueva, puedes cambiar la contrasena antes de generar SQLite:

```powershell
$env:BIOCRM_ADMIN_PASSWORD="UnaContrasenaSegura"
npm run import:suitecrm
```

Ese cambio aplica a la base que se genera en ese momento. Si ya existe una base con datos operativos, no la regeneres sin respaldo porque se reemplaza.

## 7. Probar que funciona en la misma PC

Abre dos ventanas de PowerShell.

Ventana 1, API:

```powershell
cd C:\BioCRM
npm run dev:api
```

Debe quedar corriendo en:

```text
http://127.0.0.1:4177
```

Ventana 2, frontend publicado para la red local:

```powershell
cd C:\BioCRM
npx vite --host 0.0.0.0 --port 5173 --strictPort
```

En la misma PC abre:

```text
http://127.0.0.1:5173
```

No uses `npm run dev` para red local, porque en este proyecto ese script levanta Vite con `--host 127.0.0.1` y eso solo acepta conexiones desde la misma PC.

## 8. Obtener la IP de la PC servidor

En la PC servidor abre PowerShell o CMD y ejecuta:

```powershell
ipconfig
```

Busca el adaptador activo, por ejemplo `Adaptador de LAN inalambrica Wi-Fi` o `Adaptador de Ethernet`, y copia la linea `Direccion IPv4`.

Ejemplo:

```text
Direccion IPv4 . . . . . . . . . . . : 192.168.1.50
```

En ese caso, desde otra PC de la misma red entra a:

```text
http://192.168.1.50:5173
```

## 9. Abrir el firewall de Windows

En la PC servidor abre PowerShell como Administrador y ejecuta:

```powershell
New-NetFirewallRule -DisplayName "BIOCRM Web 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private
```

Con la configuracion recomendada solo necesitas abrir el puerto `5173`, porque la API queda accesible internamente desde Vite.

Si tambien decides exponer la API directamente desde la red local, abre tambien el puerto `4177`:

```powershell
New-NetFirewallRule -DisplayName "BIOCRM API 4177" -Direction Inbound -Protocol TCP -LocalPort 4177 -Action Allow -Profile Private
```

## 10. Confirmar que la red sea privada

En PowerShell como Administrador:

```powershell
Get-NetConnectionProfile
```

Si el perfil aparece como `Public`, cambialo a `Private`. Primero identifica el nombre de la interfaz en la salida anterior. Luego ejecuta, ajustando `Wi-Fi` o `Ethernet` segun corresponda:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

o:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private
```

## 11. Fijar la IP de la PC servidor

Para que la direccion no cambie, lo recomendado es reservar la IP desde el router:

1. Entra al panel del router.
2. Busca DHCP, LAN o Address Reservation.
3. Reserva la IP actual de la PC servidor, por ejemplo `192.168.1.50`, asociada a la direccion MAC de la tarjeta de red.
4. Reinicia la conexion o la PC si el router lo pide.

Alternativa desde Windows:

1. Abre `Panel de control`.
2. Entra a `Centro de redes y recursos compartidos`.
3. Abre `Cambiar configuracion del adaptador`.
4. Clic derecho sobre `Wi-Fi` o `Ethernet`.
5. Entra a `Propiedades`.
6. Selecciona `Protocolo de Internet version 4 (TCP/IPv4)`.
7. Marca `Usar la siguiente direccion IP`.
8. Configura:
   - IP: una IP libre de tu red, por ejemplo `192.168.1.50`.
   - Mascara: normalmente `255.255.255.0`.
   - Puerta de enlace: IP del router, por ejemplo `192.168.1.1`.
   - DNS: puedes usar el router, por ejemplo `192.168.1.1`, o DNS publicos como `8.8.8.8`.

La reserva por router es mas segura porque evita conflictos con otras PCs.

## 12. Probar desde otra PC

Desde otra PC de la misma red:

1. Abre el navegador.
2. Entra a:

```text
http://192.168.1.50:5173
```

3. Cambia `192.168.1.50` por la IP real de la PC servidor.
4. Inicia sesion con el usuario configurado.

Tambien puedes probar conectividad desde PowerShell en la PC cliente:

```powershell
Test-NetConnection 192.168.1.50 -Port 5173
```

Debe mostrar:

```text
TcpTestSucceeded : True
```

## 13. Dejarlo arrancando automaticamente al iniciar sesion

Windows 10 incluye el Programador de tareas. Puedes crear dos tareas: una para la API y otra para el frontend.

### Tarea 1: BIOCRM API

1. Presiona `Win + R`.
2. Escribe:

```text
taskschd.msc
```

3. Clic en `Crear tarea`.
4. Nombre: `BIOCRM API`.
5. Pestana `Desencadenadores`: crea uno nuevo `Al iniciar sesion`.
6. Pestana `Acciones`: crea una accion nueva:
   - Programa o script:

```text
C:\Program Files\nodejs\npm.cmd
```

   - Agregar argumentos:

```text
run dev:api
```

   - Iniciar en:

```text
C:\BioCRM
```

7. Guarda la tarea.

### Tarea 2: BIOCRM Web LAN

1. Crea otra tarea.
2. Nombre: `BIOCRM Web LAN`.
3. Desencadenador: `Al iniciar sesion`.
4. Accion:
   - Programa o script:

```text
C:\Program Files\nodejs\npx.cmd
```

   - Agregar argumentos:

```text
vite --host 0.0.0.0 --port 5173 --strictPort
```

   - Iniciar en:

```text
C:\BioCRM
```

5. Guarda la tarea.

Despues reinicia sesion o ejecuta ambas tareas manualmente desde el Programador para probarlas.

## 14. Arranque manual rapido

Si prefieres iniciar BIOCRM manualmente, usa siempre dos ventanas:

Ventana 1:

```powershell
cd C:\BioCRM
npm run dev:api
```

Ventana 2:

```powershell
cd C:\BioCRM
npx vite --host 0.0.0.0 --port 5173 --strictPort
```

Mientras esas ventanas esten abiertas, BIOCRM estara disponible en:

```text
http://IP_DE_LA_PC:5173
```

## 15. Validar instalacion y compilacion

Para validar migracion y frontend:

```powershell
cd C:\BioCRM
npm run check
```

Ese comando ejecuta:

```text
npm run import:suitecrm
npm run build
```

Precaucion: `npm run check` tambien regenera la base SQLite. No lo uses sobre una base con cambios operativos sin hacer respaldo.

Si solo quieres compilar el frontend:

```powershell
npm run build
```

## 16. Respaldo

Antes de respaldar, cierra las ventanas de la API y del frontend.

Respalda estos archivos:

```text
data\biocrm.sqlite
data\biocrm.sqlite-wal
data\biocrm.sqlite-shm
data\biocrm-data.json
data\migration-report.json
respaldo_suitecrm.sql
```

Si la API esta detenida correctamente, los archivos `biocrm.sqlite-wal` y `biocrm.sqlite-shm` pueden no ser necesarios, pero es mas seguro copiarlos si existen.

Guarda el respaldo en un disco externo, NAS o carpeta compartida con fecha:

```text
BIOCRM_backup_2026-06-09
```

## 17. Solucion de problemas

### La otra PC no abre `http://IP:5173`

Revisa:

1. Que la PC servidor este encendida.
2. Que la ventana de Vite siga abierta.
3. Que hayas usado `npx vite --host 0.0.0.0 --port 5173 --strictPort`.
4. Que el firewall permita el puerto `5173`.
5. Que la red este como `Privada`.
6. Que ambas PCs esten en la misma red.
7. Que el router no tenga aislamiento de clientes Wi-Fi activado. En algunos routers aparece como `AP Isolation`, `Client Isolation` o `Wireless Isolation`.

### El navegador abre la pagina pero sale error de API

Revisa que la API este corriendo:

```powershell
cd C:\BioCRM
npm run dev:api
```

En la PC servidor prueba:

```text
http://127.0.0.1:4177/api/health
```

Debe responder con un JSON similar a:

```json
{
  "ok": true
}
```

### El puerto 5173 esta ocupado

Comprueba que proceso lo usa:

```powershell
netstat -ano | findstr :5173
```

Si hay otra instancia vieja de Node/Vite, cierrala desde el Administrador de tareas o reinicia la PC.

No cambies el puerto de la API `4177` sin actualizar tambien `vite.config.js`, porque el proxy del frontend apunta a:

```text
http://127.0.0.1:4177
```

### Sale `No existe data/biocrm.sqlite`

Genera la base:

```powershell
cd C:\BioCRM
npm run import:suitecrm
```

Verifica que exista:

```powershell
dir data\biocrm.sqlite
```

### `node:sqlite` no existe

Estas usando una version vieja de Node.js. Instala Node.js 22.x o superior, cierra PowerShell, abre otra ventana y verifica:

```powershell
node -v
```

### `npm ci` falla

Prueba limpiar e instalar de nuevo:

```powershell
cd C:\BioCRM
npm install
```

Si la carpeta `node_modules` esta corrupta, cierra Node/Vite, elimina `node_modules` y ejecuta:

```powershell
npm ci
```

### La IP cambia despues de reiniciar

Configura una reserva DHCP en el router para la PC servidor o fija una IP estatica en Windows.

## 18. Opcion avanzada: exponer la API directamente en la red local

La configuracion recomendada no expone la API directamente; solo expone el frontend en `5173`.

Si necesitas que otra herramienta consuma la API desde otra PC usando `http://IP_DE_LA_PC:4177`, hay que cambiar el backend para escuchar en todas las interfaces.

En `server\index.mjs`, cambia esta parte:

```js
app.listen(port, "127.0.0.1", () => {
  console.log(`BIOCRM API SQLite en http://127.0.0.1:${port}`);
});
```

por:

```js
const host = process.env.HOST || "127.0.0.1";

app.listen(port, host, () => {
  console.log(`BIOCRM API SQLite en http://${host}:${port}`);
});
```

Luego puedes iniciar la API asi:

```powershell
$env:HOST="0.0.0.0"
npm run dev:api
```

Y abrir el firewall del puerto `4177`:

```powershell
New-NetFirewallRule -DisplayName "BIOCRM API 4177" -Direction Inbound -Protocol TCP -LocalPort 4177 -Action Allow -Profile Private
```

No expongas BIOCRM directamente a Internet. Esta guia es solo para red local.

