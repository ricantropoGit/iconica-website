// =====================================================================
// Icónica - Form Handler JavaScript
// Maneja la sumisión del formulario de contacto
// =====================================================================

console.log('✓ formHandler.js se está cargando...');

// URL del proxy serverless en Vercel
const APPS_SCRIPT_URL = '/api/submit';

console.log('✓ APPS_SCRIPT_URL configurada:', APPS_SCRIPT_URL);

// =====================================================================
// Inicializar cuando el DOM esté listo
// =====================================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('✓ DOMContentLoaded disparado');

  var form = document.getElementById('contactForm');
  console.log('✓ Buscando formulario con ID "contactForm":', form);

  if (form) {
    console.log('✓ Formulario encontrado. Agregando event listener para submit');
    // Cambiar el comportamiento del formulario
    form.addEventListener('submit', handleFormSubmit);
    console.log('✓ Event listener agregado al formulario');
  } else {
    console.error('✗ ERROR: Formulario con ID "contactForm" NO ENCONTRADO');
  }
});

// =====================================================================
// Manejar sumisión del formulario
// =====================================================================
function handleFormSubmit(e) {
  console.log('✓ handleFormSubmit ejecutado');
  e.preventDefault();

  var form = e.target;

  // Validar campos requeridos
  if (!form.checkValidity()) {
    console.log('✗ Formulario inválido');
    form.reportValidity();
    return;
  }

  // Obtener datos del formulario
  var name = document.getElementById('f-name').value.trim();
  var email = document.getElementById('f-email').value.trim();
  var subject = document.getElementById('f-subject').value.trim();
  var message = document.getElementById('f-message').value.trim();
  var fileInput = document.getElementById('f-photo');
  var file = fileInput.files[0];

  // Programa de socios. Campo opcional: si el código no existe o viene con
  // basura, Apps Script lo guarda aparte para revisarlo a mano y la
  // solicitud sigue su curso. Nunca bloquea el envío.
  var socioField = document.getElementById('f-socio');
  var socio = socioField ? socioField.value.trim() : '';

  console.log('✓ Datos del formulario:', { name, email, subject, message, file: file ? file.name : 'sin archivo' });

  // Validar que hay archivo
  if (!file) {
    console.log('✗ No hay archivo');
    showErrorMessage('Por favor, sube una foto');
    return;
  }

  // Validar tamaño del archivo (máx 3MB)
  var fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > 3) {
    console.log('✗ Archivo muy grande:', fileSizeMB, 'MB');
    showErrorMessage('La foto es muy grande. Máximo 3MB');
    return;
  }

  // Validar tipo de archivo
  if (!file.type.startsWith('image/')) {
    console.log('✗ Tipo de archivo inválido:', file.type);
    showErrorMessage('Por favor, sube una imagen válida (JPG, PNG, etc.)');
    return;
  }

  console.log('✓ Todas las validaciones pasaron. Convirtiendo a base64...');

  // Mostrar estado de carga
  showLoadingState(true);

  // Leer archivo y convertir a base64
  var reader = new FileReader();

  // Progreso real de la lectura del archivo: primer tramo de la barra
  reader.onprogress = function(e) {
    if (!e.lengthComputable) return;
    setProgreso(Math.round((e.loaded / e.total) * TRAMO_LECTURA), 'Preparando tu foto…');
  };

  reader.onload = function(e) {
    var base64Data = e.target.result.split(',')[1]; // Obtener solo la parte base64
    console.log('✓ Archivo convertido a base64. Tamaño:', base64Data.length, 'caracteres');

    // Crear payload JSON
    var payload = {
      action: 'submitForm',
      name: name,
      email: email,
      subject: subject,
      message: message,
      phone: '',
      socio: socio,
      fileName: file.name,
      fileType: file.type,
      fileBase64: base64Data
    };

    console.log('✓ Payload JSON creado. Enviando a:', APPS_SCRIPT_URL);

    // Enviar al Google Apps Script como JSON
    console.log('✓ Enviando al Google Apps Script...');

    // Se usa XMLHttpRequest y no fetch por una sola razón: es el único que
    // expone el progreso de SUBIDA (xhr.upload.onprogress). Con fetch la
    // barra tendría que inventarse el avance; así son bytes reales.
    var xhr = new XMLHttpRequest();
    xhr.open('POST', APPS_SCRIPT_URL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.upload.onprogress = function(e) {
      if (!e.lengthComputable) return;
      var fraccion = e.loaded / e.total;
      setProgreso(
        TRAMO_LECTURA + Math.round(fraccion * TRAMO_SUBIDA),
        'Subiendo tu foto… ' + Math.round(fraccion * 100) + '%'
      );
    };

    // Terminó de subir: a partir de aquí manda el servidor y ya no hay nada
    // medible. La barra pasa a indeterminada con mensajes de los pasos reales.
    xhr.upload.onload = function() {
      iniciarEspera();
    };

    xhr.onload = function() {
      console.log('✓ Respuesta recibida. Status:', xhr.status);

      var data = null;
      try {
        data = JSON.parse(xhr.responseText);
        console.log('✓ Datos parseados:', data);
      } catch (err) {
        console.warn('✗ Respuesta no era JSON:', xhr.responseText.substring(0, 120));
      }

      // Si hay ID, redirigir con ID
      if (data && data.submissionId) {
        console.log('✓ ÉXITO con ID:', data.submissionId);
        setProgreso(100, 'Listo');

        // Si el código de socio empató, se lo pasamos al acuse para que lo
        // confirme ahí mismo. El descuento persuade cuando el cliente aún
        // está decidiendo si vale la pena, no en la pantalla de cobro.
        var extra = '';
        if (data.socioNombre) {
          extra = '&socio=' + encodeURIComponent(data.socioNombre) +
                  '&esquema=' + encodeURIComponent(data.esquema || '');
        }

        window.location.href = 'confirmation.html?id=' +
          encodeURIComponent(data.submissionId) + extra;
      } else {
        // Sin ID legible: Apps Script casi seguro YA procesó (el fallo típico
        // es la recogida de la respuesta, no el trabajo). El acuse recupera
        // el folio por correo con getSubmissionIdByEmail.
        console.log('✓ Procesado sin ID, usando email');
        window.location.href = 'confirmation.html?email=' + encodeURIComponent(email);
      }
    };

    xhr.onerror = function() {
      console.error('✗ Error de red al enviar');
      // Mismo criterio: el trabajo probablemente se hizo, el acuse resuelve.
      window.location.href = 'confirmation.html?email=' + encodeURIComponent(email);
    };

    xhr.send(JSON.stringify(payload));
  };

  reader.onerror = function() {
    showLoadingState(false);
    console.error('✗ Error al leer el archivo');
    showErrorMessage('Error al leer el archivo. Intenta de nuevo.');
  };

  reader.readAsDataURL(file);
}

