// =====================================================================
// Icónica - Payment Handler JavaScript
// Maneja la página de pago y compra de fotos editadas con Stripe
// =====================================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz61yAQ67vRq1hz0-OErxZhzgtDUpFFeaOfWhcIuP9WpNBrrjp9rokz7IWLJ_oekRs/exec';
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Tdx53HgQnamIvcbwffd6SehuYPEnyoB8cY7VM5jHnjNYyFFnrO3w6bmSdLs8Uq0cnKcQeWxd5S0j7KbhfmA7uUF00ERntvOtc';

// Inicializar Stripe
var stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

// Paquete elegido por el cliente. Se define cuando llega la oferta del
// servidor; hasta entonces no hay compra posible.
var paqueteSeleccionado = null;

// Texto original del botón de compra, para restaurarlo cuando llega el precio
var textoBotonCompra = 'Comprar Ahora';

// =====================================================================
// Lectura con reintento
// =====================================================================
// Apps Script responde a un POST con una redirección, y de vez en cuando
// esa segunda petición devuelve un 404 con una página HTML de Google.
// (Medido en producción: pasaba ~1 de cada 3.)
//
// En el navegador no se puede seguir la redirección a mano como hace
// /api/submit — pero aquí no hace falta: estas acciones sólo LEEN. No
// escriben en el Sheet ni mandan correos, así que repetir la petición
// completa es inofensivo.
//
// ⚠️ Usar SÓLO con acciones de lectura. Nunca con createStripeSession ni
// submitFeedback, que sí tienen efectos.
// =====================================================================
function leerConReintento(payload, intentos) {
  intentos = intentos || 3;

  function intentar(n) {
    return fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .catch(function (error) {
        if (n >= intentos) throw error;
        console.warn('Lectura ' + n + '/' + intentos + ' falló (' +
                     payload.action + '), reintentando…');
        return new Promise(function (resolve) {
          setTimeout(resolve, 400 * n);
        }).then(function () { return intentar(n + 1); });
      });
  }

  return intentar(1);
}

// =====================================================================
// Inicializar cuando el DOM esté listo
// =====================================================================
document.addEventListener('DOMContentLoaded', function() {
  initializePaymentPage();
});

// =====================================================================
// Inicializar la página de pago
// =====================================================================
function initializePaymentPage() {
  var params = new URLSearchParams(window.location.search);
  var submissionId = params.get('id');

  if (!submissionId) {
    showError('ID de sumisión no encontrado. Vuelve a intentar desde el email de confirmación.');
    return;
  }

  // Configurar botones. El de compra arranca deshabilitado: sin precio en
  // pantalla no debe poder iniciarse un cobro. Se habilita solo en cuanto
  // llega la oferta y queda un paquete seleccionado.
  var purchaseBtn = document.getElementById('purchaseBtn');
  textoBotonCompra = purchaseBtn.textContent;   // "Comprar Ahora"
  purchaseBtn.disabled = true;
  purchaseBtn.textContent = 'Cargando precio…';
  purchaseBtn.addEventListener('click', function() {
    handlePurchaseClick(submissionId);
  });
  document.getElementById('rejectBtn').addEventListener('click', handleRejectClick);
  document.getElementById('submitFeedbackBtn').addEventListener('click', function() {
    handleSubmitFeedback(submissionId);
  });

  // ⚠️ EL ORDEN IMPORTA. Apps Script atiende las peticiones EN SERIE: la
  // segunda espera a que termine la primera. Medido contra producción:
  //
  //   getSubmissionData sola ............ 2.4 s
  //   en paralelo con getPreviewPhoto ... 1.8 s / 4.1 s (la segunda hizo cola)
  //
  // La foto viene en base64 desde Drive y es la pesada. Si sale primero,
  // el precio se queda esperando detrás varios segundos y la página parece
  // rota. Por eso se pide PRIMERO la oferta —que es barata— y después la
  // foto, que puede llegar con calma.
  loadOferta(submissionId);
  loadSubmissionData(submissionId);
}

