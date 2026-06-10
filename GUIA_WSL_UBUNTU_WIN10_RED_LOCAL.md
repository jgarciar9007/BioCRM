# Guia para ejecutar BIOCRM en WSL Ubuntu sobre Windows 10 y acceder desde la red local

Esta guia deja BIOCRM corriendo dentro de Ubuntu/WSL en una PC con Windows 10, pero accesible desde otras PCs de la misma red usando la IP de Windows.

BIOCRM usa:

- Frontend React compilado y API Node/Express en el mismo puerto `5173` para publicacion.
- API Node/Express en el puerto `4177` solo cuando trabajas en modo desarrollo.
- SQLite en `data/biocrm.sqlite`.
- Migracion inicial desde `respaldo_suitecrm.sql`.

En Windows 10 con WSL2, Ubuntu queda detras de una red NAT. Por eso, para entrar desde otra PC no basta con abrir Vite en `0.0.0.0`: tambien hay que crear un reenvio de puerto en Windows con `netsh interface portproxy`.

La configuracion recomendada para publicar es:

- BIOCRM escucha dentro de WSL en `0.0.0.0:5173`.
- La API queda disponible en el mismo origen bajo `/api`.
- Windows reenvia `IP_DE_WINDOWS:5173` hacia `IP_DE_WSL:5173`.
- Las otras PCs entran por `http://IP_DE_WINDOWS:5173`.

No expongas BIOCRM directamente a Internet. Esta guia es solo para red local.

## 1. Requisitos

En la PC servidor:

- Windows 10 de 64 bits.
- WSL2 instalado.
- Ubuntu instalado en WSL.
- 8 GB de RAM o mas recomendado.
- 5 GB libres como minimo.
- Red de Windows marcada como `Privada`.
- La PC debe permanecer encendida mientras otros usuarios usen BIOCRM.

En las PCs cliente:

- Estar en la misma red local.
- Navegador moderno: Edge, Chrome o Firefox.

## 2. Instalar o revisar WSL2

Abre PowerShell como Administrador y ejecuta:

```powershell
wsl --status
wsl -l -v
```

La distribucion Ubuntu debe aparecer con version `2`.

Si todavia no tienes WSL/Ubuntu:

```powershell
wsl --install -d Ubuntu
```

Despues reinicia Windows si el instalador lo pide.

Si Ubuntu aparece como WSL1, cambialo a WSL2:

```powershell
wsl --set-default-version 2
wsl --set-version Ubuntu 2
```

## 3. Preparar Ubuntu

Abre Ubuntu desde el menu Inicio y actualiza paquetes:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git build-essential rsync
```

## 4. Instalar Node.js dentro de Ubuntu

Este proyecto usa `node:sqlite`, asi que usa Node.js 22 o superior dentro de WSL.

Instala Node con `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Cierra y vuelve a abrir Ubuntu, o carga `nvm` en la terminal actual:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

Instala Node 22:

```bash
nvm install 22
nvm use 22
nvm alias default 22
```

Verifica:

```bash
node -v
npm -v
```

Debe aparecer Node `v22.x` o superior.

## 5. Copiar el proyecto al filesystem de Ubuntu

Recomendado: trabajar desde el disco de Linux, no directamente desde `/mnt/c` o `/mnt/d`, porque WSL rinde mejor y evita problemas de permisos/bloqueos.

Si tu proyecto esta en:

```text
D:\Proyectos de Programacion\BioCRM\BioCRM
```

En Ubuntu ejecuta:

```bash
mkdir -p ~/proyectos/BioCRM
rsync -av \
  --exclude node_modules \
  --exclude dist \
  "/mnt/c/Proyectos de Programacion/BioCRM/BioCRM/" \
  "$HOME/proyectos/BioCRM/"
cd ~/proyectos/BioCRM
```

Si lo tienes en otra ruta de Windows, ajusta la ruta `/mnt/d/...`.

Importante: `node_modules` instalado en Windows no sirve dentro de Linux. Siempre instala dependencias de nuevo dentro de WSL.

## 6. Instalar dependencias

