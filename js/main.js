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
  function scrollToTarget(target) {
    var top = target.getBoundingClientRect().top + window.scrollY - headerOffset();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  }
  document.querySelectorAll('[data-scroll]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target);
      history.replaceState(null, '', id);
    });
  });

  /* ---------- Nav activo según sección visible ------------------------ */
  var sections = ['hero', 'galeria', 'como-funciona', 'cta', 'compara', 'contacto']
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
    var realSlides = Array.prototype.slice.call(track.children);
    var count = realSlides.length;
    var prevBtn = document.getElementById('sliderPrev');
    var nextBtn = document.getElementById('sliderNext');
    var playBtn = document.getElementById('sliderPlay');
    var iconPlay = document.getElementById('iconPlay');
    var iconPause = document.getElementById('iconPause');
    var dotsWrap = document.getElementById('sliderDots');
    var playing = true;
    var timer = null;
    var INTERVAL = 5000;
    var TRANSITION = 'transform .55s cubic-bezier(.65,.05,.36,1)';
    // Autoplay configurable desde el HTML: <section class="slider" data-autoplay="false">
    var sliderEl = track.closest('.slider');
    var AUTOPLAY = !(sliderEl && sliderEl.getAttribute('data-autoplay') === 'false');

    // --- Loop infinito: clonamos el último al inicio y el primero al final ---
    // Así, al pasar del último al primero (o viceversa) el movimiento continúa
    // en la misma dirección; luego saltamos sin animación al slide real
    // equivalente, evitando el "rebobinado" visual.
    var hasClones = count > 1;
    if (hasClones) {
      var firstClone = realSlides[0].cloneNode(true);
      var lastClone = realSlides[count - 1].cloneNode(true);
      firstClone.setAttribute('aria-hidden', 'true');
      lastClone.setAttribute('aria-hidden', 'true');
      track.appendChild(firstClone);
      track.insertBefore(lastClone, realSlides[0]);
    }
    // Con clones, los slides reales ocupan las posiciones 1..count.
    var index = hasClones ? 1 : 0;   // posición física dentro del track
    var animating = false;
    track.style.transition = TRANSITION;

    function realIndex() {
      if (!hasClones) return index;
      return (index - 1 + count) % count;
    }

    // Dots — uno por slide real
    var dots = realSlides.map(function (_, i) {
      var b = document.createElement('button');
      b.className = 'slider__dot' + (i === 0 ? ' is-active' : '');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Imagen ' + (i + 1));
      b.addEventListener('click', function () { goTo(hasClones ? i + 1 : i); restart(); });
      dotsWrap.appendChild(b);
      return b;
    });

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

    // Pausa al pasar el cursor
    track.parentElement.addEventListener('mouseenter', function () { if (playing && timer) { clearInterval(timer); timer = null; } });
    track.parentElement.addEventListener('mouseleave', function () { if (playing && !timer) { timer = setInterval(next, INTERVAL); } });

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

    // Teclado
    document.getElementById('galeria').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { next(); restart(); }
      if (e.key === 'ArrowLeft') { prev(); restart(); }
    });

    // Posición inicial SIN animación (evita un deslizamiento al cargar)
    track.style.transition = 'none';
    render();
    void track.offsetWidth;
    track.style.transition = TRANSITION;
    // Solo arranca el avance automático si AUTOPLAY está activo.
    if (AUTOPLAY) {
      start();
    } else {
      stop();   // deja el slider en pausa, con los controles manuales disponibles
    }
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