// =====================================================================
// Precios y condición de socio
// =====================================================================
// El sitio no tiene cifras escritas. Las pide con getSubmissionData, que
// las arma en Code.gs a partir de PAQUETES y del esquema del socio.
// =====================================================================
function loadOferta(submissionId) {
  // Devuelve la promesa: permite encadenar y hace la función verificable
  return leerConReintento({ action: 'getSubmissionData', submissionId: submissionId })
    .then(function (res) {
      if (!res.success || !res.data) {
        // El folio no existe en el Sheet, o está mal escrito
        console.warn('No se pudo cargar la oferta:', res.error);
        ofertaNoDisponible('No pudimos identificar tu propuesta desde esta liga. ' +
          'Revisa el correo que te enviamos y ábrela desde ahí, o escríbenos a ' +
          'hola@iconica24.com.');
        return;
      }

      var d = res.data;
      console.log('✓ Oferta recibida:', d);

      mostrarCondicionSocio(d);
      renderPaquetes(d.paquetes || []);

      if (!d.paquetes || !d.paquetes.length) {
        ofertaNoDisponible('No hay paquetes disponibles en este momento. ' +
          'Escríbenos a hola@iconica24.com y lo resolvemos.');
      }
    })
    .catch(function (error) {
      console.error('Error al cargar la oferta:', error);
      ofertaNoDisponible('No pudimos cargar el precio. Recarga la página; si el ' +
        'problema sigue, escríbenos a hola@iconica24.com.');
    });
}

// Sin precio no puede haber compra. Antes, si esto fallaba, la página se
// quedaba con "— MXN" y el botón "Comprar Ahora" perfectamente activo:
// el cliente habría llegado a Stripe sin saber cuánto iba a pagar.
function ofertaNoDisponible(mensaje) {
  var btn = document.getElementById('purchaseBtn');
  if (btn) {
    btn.disabled = true;
    // Se restaura el texto original: dejarlo en "Cargando precio…" haría
    // creer que sigue cargando. El aviso de abajo explica qué pasó.
    btn.textContent = textoBotonCompra;
    btn.style.opacity = '.45';
    btn.style.cursor = 'not-allowed';
  }

  var precio = document.getElementById('priceNow');
  if (precio) precio.textContent = '—';

  showError(mensaje, true);
}

// El descuento del aliado no es una casilla que el cliente llena: es una
// condición que ya está aplicada y que conviene nombrar.
function mostrarCondicionSocio(d) {
  if (!d.tieneDescuento) return;

  var aviso = document.getElementById('socioNotice');
  if (!aviso) return;

  // El porcentaje se deduce de los precios que mandó el servidor en vez de
  // escribirse aquí: si algún día cambia DESCUENTO_ALIADO en Code.gs, este
  // texto se actualiza solo. Es la misma regla que el resto de la página.
  var pct = '';
  var primero = (d.paquetes || [])[0];
  if (primero && primero.precioLista > 0) {
    pct = Math.round((1 - primero.precioFinal / primero.precioLista) * 100) + '%';
  }
  var cola = pct ? ': ' + pct + ' aplicado sobre el precio de lista.' : '.';

  // "Cliente Preferente" es también el nombre del cupón en Stripe, así que el
  // cliente lee la misma etiqueta aquí y en la pantalla de Checkout.
  var quien = d.socioNombre || d.socio;
  aviso.textContent = quien
    ? 'Cliente Preferente vía ' + quien + cola
    : 'Cliente Preferente' + cola;
  aviso.hidden = false;
}