Dentro de Ubuntu:

```bash
cd ~/proyectos/BioCRM
npm ci
```

Si `npm ci` falla porque no existe `package-lock.json`, usa:

```bash
npm install
```

## 7. Crear o conservar la base SQLite

Si ya tienes `data/biocrm.sqlite` con datos operativos, no regeneres la migracion sin respaldo.

Para una instalacion nueva:

```bash
cd ~/proyectos/BioCRM
npm run import:suitecrm
```

Esto crea o actualiza:

```text
data/biocrm.sqlite
data/biocrm-data.json
data/migration-report.json
```

Usuario inicial:

```text
Usuario: admin
Contrasena: BioCRM2026!
```

Para cambiar la contrasena antes de generar una base nueva:

```bash
export BIOCRM_ADMIN_PASSWORD="UnaContrasenaSegura"
npm run import:suitecrm
```

## 8. Publicar y probar BIOCRM dentro de WSL

Para uso real en red local, ejecuta BIOCRM publicado en un solo proceso. Este modo compila React en `dist/` y Express sirve tanto la app como `/api` en el puerto `5173`.

En Ubuntu:

```bash
cd ~/proyectos/BioCRM
npm run serve:lan
```

Debe quedar en:

```text
http://0.0.0.0:5173
```

En la PC servidor abre el navegador de Windows y prueba:

```text
http://localhost:5173
```

Verifica tambien la API desde el navegador:

```text
http://localhost:5173/api/health
```

Debe responder un JSON con `ok: true`.

Para desarrollo con recarga rapida puedes usar:

```bash
cd ~/proyectos/BioCRM
npm run dev:wsl
```

Pero para publicar a otros usuarios usa `npm run serve:lan`.

## 9. Obtener la IP interna de WSL

En PowerShell de Windows:

```powershell
wsl hostname -I
```

Ejemplo:

```text
172.29.224.118
```

Esa IP puede cambiar cada vez que WSL se reinicia. Por eso el reenvio de puerto puede necesitar actualizarse.

## 10. Crear el reenvio de puerto hacia WSL

Abre PowerShell como Administrador y ejecuta:

```powershell
$wslIp = (wsl hostname -I).Trim().Split()[0]
netsh interface portproxy delete v4tov4 listenport=5173 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=$wslIp
netsh interface portproxy show v4tov4
```

Si el comando `delete` muestra que no existe la regla, no pasa nada. El objetivo es limpiar una regla vieja antes de crear la nueva.

Verifica que el servicio IP Helper este activo, porque `portproxy` depende de el:

```powershell
Get-Service -Name iphlpsvc | Select-Object Name, Status, StartType
Set-Service -Name iphlpsvc -StartupType Automatic
Start-Service -Name iphlpsvc
```

## 11. Abrir el firewall de Windows

En PowerShell como Administrador:

```powershell
if (-not (Get-NetFirewallRule -DisplayName "BIOCRM WSL Web 5173" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "BIOCRM WSL Web 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private
}
```

No necesitas abrir el puerto `4177` para publicacion, porque las llamadas `/api` van por el mismo puerto `5173`.

## 12. Confirmar que la red de Windows sea privada

En PowerShell como Administrador:

```powershell
Get-NetConnectionProfile
```

Si aparece `NetworkCategory : Public`, cambialo a `Private`. Ajusta el alias de la interfaz segun tu equipo:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
```

o:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private
```

## 13. Obtener la IP de Windows para entrar desde otras PCs

En PowerShell:

```powershell
ipconfig
```

Busca la `Direccion IPv4` del adaptador activo, por ejemplo:

```text
192.168.1.50
```

Desde otra PC de la red entra a:

```text
http://192.168.1.50:5173
```

Cambia `192.168.1.50` por la IP real de la PC servidor.

Para que esa direccion no cambie, reserva la IP desde el router usando DHCP reservation.

## 14. Probar desde otra PC

En una PC cliente abre PowerShell:

```powershell
Test-NetConnection 192.168.1.50 -Port 5173
```

Debe mostrar:

```text
TcpTestSucceeded : True
```

