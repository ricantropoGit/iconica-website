# 📋 Icónica — Estado Actual del Proyecto (Deployment Vercel)

**Fecha:** 6 de Junio, 2026  
**Stack:** Vercel + Google Apps Script + Stripe  
**Estado General:** ✅ 70% completado

---

## ✅ Completado

### 1. GitHub
- ✅ Repositorio creado: `ricantropoGit/iconica-website`
- ✅ Código sincronizado (último commit: `8375201`)
- ✅ Configurado SSH para autenticación segura
- ✅ Secretos (Stripe keys) removidos del historial
- ✅ `.gitignore` configurado (`node_modules`, `.env*`, `.vercel`)

### 2. Vercel
- ✅ Proyecto creado: `iconica-website.vercel.app`
- ✅ GitHub conectado → Auto-deploy activo
- ✅ Variables de entorno: `STRIPE_WEBHOOK_SECRET` configurada
- ✅ Deployments automáticos en cada push a `main`

### 3. Google Apps Script
- ✅ Backend publicado como Web App
- ✅ Webhook de Stripe configurado
- ✅ Carpetas de Drive creadas (`/originales`, `/Prueba`, `/editadas`)
- ✅ Sheet de registros funcional

### 4. Stripe
- ✅ Dashboard conectado
- ✅ Webhook configurado: `checkout.session.completed`
- ✅ Signing Secret (`whsec_...`) almacenado en Vercel

---

## ⏳ Pendiente

### 1. Dominio Propio (CRÍTICO)
- ⏳ **URL del dominio:** ❓ (no especificada aún)
- ⏳ Proveedor: ❓ (GoDaddy, Namecheap, Google Domains, etc.)
- ⏳ Registros DNS: No configurados
- ⏳ SSL/HTTPS: Automático en Vercel (una vez conectado)

**Acción requerida:** Proporcionar dominio y proveedor

### 2. Actualizar URLs en Google Apps Script
- ⏳ `success_url` (sesión Stripe)
- ⏳ `cancel_url` (sesión Stripe)
- ⏳ Links de descarga en email al usuario
- ⏳ Links de descarga en email al admin

**URL actual:** `https://iconica-website.vercel.app`  
**URL final:** `https://[dominio]/` (pendiente)

**Acción requerida:** Una vez conectado el dominio, actualizar estas 4 URLs en `Code.gs`

### 3. Stripe — Modo Producción
- ⏳ Cambiar de **test keys** a **live keys**:
  - Actualizar `pk_live_...` en `js/paymentHandler.js`
  - Actualizar `sk_live_...` en `Code.gs`
  - Crear webhook en modo **Live** (no test)

**Estado actual:** Modo test (`pk_test_...` / `sk_test_...`)

**Acción requerida:** Cuando esté listo para lanzar oficialmente

### 4. Verificación Final
- ⏳ Prueba end-to-end completa:
  - [ ] Subir foto en formulario
  - [ ] Confirmar llegada a Drive/Sheet (status "Pendiente")
  - [ ] Ver imagen en `payment.html?id=[ID]`
  - [ ] Realizar pago con tarjeta de prueba
  - [ ] Confirmar redirección a `success.html`
  - [ ] Verificar actualización de Sheet (status "Pagada")
  - [ ] Confirmar llegada de emails
  - [ ] Verificar descarga de imágenes editadas

---

## 🔄 Flujo de Trabajo Actual

```
1. Editar archivos localmente
   ↓
2. git add . && git commit -m "mensaje" && git push origin main
   ↓
3. GitHub recibe el push
   ↓
4. Vercel detecta cambio automáticamente
   ↓
5. Vercel redespliega en 2-5 minutos
   ↓
6. Cambios visibles en https://iconica-website.vercel.app
```

---

## 📁 Estructura del Proyecto

```
iconica-website/
├── index.html              ✅ Página principal
├── payment.html            ✅ Página de pago
├── confirmation.html       ✅ Confirmación de envío
├── success.html            ✅ Éxito de pago
├── css/                    ✅ Estilos
├── js/
│   └── paymentHandler.js   ✅ Lógica Stripe (keys test)
├── images/
│   └── Prueba/             ✅ Imágenes de prueba
├── api/
│   ├── submit.js           ✅ Envío de fotos
│   └── webhook.js          ✅ Webhook de Stripe
├── .gitignore              ✅ Configurado
└── ESTADO_DEPLOYMENT.md    ✅ Este archivo
```

---

## 🔗 URLs Importantes

| Recurso | URL |
|---------|-----|
| **Vercel Project** | https://vercel.com/ricantropo-s-projects/iconica-website |
| **Vercel Deploy** | https://iconica-website.vercel.app |
| **GitHub Repo** | https://github.com/ricantropoGit/iconica-website |
| **Stripe Dashboard** | https://dashboard.stripe.com |
| **Google Apps Script** | (URL del Web App `/exec`) |

---

## 📋 Checklist de Próximos Pasos

### Inmediato (Esta sesión)
- [ ] Proporcionar dominio propio
- [ ] Configurar registros DNS en proveedor
- [ ] Conectar dominio a Vercel
- [ ] Actualizar URLs en `Code.gs`
- [ ] Re-desplegar Google Apps Script

### Antes de Lanzamiento Oficial
- [ ] Cambiar Stripe a modo producción (live keys)
- [ ] Crear webhook en Stripe (Live)
- [ ] Actualizar `STRIPE_WEBHOOK_SECRET` en Vercel (live)
- [ ] Prueba end-to-end completa

### Documentación
- [ ] Crear README.md con instrucciones de uso
- [ ] Documentar API endpoints

---

## 🚀 Resumen Rápido

**¿Qué falta?**
1. **Dominio** — ¿Cuál es tu dominio?
2. **Actualizar URLs** — En Google Apps Script
3. **Pruebas** — End-to-end completo

**¿Qué está listo?**
- ✅ Código en GitHub
- ✅ Vercel desplegando automáticamente
- ✅ Variables de entorno configuradas
- ✅ Stripe webhook básico activo

---

## 📞 Notas

- **Stripe en test mode:** Las transacciones son de prueba. Usar tarjeta `4242 4242 4242 4242`
- **Plan Vercel:** Hobby (gratuito). Considerar **Pro** ($20/mes) para uso comercial
- **Auto-deploy:** Cada `git push origin main` redespliega automáticamente

---

**Próximo paso:** Proporciona tu dominio propio para continuar. 🎯