// =====================================================================
// Barra de progreso dentro del botón
// =====================================================================
// El envío tarda varios segundos y sin señal la espera se siente el doble.
// La barra es REAL donde se puede medir:
//
//   0 → 15 %   lectura del archivo (FileReader)
//  15 → 70 %   subida (bytes enviados, vía XMLHttpRequest)
//  70 → …      el servidor trabaja: NO es medible
//
// En ese último tramo no se inventa un porcentaje. La barra pasa a un
// barrido indeterminado y el texto va nombrando los pasos que el servidor
// realmente ejecuta, en el orden en que ocurren.
// =====================================================================
var TRAMO_LECTURA = 15;
var TRAMO_SUBIDA = 55;

var temporizadoresEspera = [];

function botonEnvio() {
  var form = document.getElementById('contactForm');
  return form ? form.querySelector('button[type="submit"]') : null;
}

function setProgreso(pct, texto) {
  var btn = botonEnvio();
  if (!btn) return;
  btn.classList.remove('is-indeterminate');
  btn.style.setProperty('--progreso', Math.min(100, Math.max(0, pct)) + '%');
  var label = btn.querySelector('.btn__label');
  if (label && texto) label.textContent = texto;
}

// Pasos reales del servidor: guarda en Drive, escribe la hoja, manda correos
function iniciarEspera() {
  var btn = botonEnvio();
  if (!btn) return;
  btn.classList.add('is-indeterminate');

  var etapas = [
    [0,    'Procesando tu foto…'],
    [2500, 'Guardando tu solicitud…'],
    [5000, 'Enviando tu confirmación…']
  ];

  etapas.forEach(function (etapa) {
    temporizadoresEspera.push(setTimeout(function () {
      var label = botonEnvio() && botonEnvio().querySelector('.btn__label');
      if (label) label.textContent = etapa[1];
    }, etapa[0]));
  });
}

// =====================================================================
// Mostrar estado de carga
// =====================================================================
function showLoadingState(isLoading) {
  var form = document.getElementById('contactForm');
  var submitBtn = form.querySelector('button[type="submit"]');

  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.85';
    form.style.pointerEvents = 'none';

    // El texto pasa a un <span> para que quede por encima del relleno de la
    // barra: un pseudo-elemento posicionado se pinta sobre el texto suelto.
    submitBtn.dataset.textoOriginal = submitBtn.dataset.textoOriginal ||
                                      submitBtn.textContent.trim();
    submitBtn.innerHTML = '<span class="btn__label">Preparando tu foto…</span>';
    submitBtn.classList.add('is-progress');
    submitBtn.style.setProperty('--progreso', '0%');

  } else {
    temporizadoresEspera.forEach(clearTimeout);
    temporizadoresEspera = [];

    submitBtn.disabled = false;
    submitBtn.classList.remove('is-progress', 'is-indeterminate');
    submitBtn.style.removeProperty('--progreso');
    submitBtn.textContent = submitBtn.dataset.textoOriginal || 'Enviar mensaje';
    submitBtn.style.opacity = '1';
    form.style.pointerEvents = 'auto';
  }
}

// =====================================================================
// Mostrar mensaje de error
// =====================================================================
function showErrorMessage(message) {
  console.log('Mostrando error:', message);

  // Buscar o crear elemento de error
  var errorDiv = document.getElementById('formError');

  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'formError';
    errorDiv.style.cssText = `
      background: #fee;
      border: 1px solid #f88;
      border-radius: 8px;
      padding: 12px 16px;
      color: #c33;
      margin-bottom: 16px;
      font-size: 14px;
    `;

    var form = document.getElementById('contactForm');
    var submitBtn = form.querySelector('button[type="submit"]');
    // Insertar DENTRO del form, justo antes del botón "Enviar" — así el aviso
    // queda en la columna del formulario y NO rompe la retícula de 2 columnas
    // (antes se insertaba como hermano del form → se volvía 3ª celda del grid).
    if (submitBtn) {
      form.insertBefore(errorDiv, submitBtn);
    } else {
      form.appendChild(errorDiv);
    }
  }

  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  // Auto-ocultarse después de 5 segundos
  setTimeout(function() {
    errorDiv.style.display = 'none';
  }, 5000);
}

console.log('✓ formHandler.js cargado completamente');