function renderPaquetes(paquetes) {
  var lista = document.getElementById('packList');
  if (!lista) return;

  lista.textContent = '';

  if (!paquetes.length) {
    console.warn('Sin paquetes configurados en el servidor');
    return;
  }

  // Con un solo paquete no hay nada que elegir: se muestra como dato, no
  // como decisión.
  lista.classList.toggle('is-single', paquetes.length === 1);

  paquetes.forEach(function (p, i) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reveal__pack';
    btn.setAttribute('role', 'radio');
    btn.dataset.paquete = p.id;

    var nombre = document.createElement('span');
    nombre.className = 'reveal__pack-name';
    nombre.textContent = p.etiqueta;

    var precio = document.createElement('span');
    precio.className = 'reveal__pack-price';

    if (p.descuento) {
      var antes = document.createElement('span');
      antes.className = 'reveal__pack-was';
      antes.textContent = formatearPrecio(p.precioLista);
      precio.appendChild(antes);
    }
    precio.appendChild(document.createTextNode(formatearPrecio(p.precioFinal)));

    btn.appendChild(nombre);
    btn.appendChild(precio);
    btn.addEventListener('click', function () { seleccionarPaquete(p); });

    lista.appendChild(btn);

    if (i === 0) seleccionarPaquete(p);   // el primero queda elegido
  });
}

function seleccionarPaquete(p) {
  paqueteSeleccionado = p.id;

  // Marcar la tarjeta activa
  var tarjetas = document.querySelectorAll('.reveal__pack');
  for (var i = 0; i < tarjetas.length; i++) {
    var activa = tarjetas[i].dataset.paquete === p.id;
    tarjetas[i].classList.toggle('is-active', activa);
    tarjetas[i].setAttribute('aria-checked', activa ? 'true' : 'false');
  }

  // Precio grande
  var was = document.getElementById('priceWas');
  var now = document.getElementById('priceNow');
  if (now) now.textContent = formatearPrecio(p.precioFinal);
  if (was) {
    was.textContent = formatearPrecio(p.precioLista);
    was.hidden = !p.descuento;
  }

  // La viñeta que promete cuántas versiones incluye
  var versiones = document.getElementById('packVersions');
  if (versiones) versiones.textContent = 'Se incluyen ' + p.etiqueta;

  // Ya hay precio en pantalla: ahora sí se puede comprar
  var btn = document.getElementById('purchaseBtn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = textoBotonCompra;
    btn.style.opacity = '';
    btn.style.cursor = '';
  }
}

function formatearPrecio(n) {
  return '$' + Number(n).toLocaleString('es-MX');
}

// =====================================================================
// Cargar datos de la sumisión desde el servidor
// =====================================================================
function loadSubmissionData(submissionId) {
  console.log('📸 Cargando foto de prueba para:', submissionId);

  var photoImg = document.getElementById('editedPhoto');

  // 1er intento: carpeta local /images/Prueba/ (instantáneo; respaldo
  // para fotos publicadas con el flujo anterior)
  var localImagePath = '/images/Prueba/' + submissionId + '.jpg';

  var testImg = new Image();

  testImg.onload = function() {
    console.log('✅ Foto de prueba cargada desde carpeta local');
    photoImg.src = localImagePath;
    photoImg.alt = 'Tu foto editada con Icónica';
    photoImg.classList.remove('is-loading');
  };

  testImg.onerror = function() {
    console.log('ℹ️ Sin copia local; pidiendo la foto a Drive vía Apps Script');
    loadPreviewFromDrive(submissionId, photoImg);
  };

  // Iniciar carga
  testImg.src = localImagePath;
}

// =====================================================================
// Pedir la foto de prueba a Apps Script, que la lee del folder "Prueba"
// de Drive y la regresa como base64 (Drive no permite incrustar
// imágenes con enlaces directos).
// =====================================================================
function loadPreviewFromDrive(submissionId, photoImg) {
  leerConReintento({ action: 'getPreviewPhoto', submissionId: submissionId }, 2)
    .then(data => {
      if (data.success && data.base64) {
        console.log('✅ Foto de prueba recibida desde Drive');
        photoImg.src = 'data:' + (data.mimeType || 'image/jpeg') + ';base64,' + data.base64;
        photoImg.alt = 'Tu foto editada con Icónica';
      } else {
        console.warn('⚠️ Foto de prueba no encontrada en Drive:', data.error);
        showPlaceholder();
      }
      photoImg.classList.remove('is-loading');
    })
    .catch(error => {
      console.error('Error al pedir la foto a Apps Script:', error);
      showPlaceholder();
      photoImg.classList.remove('is-loading');
    });
}

