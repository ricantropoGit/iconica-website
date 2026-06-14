# 🚀 Icónica AI — Status: Transición a Producción (LIVE)

**Fecha:** 2026-06-09
**Estado general:** Sistema 100% funcional en modo TEST · Transición a LIVE ~70% completada
**Sitio en producción:** https://iconica24.com

---

## 🎯 Objetivo de esta fase

Pasar el sistema de pagos de **Stripe Test Mode** a **Stripe Live Mode** para procesar
transacciones reales, haciendo primero una prueba en vivo con un producto temporal de $1 USD.

---

## ✅ COMPLETADO en la transición

### 1. Dominio propio
- ✅ `iconica24.com` comprado y conectado a Vercel
- ✅ HTTPS automático activo
- ✅ Vercel aliasea cada deploy a `iconica24.com`

### 2. Webhook LIVE configurado en Stripe
- ✅ Endpoint creado en Stripe Dashboard (modo Live)
- ✅ URL: `https://iconica24.com/api/webhook`
- ✅ Eventos suscritos: `checkout.session.completed` + `charge.succeeded`
- ✅ Scope: "Your account" · API version: `2026-05-27.dahlia`

### 3. Claves actualizadas
| Clave | Ubicación | Estado |
|-------|-----------|--------|
| `pk_live_...` (Publishable) | `js/paymentHandler.js` línea 7 | ✅ Actualizada |
| `whsec_...` (Webhook Secret LIVE) | Vercel → Environment Variables | ✅ Configurada |
| `sk_live_...` (Secret Key) | `Code.gs` (Google Apps Script) | ⏳ **PENDIENTE** |

> ⚠️ **Regla de seguridad:** la `sk_live` va ÚNICAMENTE en Code.gs.
> Nunca en Vercel, nunca en el frontend, nunca en GitHub.

### 4. Google Apps Script redesplegado
- ✅ URL actual (actualizada en los 4 archivos):
```
https://script.google.com/macros/s/AKfycbz61yAQ67vRq1hz0-OErxZhzgtDUpFFeaOfWhcIuP9WpNBrrjp9rokz7IWLJ_oekRs/exec
```
- Archivos que la usan: `js/paymentHandler.js` · `success.html` · `api/submit.js` · `api/webhook.js`

### 5. Deploy a Vercel realizado
- ✅ Último deploy incluye: URLs nuevas + pk_live + webhook secret live
- ✅ Método de deploy: **Vercel CLI** (`vercel --prod`) — ya NO usamos GitHub

---

## ⏳ PENDIENTE para completar la transición

### Paso 1: Clave secreta LIVE en Code.gs
```javascript
// En Code.gs, reemplazar:
const STRIPE_SECRET_KEY = 'sk_test_51Tdx5C...';   // ❌ test actual
// Por:
const STRIPE_SECRET_KEY = 'sk_live_...';           // ✅ live
```

### Paso 2: Crear producto temporal de prueba ($1 USD)
En Stripe Dashboard (modo **Live**) → Products → Add product:
```
Name:    Prueba Icónica
Price:   $1.00 USD
Billing: One-time
```
Copiar el **Price ID** (`price_xxxxx...`).

### Paso 3: Refactorizar precio en Code.gs (recomendado)
Cambiar de precio hardcodeado a Price ID de Stripe, para poder cambiar
precios desde el Dashboard **sin redesplegar**:

```javascript
// ❌ Método actual (hardcodeado en createStripeSession):
'line_items[0][price_data][currency]': 'usd',
'line_items[0][price_data][unit_amount]': '6900',
'line_items[0][price_data][product_data][name]': 'Icónica - 3 Fotos',

// ✅ Método nuevo (producto centralizado en Stripe):
const STRIPE_PRICE_ID = 'price_xxxxx';   // ← constante junto a las credenciales
'line_items[0][price]': STRIPE_PRICE_ID,
```

### Paso 4: Deploy de Code.gs
- Google Apps Script → Deploy → New deployment (Web app · Execute as me · Anyone)
- ⚠️ Si la URL cambia → actualizar los 4 archivos → `vercel --prod`

### Paso 5: Prueba EN VIVO con tarjeta real ($1 USD)
Checklist de la prueba:
- [ ] Abrir `https://iconica24.com/payment.html?id=[ID_REAL]`
- [ ] La foto de prueba carga desde `/images/Prueba/[ID].jpg`
- [ ] Click "Comprar Ahora" → redirige a Stripe Checkout (monto $1.00)
- [ ] Pagar con tarjeta de crédito real
- [ ] Redirige a `success.html` con número de transacción
- [ ] Google Sheet: status cambia a **"Pagada"** automáticamente
- [ ] Email de confirmación llega al usuario
- [ ] Email de notificación llega al admin
- [ ] Stripe Dashboard (Live) muestra el pago sin errores de webhook (200 OK)

