// =====================================================================
// Icónica - Payment Handler JavaScript
// Maneja la página de pago y compra de fotos editadas con Stripe
// =====================================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwokPxJhdEYiywcWHpz5Jf2KCRPKlCfcbhCJty4tLMcLEMImxDaWO5NY0xpRHlwqTY/exec';
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51Tdx5CHkkB1cJoaIo6myCrjXC9sSCjqvx7L2Ldkxq0WemURjDQ8nWTVtIATI95SG75EagtMLFX3JJt07CfI0OIpD00hq2gLWui';

// Inicializar Stripe 
var stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

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

  // Configurar botones
  document.getElementById('purchaseBtn').addEventListener('click', function() {
    handlePurchaseClick(submissionId);
  });
  document.getElementById('rejectBtn').addEventListener('click', handleRejectClick);
  document.getElementById('submitFeedbackBtn').addEventListener('click', function() {
    handleSubmitFeedback(submissionId);
  });

  // Cargar datos de la sumisión
  loadSubmissionData(submissionId);
}

// =====================================================================
// Cargar datos de la sumisión desde el servidor
// =====================================================================
function loadSubmissionData(submissionId) {
  console.log('📸 Cargando foto de prueba para:', submissionId);

  var photoImg = document.getElementById('editedPhoto');

  // Cargar desde carpeta local /images/Prueba/
  // Formato esperado: /images/Prueba/[SUBMISSIONID].jpg
  var localImagePath = '/images/Prueba/' + submissionId + '.jpg';

  console.log('Intentando cargar desde:', localImagePath);

  // Crear una imagen temporal para verificar si existe
  var testImg = new Image();

  testImg.onload = function() {
    console.log('✅ Foto de prueba cargada desde carpeta local');
    photoImg.src = localImagePath;
    photoImg.alt = 'Tu foto editada con Icónica';
    photoImg.classList.remove('loading');
  };

  testImg.onerror = function() {
    console.warn('⚠️ Foto de prueba no encontrada en /images/Prueba/');
    showPlaceholder();
    photoImg.classList.remove('loading');
  };

  // Iniciar carga
  testImg.src = localImagePath;
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
    submissionId: submissionId
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

  // Scroll al formulario
  feedbackForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
function showError(message) {
  var errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.classList.add('is-active');

  // Auto-ocultarse después de 5 segundos
  setTimeout(function() {
    errorDiv.classList.remove('is-active');
  }, 5000);
}