// =====================================================================
// Mostrar imagen placeholder si no hay foto de prueba
// =====================================================================
function showPlaceholder() {
  var photoImg = document.getElementById('editedPhoto');
  photoImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="500" height="500"%3E%3Crect fill="%23e0e0e0" width="500" height="500"/%3E%3Ctext x="50%25" y="50%25" font-size="18" fill="%23999" text-anchor="middle" dy=".3em"%3EFoto de prueba%3C/text%3E%3C/svg%3E';
}

// =====================================================================
// Manejar clic en "Comprar ahora" - Crear sesión de Stripe
// =====================================================================
function handlePurchaseClick(submissionId) {
  console.log('Iniciando compra para:', submissionId);

  var btn = document.getElementById('purchaseBtn');
  var originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Procesando...';

  var payload = {
    action: 'createStripeSession',
    submissionId: submissionId,
    paquete: paqueteSeleccionado
  };

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(data => {
      console.log('Respuesta de Stripe:', data);

      btn.disabled = false;
      btn.textContent = originalText;

      if (data.success && data.url) {
        // Redirigir a Stripe Checkout
        console.log('Redirigiendo a Stripe Checkout');
        window.location.href = data.url;
      } else {
        showError(data.error || 'Error al procesar el pago. Intenta de nuevo.');
      }
    })
    .catch(error => {
      btn.disabled = false;
      btn.textContent = originalText;
      console.error('Error:', error);
      showError('Error de conexión. Intenta de nuevo.');
    });
}

// =====================================================================
// Manejar clic en "No me gustó"
// =====================================================================
function handleRejectClick() {
  var feedbackForm = document.getElementById('feedbackForm');
  feedbackForm.classList.add('is-active');

  // Desplazar hasta el INICIO de la sección de feedback (no solo "lo
  // mínimo"). Restamos la altura del header fijo para que el título
  // "Queremos saber tu opinión." no quede tapado.
  var section = document.getElementById('feedback') || feedbackForm;
  var headerH = document.getElementById('header')
    ? document.getElementById('header').offsetHeight
    : 0;
  var top = section.getBoundingClientRect().top + window.pageYOffset - headerH;

  window.scrollTo({ top: top, behavior: 'smooth' });
}

// =====================================================================
// Manejar envío de feedback
// =====================================================================
function handleSubmitFeedback(submissionId) {
  var feedback = document.getElementById('feedbackText').value.trim();

  if (!submissionId) {
    showError('Error: ID de sumisión no encontrado.');
    return;
  }

  if (!feedback) {
    alert('Por favor, escribe tu feedback antes de enviar.');
    return;
  }

  var btn = document.getElementById('submitFeedbackBtn');
  var originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Enviando...';

  // Enviar feedback al servidor
  var payload = {
    action: 'submitFeedback',
    submissionId: submissionId,
    feedback: feedback
  };

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then(data => {
      btn.disabled = false;
      btn.textContent = originalText;

      if (data.success) {
        alert('Gracias por tu feedback. Nos ayuda a mejorar.');
        document.getElementById('feedbackText').value = '';
        document.getElementById('feedbackForm').classList.remove('is-active');
      } else {
        showError(data.error || 'Error al enviar feedback.');
      }
    })
    .catch(error => {
      btn.disabled = false;
      btn.textContent = originalText;
      console.error('Error:', error);
      showError('Error de conexión. Intenta de nuevo.');
    });
}

// =====================================================================
// Cancelar feedback
// =====================================================================
function handleCancelFeedback() {
  document.getElementById('feedbackForm').classList.remove('is-active');
  document.getElementById('feedbackText').value = '';
}

// =====================================================================
// Mostrar mensaje de error
// =====================================================================
// persistente = true para avisos que contienen una instrucción (a dónde
// escribir, qué hacer). Esos no deben desaparecer solos.
function showError(message, persistente) {
  var errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.classList.add('is-active');

  if (persistente) return;

  // Auto-ocultarse después de 5 segundos
  setTimeout(function() {
    errorDiv.classList.remove('is-active');
  }, 5000);
}