### Paso 6: Producto final
- [ ] Borrar/archivar producto de $1 USD
- [ ] Crear producto definitivo (ej. "Icónica - 3 Fotos" — definir precio final)
- [ ] Actualizar `STRIPE_PRICE_ID` en Code.gs → Deploy
- [ ] **🎊 GO LIVE**

---

## 🏗️ Arquitectura y flujo de trabajo actual

### Carpetas
| Carpeta | Rol |
|---------|-----|
| `~/iconica-website/` | **Carpeta de trabajo activa** (de aquí se deploya) |
| Google Drive `…/RETRATOS-Ai/WEBSITE/` | Respaldo (backup manual) |

### Flujo de deploy
```
1. Editar archivos en ~/iconica-website/
2. cd ~/iconica-website && vercel --prod
3. Listo en https://iconica24.com (1-2 min)
```
> GitHub quedó descartado para deploys (errores HTTP 400 en push).
> El repo local sigue existiendo pero NO se sincroniza con GitHub.

### Backend (Google Apps Script)
- Cambios en `Code.gs` se editan en el editor de Apps Script
- Requieren **Deploy** propio (independiente de Vercel)
- Si la URL del deployment cambia → actualizar 4 archivos + `vercel --prod`

---

## 🔧 Fixes técnicos clave de esta sesión

1. **Webhook 401 RESUELTO:** `api/webhook.js` ahora usa `bodyParser: false` —
   Stripe firma los bytes crudos del body; con el parser activo la firma nunca coincidía.
   Verificación con esquema oficial (`t=timestamp`, `v1=firma`, HMAC-SHA256, timing-safe).
2. **Webhook espera a Apps Script antes de responder** (el fire-and-forget puro no es
   confiable en Vercel: congela la función al responder).
3. **paymentHandler.js:** eliminado listener de `cancelFeedbackBtn` (botón inexistente
   en el nuevo diseño) que rompía TODO el script e impedía cargar la imagen.
4. **Bug de clase CSS corregido:** el JS quitaba `loading` pero la clase real es
   `is-loading` — la imagen quedaba recortada a cuadrado 1:1 para siempre.
5. **payment.html rediseñado:** hero a dos columnas, imagen con proporción natural.
6. **Imágenes de prueba:** se cargan desde `/images/Prueba/[SUBMISSIONID].jpg` (local,
   sin CORS de Google Drive).

---

## 📋 Configuración de referencia

### Stripe
```
Webhook LIVE endpoint:  https://iconica24.com/api/webhook
Eventos:                checkout.session.completed, charge.succeeded
Precio actual (test):   $69 USD hardcodeado en Code.gs (unit_amount: 6900)
Tarjeta de prueba TEST: 4242 4242 4242 4242 · 12/25 · 123 (solo Test Mode)
```

### Google
```
SHEET_ID:           12X7ZKTouQCULw3LTNDm3QGo0Tpkb1cleC10R_htGJjM
FOLDER_ID:          1Bhuokg13AnOdE524wx_UARa4_iyF6thu   (Originales)
EDITED_FOLDER_ID:   1PIocb65sp_rGYi3rs3mqFQoKEj97ZY5b   (Editadas)
PREVIEW (local):    /images/Prueba/[SUBMISSIONID].jpg
Límite de upload:   3 MB (validado en Code.gs)
```

### Vercel
```
Proyecto:   iconica-website (ricantropo-s-projects)
Dominios:   iconica24.com · iconica-website.vercel.app
Env vars:   STRIPE_WEBHOOK_SECRET (live) ✅
Deploy:     vercel --prod (desde ~/iconica-website)
```

---

## 🗺️ Temas pospuestos (no bloquean el go-live)

1. **Descargas en success.html:** las 3 fotos finales deben servirse desde
   `EDITED_FOLDER_ID` (Drive) — mismo problema CORS que tuvimos con la preview.
   Solución acordada pendiente de implementar: copiarlas a `/images/Editadas/` local
   (u Opción A: proxy vía Apps Script como blob).
2. **Panel de administración** para subir fotos editadas sin acceso manual a carpetas.
3. **Limpieza de archivos .bak** en `~/iconica-website` (paymentHandler.bak.js,
   payment.bak.html, etc.) — no afectan, pero ensucian el deploy.
4. **Identidad de git local** sin configurar (`git config --global user.name/email`) —
   solo relevante si retomamos GitHub.

---

**Versión:** TRANSICION.1
**Siguiente hito:** Prueba en vivo de $1 USD con tarjeta real
**Al completarla:** producto final + GO LIVE 🎊
