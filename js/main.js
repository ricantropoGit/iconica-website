/* ==========================================================================
   Icónica — main.js
   Hamburguesa · smooth-scroll a anchors · slider antes/después ·
   nav activo · formulario · botón de upload
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Año en footer ------------------------------------------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header: sombra al hacer scroll -------------------------- */
  var header = document.getElementById('header');
  function onScrollHeader() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
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
    hamburger.addEventListener('click', function () {
      setMenu(!mobileNav.classList.contains('is-open'));
    });
  }
  // Cierra el menú al tocar fuera de él (pero no al tocar un item dentro)
  document.addEventListener('click', function (e) {
    if (!mobileNav || !mobileNav.classList.contains('is-open')) return;
    if (mobileNav.contains(e.target) || (hamburger && hamburger.contains(e.target))) return;
    setMenu(false);
  });
  // Cierra el menú al cambiar a viewport grande
  var mq = window.matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', function (e) { if (e.matches) setMenu(false); });

  /* ---------- Smooth scroll a anchors (con offset del header) --------- */
  function headerOffset() {
    return (header ? header.offsetHeight : 0);
  }
  function scrollToTarget(target, align) {
    var rect = target.getBoundingClientRect();
    var top;
    if (align === 'bottom') {
      // Detener el scroll cuando el FONDO de la sección coincide con el
      // fondo del viewport (la sección queda al pie de la pantalla).
      top = rect.bottom + window.scrollY - window.innerHeight;
    } else {
      // Por defecto: el TOPE de la sección queda bajo el header sticky.
      top = rect.top + window.scrollY - headerOffset();
    }
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  }
  document.querySelectorAll('[data-scroll]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target, link.getAttribute('data-scroll-align'));
      history.replaceState(null, '', id);
    });
  });

  /* ---------- Nav activo según sección visible ------------------------ */
  // OJO: en ORDEN DE DOCUMENTO — updateActiveNav recorre el arreglo y hace
  // break en la primera sección que aún no ha pasado la línea de referencia.
  var sections = ['hero', 'como-funciona', 'cta', 'precios', 'compara', 'faq', 'contacto']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__link, .mobile-nav__link'));

  function linkFor(id) {
    return navLinks.filter(function (a) { return a.getAttribute('href') === '#' + id; });
  }
  var currentActive = null;
  function setActive(id) {
    if (id === currentActive) return;
    currentActive = id;
    navLinks.forEach(function (a) { a.classList.remove('is-active'); });
    if (id) linkFor(id).forEach(function (a) { a.classList.add('is-active'); });
  }
  function updateActiveNav() {
    if (!sections.length) return;
    // Línea de referencia: justo debajo del header sticky
    var line = window.scrollY + headerOffset() + 4;
    // Si estamos al final de la página, activa la última sección
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
      setActive(sections[sections.length - 1].id);
      return;
    }
    var active = sections[0].id;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= line) active = sections[i].id;
      else break;
    }
    setActive(active);
  }
  updateActiveNav();
  window.addEventListener('scroll', updateActiveNav, { passive: true });
  window.addEventListener('resize', updateActiveNav);

  /* ==================================================================
     SLIDER antes / después
     ================================================================== */
  var track = document.getElementById('sliderTrack');
  if (track) {
    var prevBtn = document.getElementById('sliderPrev');
    var nextBtn = document.getElementById('sliderNext');
    var playBtn = document.getElementById('sliderPlay');
    var iconPlay = document.getElementById('iconPlay');
    var iconPause = document.getElementById('iconPause');
    var dotsWrap = document.getElementById('sliderDots');
    var playing = true;
    var timer = null;
    var INTERVAL = 10000;
    var TRANSITION = 'transform .55s cubic-bezier(.65,.05,.36,1)';
    // Autoplay configurable desde el HTML: <section class="slider" data-autoplay="false">
    var sliderEl = track.closest('.slider');
    var AUTOPLAY = !(sliderEl && sliderEl.getAttribute('data-autoplay') === 'false');

    // En móvil el carrusel muestra UNA imagen por slide (antes y después,
    // intercaladas, empezando por par-1-antes). En ≥640px se mantienen los
    // pares en dos columnas, exactamente como antes.
    var MOBILE_MQ = window.matchMedia('(max-width: 639.98px)');
    // Markup original (6 pares) guardado para poder reconstruir al cambiar de layout.
    var originalHTML = track.innerHTML;

    // Estado del carrusel — se recalcula en cada reconstrucción.
    var count = 0, index = 0, hasClones = false, animating = false, dots = [];

    function realIndex() {
      if (!hasClones) return index;
      return (index - 1 + count) % count;
    }
    function position() {
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
    }
    function paintDots() {
      var r = realIndex();
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === r); });
    }
    function render() { position(); paintDots(); }
    function goTo(i) {
      if (animating) return;
      animating = true;
      index = i;
      render();
    }
    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    // Construye los slides del track según el ancho:
    //  • Móvil  : cada imagen (.ba) es su propio slide → par-1-antes va primero.
    //  • ≥640px : cada par original (.slide) ocupa un slide en dos columnas.
    function buildTrack() {
      track.innerHTML = originalHTML;
      if (MOBILE_MQ.matches) {
        var bas = Array.prototype.slice.call(track.querySelectorAll('.ba'));
        track.innerHTML = '';
        bas.forEach(function (ba) {
          var s = document.createElement('div');
          s.className = 'slide';
          s.appendChild(ba);
          track.appendChild(s);
        });
      }
    }

    // (Re)inicializa el carrusel: arma slides, clones de loop, dots y posición.
    function setupCarousel() {
      if (timer) { clearInterval(timer); timer = null; }
      dotsWrap.innerHTML = '';
      track.style.transition = 'none';

      buildTrack();

      var realSlides = Array.prototype.slice.call(track.children);
      count = realSlides.length;
      hasClones = count > 1;

      // Loop infinito: clon del último al inicio y del primero al final.
      if (hasClones) {
        var firstClone = realSlides[0].cloneNode(true);
        var lastClone = realSlides[count - 1].cloneNode(true);
        firstClone.setAttribute('aria-hidden', 'true');
        lastClone.setAttribute('aria-hidden', 'true');
        track.appendChild(firstClone);
        track.insertBefore(lastClone, realSlides[0]);
      }
      index = hasClones ? 1 : 0;
      animating = false;

      // Dots — uno por slide real.
      dots = realSlides.map(function (_, i) {
        var b = document.createElement('button');
        b.className = 'slider__dot' + (i === 0 ? ' is-active' : '');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', 'Imagen ' + (i + 1));
        b.addEventListener('click', function () { goTo(hasClones ? i + 1 : i); restart(); });
        dotsWrap.appendChild(b);
        return b;
      });

      // Posición inicial SIN animación (evita un deslizamiento al cargar).
      render();
      void track.offsetWidth;
      track.style.transition = TRANSITION;

      if (AUTOPLAY) start(); else stop();
    }

    // Al terminar la animación, si caímos en un clon saltamos sin transición
    // al slide real correspondiente.
    track.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'transform') return;
      animating = false;
      if (!hasClones) return;
      if (index === count + 1) {          // clon del primero (después del último real)
        track.style.transition = 'none';
        index = 1;
        position();
        void track.offsetWidth;           // forzar reflow
        track.style.transition = TRANSITION;
      } else if (index === 0) {            // clon del último (antes del primer real)
        track.style.transition = 'none';
        index = count;
        position();
        void track.offsetWidth;
        track.style.transition = TRANSITION;
      }
    });

    function start() {
      stop();
      timer = setInterval(next, INTERVAL);
      playing = true;
      iconPlay.style.display = 'none';
      iconPause.style.display = '';
      playBtn.setAttribute('aria-label', 'Pausar presentación');
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      playing = false;
      iconPlay.style.display = '';
      iconPause.style.display = 'none';
      playBtn.setAttribute('aria-label', 'Reproducir presentación');
    }
    function restart() { if (playing) start(); }

    nextBtn.addEventListener('click', function () { next(); restart(); });
    prevBtn.addEventListener('click', function () { prev(); restart(); });
    playBtn.addEventListener('click', function () { playing ? stop() : start(); });

    // Swipe táctil
    var startX = 0, dx = 0, dragging = false;
    var vp = track.parentElement;
    vp.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; dragging = true; dx = 0; }, { passive: true });
    vp.addEventListener('touchmove', function (e) { if (dragging) dx = e.touches[0].clientX - startX; }, { passive: true });
    vp.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); restart(); }
    });

    // Clic en el área de imágenes (el track) pausa o reanuda el carrusel
    // (toggle), en móvil y escritorio. Los controles —flechas, botón play/pausa
    // y puntos— viven FUERA del track (son sus hermanos), así que conservan su
    // propia función sin pausar. Un swipe no dispara click, solo un toque limpio.
    track.addEventListener('click', function () {
      playing ? stop() : start();
    });

    // Teclado
    document.getElementById('galeria').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { next(); restart(); }
      if (e.key === 'ArrowLeft') { prev(); restart(); }
    });

    // Reconstruye el carrusel al cruzar el breakpoint móvil/desktop.
    var wasMobile = MOBILE_MQ.matches;
    function onBreakpoint() {
      if (MOBILE_MQ.matches !== wasMobile) {
        wasMobile = MOBILE_MQ.matches;
        setupCarousel();
      }
    }
    if (MOBILE_MQ.addEventListener) MOBILE_MQ.addEventListener('change', onBreakpoint);
    else if (MOBILE_MQ.addListener) MOBILE_MQ.addListener(onBreakpoint);

    setupCarousel();
  }

  /* ==================================================================
     Dropzone — subida de foto en "Hablemos"
     ================================================================== */
  var photoInput = document.getElementById('f-photo');
  var dropzone = document.getElementById('dropzone');
  var preview = document.getElementById('dropzonePreview');
  var thumb = document.getElementById('dropzoneThumb');
  var thumbWrap = document.getElementById('dropzoneThumbWrap');
  var nameEl = document.getElementById('dropzoneName');
  var removeBtn = document.getElementById('dropzoneRemove');

  if (photoInput && dropzone && preview) {
    function showPreview(file) {
      if (!file || !/^image\//.test(file.type)) return;
      nameEl.textContent = file.name;
      if (thumbWrap) thumbWrap.classList.remove('is-loaded');
      thumb.onload = function () { if (thumbWrap) thumbWrap.classList.add('is-loaded'); };
      var reader = new FileReader();
      reader.onload = function (e) { thumb.src = e.target.result; };
      reader.readAsDataURL(file);
      preview.hidden = false;
      dropzone.hidden = true;
    }
    function clearPreview() {
      photoInput.value = '';
      thumb.removeAttribute('src');
      if (thumbWrap) thumbWrap.classList.remove('is-loaded');
      preview.hidden = true;
      dropzone.hidden = false;
    }

    photoInput.addEventListener('change', function () {
      if (photoInput.files && photoInput.files.length) showPreview(photoInput.files[0]);
    });
    removeBtn.addEventListener('click', clearPreview);

    // Resaltado al arrastrar y soltar
    ['dragenter', 'dragover'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('is-dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('is-dragover'); });
    });
    dropzone.addEventListener('drop', function (e) {
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        photoInput.files = dt.files;
        showPreview(dt.files[0]);
      }
    });
  }

   /* ==================================================================
     Formulario de contacto - Manejado por formHandler.js
     ================================================================== */
  // El formulario ahora es manejado por formHandler.js
  // que envía datos al Google Apps Script

})();