Luego abre en el navegador:

```text
http://192.168.1.50:5173
```

## 15. Cada vez que WSL reinicie

Si despues de reiniciar Windows o ejecutar `wsl --shutdown` deja de abrir desde otras PCs, actualiza el `portproxy`:

```powershell
$wslIp = (wsl hostname -I).Trim().Split()[0]
netsh interface portproxy delete v4tov4 listenport=5173 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=$wslIp
netsh interface portproxy show v4tov4
```

Tambien confirma que BIOCRM siga corriendo en Ubuntu:

```bash
cd ~/proyectos/BioCRM
npm run serve:lan
```

## 16. Arranque manual rapido

Ubuntu:

```bash
cd ~/proyectos/BioCRM
npm run serve:lan
```

PowerShell Administrador:

```powershell
$wslIp = (wsl hostname -I).Trim().Split()[0]
netsh interface portproxy delete v4tov4 listenport=5173 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=$wslIp
```

Desde otra PC:

```text
http://IP_DE_WINDOWS:5173
```

## 17. Validar compilacion

Dentro de Ubuntu:

```bash
cd ~/proyectos/BioCRM
npm run build
```

Precaucion con:

```bash
npm run check
```

Ese comando ejecuta la migracion y despues compila. Como la migracion puede recrear `data/biocrm.sqlite`, no lo uses sobre una base con cambios operativos sin respaldo.

## 18. Respaldos

Antes de respaldar, detiene la API y Vite.

Respalda:

```text
data/biocrm.sqlite
data/biocrm.sqlite-wal
data/biocrm.sqlite-shm
data/biocrm-data.json
data/migration-report.json
respaldo_suitecrm.sql
```

Si vas a trabajar desde Windows y desde WSL, define una sola carpeta como fuente principal para no pisar datos. Recomendado: mantener la copia operativa en `~/proyectos/BioCRM` dentro de Ubuntu y respaldar desde alli.

## 19. Solucion de problemas

### La PC servidor abre BIOCRM, pero las otras PCs no

Revisa:

1. BIOCRM debe correr en WSL con `npm run serve:lan`.
2. La regla `portproxy` debe apuntar a la IP WSL actual.
3. El firewall de Windows debe permitir `5173`.
4. La red de Windows debe estar como `Privada`.
5. Las PCs deben estar en la misma red.
6. El router no debe tener aislamiento Wi-Fi activado. Puede aparecer como `AP Isolation`, `Client Isolation` o `Wireless Isolation`.

### El navegador carga, pero la app muestra error de API

Confirma que BIOCRM esta corriendo publicado dentro de Ubuntu:

```bash
cd ~/proyectos/BioCRM
npm run serve:lan
```

Prueba en Windows:

```text
http://localhost:5173/api/health
```

Debe responder un JSON con `ok: true`.

Si esa URL devuelve HTML o la pantalla muestra `Unexpected token '<'`, estas sirviendo solo el frontend y no la API. Usa `npm run serve:lan` para publicar, no `vite preview`.

### `node:sqlite` no existe

Estas usando una version vieja de Node dentro de Ubuntu. Revisa:

```bash
node -v
```

Instala Node 22 o superior con `nvm`.

### `npm ci` falla por modulos de Windows

Dentro de Ubuntu:

```bash
cd ~/proyectos/BioCRM
rm -rf node_modules
npm ci
```

### El puerto 5173 esta ocupado

En Ubuntu:

```bash
ss -ltnp | grep 5173
```

Si hay otro proceso Vite, cierralo o reinicia WSL:

```powershell
wsl --shutdown
```

Luego vuelve a iniciar API, frontend y `portproxy`.

### La IP de Windows cambia

Reserva la IP de la PC servidor en el router. Es mejor que fijarla manualmente en Windows, porque evita conflictos DHCP.

## 20. Scripts utiles del proyecto

El proyecto ya incluye estos comandos:

```bash
npm run serve:lan
npm run dev:wsl
```

Usa `npm run serve:lan` para publicacion en red local. Usa `npm run dev:wsl` solo para desarrollo con recarga rapida.
