/* ==========================================================================
   GraphicaWeb — main.js
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
  // Abre y cierra con la hamburguesa; se cierra al tocar fuera del menú (no
  // al tocar una opción), con Escape, con la marca o al pasar a pantalla
  // ancha. La clase .is-abierta en la cabecera es la misma que usa el editor.
  var hamburger = document.getElementById('hamburger');
  var mobileNav = document.getElementById('mobile-nav');

  function setMenu(open) {
    if (!header || !hamburger) return;
    header.classList.toggle('is-abierta', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  var abierto = function () { return !!header && header.classList.contains('is-abierta'); };
  if (hamburger) {
    hamburger.addEventListener('click', function () { setMenu(!abierto()); });
  }
  document.addEventListener('click', function (e) {
    if (!abierto()) return;
    if ((mobileNav && mobileNav.contains(e.target)) || (hamburger && hamburger.contains(e.target))) return;
    setMenu(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  var marca = header && header.querySelector('.marca');
  if (marca) marca.addEventListener('click', function () { setMenu(false); });
  // Cierra el menú al cambiar a pantalla ancha
  var mq = window.matchMedia('(min-width: 768px)');
  var alCambiar = function (e) { if (e.matches) setMenu(false); };
  // (addListener: Safari anterior a 14 no tiene addEventListener aquí.)
  if (mq.addEventListener) mq.addEventListener('change', alCambiar); else mq.addListener(alCambiar);

  /* ---------- Menú compacto ------------------------------------------- */
  // Si las opciones no caben junto a la marca, también en pantalla ancha se
  // usa la hamburguesa (css/styles.css). Se mide al cargar, al cambiar el
  // ancho y cuando llegan las fuentes. Misma medición que las plantillas y
  // que la vista previa del editor.
  var fila = header && header.querySelector('.cabecera__fila');
  function medirMenu() {
    if (!fila) return;
    header.classList.remove('menu-compacto');
    if (window.matchMedia('(max-width: 767px)').matches) return;
    header.classList.add('menu-midiendo');
    var css = getComputedStyle(fila);
    var hijos = Array.prototype.filter.call(fila.children, function (h) { return getComputedStyle(h).display !== 'none'; });
    var usado = hijos.reduce(function (t, h) {
      var m = getComputedStyle(h);
      return t + h.getBoundingClientRect().width + parseFloat(m.marginLeft) + parseFloat(m.marginRight);
    }, 0) + (parseFloat(css.columnGap) || 0) * (hijos.length - 1);
    var disponible = fila.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    header.classList.remove('menu-midiendo');
    var compacto = usado + 24 > disponible;
    header.classList.toggle('menu-compacto', compacto);
    if (!compacto) setMenu(false);
  }
  medirMenu();
  var medida = 0;
  window.addEventListener('resize', function () { cancelAnimationFrame(medida); medida = requestAnimationFrame(medirMenu); });
  if (document.fonts) document.fonts.ready.then(medirMenu);
  window.addEventListener('load', medirMenu);

  /* ---------- Enlaces a otros sitios: en otra pestaña ------------------ */
  // Los botones se editan en el panel y pueden llevar a otro sitio
  // (https://…): ésos se abren en otra pestaña para no sacar al visitante.
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="http"]'), function (a) {
    if (a.host === location.host || a.hasAttribute('target')) return;
    a.target = '_blank';
    a.rel = (a.rel ? a.rel + ' ' : '') + 'noopener';
  });

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
  // Las secciones salen de los #ancla del menú (contenido/sitio.json), en
  // orden de documento. La opción activa lleva aria-current, como en las
  // plantillas y en la vista previa del editor. Al elegir una opción se marca
  // de inmediato, sin esperar el desplazamiento.
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.menu a, .menu-movil__lista a'));
  var hrefs = navLinks.map(function (a) { return a.getAttribute('href') || ''; });
  var sections = hrefs.filter(function (h, i) { return /^#[\w-]+$/.test(h) && hrefs.indexOf(h) === i; })
    .map(function (h) { return document.getElementById(h.slice(1)); })
    .filter(Boolean)
    .sort(function (a, b) { return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1; });

  // La opción de la página en la que se está (p. ej. /servicios.html).
  var ruta = function (p) { return p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/'; };
  navLinks.forEach(function (a) {
    var h = a.getAttribute('href') || '';
    if (h.charAt(0) === '/' && h.indexOf('#') === -1 && ruta(h) === ruta(location.pathname)) a.setAttribute('aria-current', 'page');
  });

  var currentActive = null, bloqueo = 0;
  function setActive(id) {
    if (id === currentActive) return;
    currentActive = id;
    navLinks.forEach(function (a) {
      if (a.getAttribute('aria-current') === 'page') return;
      if (id && a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  function updateActiveNav() {
    if (!sections.length || Date.now() < bloqueo) return;
    // Línea de referencia: justo debajo del header sticky
    var line = window.scrollY + headerOffset() + 4;
    // Si estamos al final de la página, activa la última sección
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
      setActive(sections[sections.length - 1].id);
      return;
    }
    var active = sections[0].id;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top + window.scrollY <= line) active = sections[i].id;
      else break;
    }
    setActive(active);
  }
  navLinks.forEach(function (a) {
    var h = a.getAttribute('href') || '';
    if (!/^#[\w-]+$/.test(h)) return;
    a.addEventListener('click', function () { bloqueo = Date.now() + 900; setActive(h.slice(1)); setTimeout(updateActiveNav, 950); });
  });
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

  /* ---------- Plazo de mensualidades sin intereses -------------------- */
  // El precio que se ve al cargar vive en el HTML; este script NO lo escribe.
  // Es a propósito: la vista previa del panel no ejecuta JS, y la tarjeta tiene
  // que verse completa sin él. Aquí sólo se reacciona al cambio de plazo.
  // Las cifras se editan en el panel y el build las pone en el HTML —el precio
  // en cada <option>, el total en el propio <select>—; aquí sólo se componen.
  // La frase es la misma que arma el build en index.html (la de
  // .price-card__billed--plazos): si cambia una, cambia la otra.
  // Cada tarjeta con plazos tiene su propio selector (puede haber varias).
  Array.prototype.forEach.call(document.querySelectorAll('.price-card__plazo'), function (plazoSel) {
    var tarjeta = plazoSel.closest('.price-card');
    var montoMsi = tarjeta && tarjeta.querySelector('.price-card__price--plazos .price-card__amount');
    var cobroMsi = tarjeta && tarjeta.querySelector('.price-card__billed--plazos');
    if (!montoMsi) return;
    plazoSel.addEventListener('change', function () {
      var op = plazoSel.options[plazoSel.selectedIndex];
      var precio = op ? op.getAttribute('data-precio') : null;
      if (!precio) return;
      montoMsi.textContent = precio;
      if (cobroMsi) {
        var total = plazoSel.getAttribute('data-total');
        cobroMsi.textContent = op.value + ' pagos de ' + precio +
          (total ? ' \u2014 total ' + total : '');
      }
    });
  });

   /* ==================================================================
     Formulario de contacto - Manejado por formHandler.js
     ================================================================== */
  // El formulario ahora es manejado por formHandler.js
  // que envía datos al Google Apps Script

})();
