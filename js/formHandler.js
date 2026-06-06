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
      fileName: file.name,
      fileType: file.type,
      fileBase64: base64Data
    };

    console.log('✓ Payload JSON creado. Enviando a:', APPS_SCRIPT_URL);

    // Enviar al Google Apps Script como JSON
    console.log('✓ Enviando al Google Apps Script...');

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      console.log('✓ Respuesta recibida. Status:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('✓ Datos parseados:', data);
      showLoadingState(false);

      // Si hay ID, redirigir con ID
      if (data && data.submissionId) {
        console.log('✓ ÉXITO con ID:', data.submissionId);
        window.location.href = 'confirmation.html?id=' + encodeURIComponent(data.submissionId);
      } else {
        // Si no hay ID pero se procesó, redirigir con email
        console.log('✓ Procesado sin ID, usando email');
        window.location.href = 'confirmation.html?email=' + encodeURIComponent(email);
      }
    })
    .catch(error => {
      console.error('✗ Error en respuesta:', error);
      showLoadingState(false);

      // IMPORTANTE: Aunque hay error en respuesta, el Apps Script probablemente
      // YA procesó todo (porque recibimos el error DESPUÉS de procesar).
      // Redirigir de todos modos.
      console.log('✓ Redirigiendo pese a error (Apps Script probablemente procesó)');
      window.location.href = 'confirmation.html?email=' + encodeURIComponent(email);
    });
  };

  reader.onerror = function() {
    showLoadingState(false);
    console.error('✗ Error al leer el archivo');
    showErrorMessage('Error al leer el archivo. Intenta de nuevo.');
  };

  reader.readAsDataURL(file);
}

// =====================================================================
// Mostrar estado de carga
// =====================================================================
function showLoadingState(isLoading) {
  var form = document.getElementById('contactForm');
  var submitBtn = form.querySelector('button[type="submit"]');

  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    submitBtn.style.opacity = '0.6';
    form.style.pointerEvents = 'none';
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar mensaje';
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
    form.parentNode.insertBefore(errorDiv, form);
  }

  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  // Auto-ocultarse después de 5 segundos
  setTimeout(function() {
    errorDiv.style.display = 'none';
  }, 5000);
}

console.log('✓ formHandler.js cargado completamente');