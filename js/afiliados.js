/* ==========================================================================
   Icónica24 — afiliados.js
   Página del programa de socios: hamburguesa · smooth-scroll · nav activo ·
   FAQ desplegable · formulario de solicitud.
   No carga main.js (esta página no tiene slider ni dropzone de foto).
   ========================================================================== */
(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header: sombra al hacer scroll -------------------------- */
  var header = document.getElementById('header');
  function onScrollHeader() { if (header) header.classList.toggle('is-scrolled', window.scrollY > 8); }
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  /* ---------- Menú hamburguesa ---------------------------------------- */
  var hamburger = document.getElementById('hamburger');
  var mobileNav = document.getElementById('mobile-nav');
  function setMenu(open) {
    if (!hamburger || !mobileNav) return;
    hamburger.classList.toggle('is-open', open);
    mobileNav.classList.toggle('is-open', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  if (hamburger) {
    hamburger.addEventListener('click', function () { setMenu(!mobileNav.classList.contains('is-open')); });
  }
  document.addEventListener('click', function (e) {
    if (!mobileNav || !mobileNav.classList.contains('is-open')) return;
    if (mobileNav.contains(e.target) || (hamburger && hamburger.contains(e.target))) return;
    setMenu(false);
  });
  var mq = window.matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', function (e) { if (e.matches) setMenu(false); });

  /* ---------- Smooth scroll a anchors --------------------------------- */
  function headerOffset() { return header ? header.offsetHeight : 0; }
  document.querySelectorAll('[data-scroll]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      // NO se cierra el menú aquí: igual que en index.html, el panel móvil
      // permanece abierto al tocar un item y solo se cierra con el ícono o
      // con un clic fuera de él (ver el listener de document más arriba).
      var top = target.getBoundingClientRect().top + window.scrollY - headerOffset();
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* ---------- Nav activo según sección visible ------------------------ */
  // En ORDEN DE DOCUMENTO: se recorre y se corta en la primera sección que
  // aún no ha cruzado la línea de referencia (justo bajo el header sticky).
  var sections = ['hero', 'como-funciona', 'quien', 'faq', 'solicitar']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__link, .mobile-nav__link'));
  var currentActive = null;
  function setActive(id) {
    if (id === currentActive) return;
    currentActive = id;
    navLinks.forEach(function (a) { a.classList.remove('is-active'); });
    navLinks.filter(function (a) { return a.getAttribute('href') === '#' + id; })
            .forEach(function (a) { a.classList.add('is-active'); });
  }
  function updateActiveNav() {
    if (!sections.length) return;
    var line = window.scrollY + headerOffset() + 4;
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
      setActive(sections[sections.length - 1].id);
      return;
    }
    var active = sections[0].id;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= line) active = sections[i].id; else break;
    }
    setActive(active);
  }
  updateActiveNav();
  window.addEventListener('scroll', updateActiveNav, { passive: true });
  window.addEventListener('resize', updateActiveNav);

  /* ---------- FAQ: acordeón (una abierta a la vez) -------------------- */
  var faqItems = Array.prototype.slice.call(document.querySelectorAll('.faq__item'));
  faqItems.forEach(function (item) {
    var btn = item.querySelector('.faq__q');
    var panel = item.querySelector('.faq__a');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var willOpen = !item.classList.contains('is-open');
      faqItems.forEach(function (other) {
        other.classList.remove('is-open');
        var b = other.querySelector('.faq__q');
        var p = other.querySelector('.faq__a');
        if (b) b.setAttribute('aria-expanded', 'false');
        if (p) p.setAttribute('aria-hidden', 'true');
      });
      if (willOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-hidden', 'false');
      }
    });
  });

  /* ---------- Formulario de solicitud --------------------------------- */
  // Va a Apps Script por el mismo puente que el formulario del sitio
  // (/api/submit existe para evitar el CORS de llamar a Google directo).
  // La solicitud entra a la pestaña "Socios" como "pendiente" y sin código:
  // el código lo asigna a mano el administrador al aprobarla.
  var form = document.getElementById('afiliadosForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var btn = form.querySelector('button[type="submit"]');
      var textoOriginal = btn ? btn.textContent : '';

      function bloquear(texto) {
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = texto;
        btn.style.opacity = '.6';
      }
      function liberar() {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = textoOriginal;
        btn.style.opacity = '1';
      }
      function valor(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
      }

      bloquear('Enviando…');

      fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'altaSocio',
          name: valor('f-name'),
          email: valor('f-email'),
          org: valor('f-org'),
          message: valor('f-message'),
          esquema: valor('f-esquema')
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.success) {
            form.classList.add('is-sent');
            bloquear('Solicitud enviada');
            return;
          }

          // Apps Script respondió algo que no era JSON. Es un intermitente
          // conocido de Google, y cuando ocurre el script YA hizo su trabajo:
          // la solicitud quedó registrada y el aviso salió. Decir "no pudimos
          // enviarla" sería falso — y peor: el socio la mandaría otra vez y
          // quedarían filas duplicadas. Por eso el botón NO se libera.
          if (data && data.code === 'upstream_non_json') {
            bloquear('Solicitud enviada');
            mostrarAvisoSocio(form,
              'Recibimos tu solicitud, pero no pudimos confirmarla en pantalla. ' +
              'No la mandes de nuevo: si no tienes respuesta en 24 horas, ' +
              'escríbenos a hola@iconica24.com.', 'duda');
            return;
          }

          liberar();
          mostrarAvisoSocio(form, (data && data.error) ||
            'No pudimos enviar tu solicitud. Inténtalo de nuevo.', 'error');
        })
        .catch(function () {
          // Aquí la petición ni siquiera completó, así que lo más probable es
          // que no haya llegado. Reintentar sí tiene sentido.
          liberar();
          mostrarAvisoSocio(form,
            'Error de conexión. Escríbenos a hola@iconica24.com si vuelve a fallar.',
            'error');
        });
    });
  }

  // tono 'error' → rojo, se oculta solo a los 6 s (el socio va a reintentar)
  // tono 'duda'  → ámbar y permanente (dice qué hacer, no debe desaparecer)
  function mostrarAvisoSocio(form, mensaje, tono) {
    var esDuda = tono === 'duda';

    var div = document.getElementById('afiliadosError');
    if (!div) {
      div = document.createElement('div');
      div.id = 'afiliadosError';
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { form.insertBefore(div, btn); } else { form.appendChild(div); }
    }

    div.style.cssText = 'border-radius:8px;padding:12px 16px;font-size:14px;' +
      'line-height:1.5;' + (esDuda
        ? 'background:#fffbeb;border:1px solid #fcd34d;color:#92400e;'
        : 'background:#fee;border:1px solid #f88;color:#c33;');

    div.textContent = mensaje;
    div.style.display = 'block';

    if (!esDuda) {
      setTimeout(function () { div.style.display = 'none'; }, 6000);
    }
  }
})();
