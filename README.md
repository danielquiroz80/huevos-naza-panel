# Huevos de la Naza · Panel de administración

App web (instalable en el celular) para que el administrador vea y gestione el negocio sin tocar la base de datos.

**Secciones**

| Sección | Qué hace |
|---|---|
| Inicio | Ventas de la semana vs. la anterior, pedidos abiertos, canastas por entregar, por cobrar, alertas (stock, comprobantes, casos, barrios no reconocidos) y qué alistar por día |
| Pedidos | Filtros (abiertos, por cobrar, entregados, cancelados), búsqueda, día de entrega, ruta en Google Maps; detalle con productos, pagos y acciones: **en camino, entregado, cancelar, registrar pago, verificar comprobante** (avisan al cliente igual que los comandos de Telegram) |
| Clientes | Frecuentes, **dejaron de comprar**, nuevos, con pedido fijo; historial y conversación con el bot |
| Productos | Precio, stock, comprometido, disponible, lista de espera y margen; editar con **confirmación y aviso de cambios grandes**; nuevo producto; registrar compra; movimientos de inventario |
| Compras | Inversión del mes, costo promedio, compras por semana y por proveedor, historial |
| Estadísticas | Ventas por semana, productos y margen, municipios y barrios, estados, días de entrega, clientes nuevos (4 semanas a 1 año) |
| Planeación | Demanda estimada de la próxima entrega por producto (pedidos + pedidos fijos + promedio + lista de espera) y cuánto conseguir |
| Negocio | Casos de clientes (resolver con mensaje), cobertura por barrio, configuración, personas con acceso y registro de cambios |

## Roles

| Rol | Ve |
|---|---|
| Admin | Todo + usuarios, actividad (ingresos y cambios), configuración, compras y finanzas |
| Operador | Pedidos y Entregas |
| Repartidor | Solo "Mi ruta" |

Inicio de sesión con **usuario y contraseña** (el Admin crea los usuarios en Administración → Usuarios). Contraseñas: mínimo 6 caracteres, letras y números, una mayúscula y un carácter especial. Recuperación por correo si el usuario tiene correo registrado; si no, el Admin asigna una nueva. Opcional: **desbloqueo con huella/rostro** en Mi cuenta.

## Entregas

- **Planear ruta**: día, repartidor, punto de salida (dirección o ubicación actual), orden automático (Google Maps si hay clave, si no aproximado), reordenar a mano, hoja de carga, mapa e inicio del recorrido.
- **Mi ruta (repartidor)**: parada actual con navegación (Google Maps/Waze), llamar/WhatsApp, indicaciones, **Entregado** (foto y ubicación opcionales) o **No entregado** con motivo.
- Avisos automáticos por Telegram: inicio del recorrido (turno y hora aproximada), "eres el siguiente", entregado y no entregado.
- **No entregados**: reprogramar o cancelar.

## Cómo funciona

```
Navegador (esta app) ──► Supabase (datos, inicio de sesión, permisos RLS)
        │
        ├──► Función "admin-usuarios" (crear usuarios y contraseñas)
        └──► n8n "HN - Panel acciones" ──► "HN - Comandos del equipo" / "HN - Entregas" (avisos al cliente)
n8n "HN - Hoja espejo Google Sheets" (6 a. m.) ──► Google Sheets (solo lectura)
```

- Sin compilación ni dependencias instaladas: HTML + módulos JavaScript (Preact + htm y supabase-js cargados desde esm.sh). Se publica tal cual.
- Solo entran los correos de la tabla `administradores` (rol `dueno` u `operador`). Sin borrados desde el panel. Cada cambio queda en `registro_panel` con el correo de quien lo hizo.
- La clave de `config.js` es la **publicable** (segura en el navegador). La clave secreta nunca va en el código.

## Publicar en Cloudflare Pages (gratis)

1. Entra a https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Elige el repositorio `huevos-naza-panel`.
3. Configuración de compilación: *Framework preset* **None**, *Build command* **vacío**, *Build output directory* **/**.
4. **Save and Deploy**. Te da una dirección tipo `https://huevos-naza-panel.pages.dev`.

Cada cambio que se suba a GitHub se publica solo.

## Configurar el inicio de sesión en Supabase (una vez)

En https://supabase.com/dashboard/project/grvdcfbexzgfkadtstow/auth/url-configuration:

- **Site URL**: la dirección de Cloudflare (ej. `https://huevos-naza-panel.pages.dev`).
- **Redirect URLs**: agrega la misma dirección.

Opcional, para entrar con código de 6 dígitos (útil con la app instalada en el celular): en **Authentication → Emails → Magic Link** agrega `{{ .Token }}` al texto del correo.

> El correo gratuito de Supabase permite pocos envíos por hora. Si varias personas entran seguido, configura un SMTP propio (Authentication → Emails → SMTP).

## Dar acceso a otra persona

En Supabase → Table editor → `administradores` → Insert: correo en minúsculas, nombre y rol (`dueno` o `operador`). El operador no puede cambiar la configuración del negocio.

## Instalar en el celular

Abre la dirección en el celular → menú del navegador → **Agregar a pantalla de inicio** (Android también muestra "Instalar app").
