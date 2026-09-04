/* =========================================================================
   FANCYBOX / Lightbox — comportamiento tipo ricantropo.com
   No es un iframe: es un <div> que crea una "página virtual" sobre la
   página real. Solo el contenido del recuadro hace scroll; el body queda
   bloqueado, sin importar qué tan larga sea la página de origen.
   Se activa sobre cualquier <a data-fancybox="grupo" href="imagen">.

   Dos modos:
   · Móvil (<640px) → COLUMNA: se abre la serie completa apilada a todo lo
     ancho, con scroll vertical; las flechas van arriba y abajo (fixed) y
     saltan a la imagen anterior / siguiente.
   · Tablet en adelante → una sola imagen, flechas a los costados.
   ========================================================================= */
(function () {
  "use strict";

  var links = Array.prototype.slice.call(document.querySelectorAll("a[data-fancybox]"));
  if (!links.length) return;

  var MOBILE = "(max-width: 639.98px)";
  var index = 0;
  var lastFocus = null;
  var scrollY = 0;
  var stackMode = false;
  var stackImgs = [];
  var syncing = false;

  function isMobile() { return window.matchMedia(MOBILE).matches; }

  /* ---- Estructura del lightbox (inyectada una sola vez) ----------------- */
  var box = document.createElement("div");
  box.className = "fbx";
  box.id = "fbx";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Vista ampliada");
  box.setAttribute("aria-hidden", "true");
  box.innerHTML =
    '<div class="fbx__overlay" data-fbx-close></div>' +
    '<div class="fbx__scroll" data-fbx-close>' +
      '<div class="fbx__frame"></div>' +
    '</div>' +
    '<button class="fbx__btn fbx__btn--prev" type="button" aria-label="Anterior">' +
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
    '</button>' +
    '<button class="fbx__btn fbx__btn--next" type="button" aria-label="Siguiente">' +
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>' +
    '</button>' +
    '<button class="fbx__btn fbx__btn--close" type="button" aria-label="Cerrar">' +
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
    '</button>' +
    '<div class="fbx__counter" aria-live="polite"></div>';
  document.body.appendChild(box);

  var scroller = box.querySelector(".fbx__scroll");
  var frame    = box.querySelector(".fbx__frame");
  var counter  = box.querySelector(".fbx__counter");
  var btnPrev  = box.querySelector(".fbx__btn--prev");
  var btnNext  = box.querySelector(".fbx__btn--next");
  var btnClose = box.querySelector(".fbx__btn--close");

  function makeImg(a) {
    var el = document.createElement("img");
    el.className = "fbx__img";
    /* Reserva el espacio antes de decodificar (las fuentes son cuadradas 800x800):
       si no, offsetTop se lee en 0 y la columna no cae en la imagen correcta. */
    el.width = 800;
    el.height = 800;
    var thumb = a.querySelector("img");
    el.alt = thumb ? thumb.alt : "";
    el.addEventListener("load", function () { el.classList.add("is-ready"); });
    el.src = a.getAttribute("href");
    if (el.complete) el.classList.add("is-ready");
    return el;
  }

  function setCounter() { counter.textContent = (index + 1) + " / " + links.length; }

  /* ---- Modo COLUMNA (móvil): toda la serie apilada ----------------------- */
  function buildStack() {
    frame.textContent = "";
    /* Las flechas y el cerrar vuelven a ser fixed respecto del recuadro */
    box.appendChild(btnPrev);
    box.appendChild(btnNext);
    box.appendChild(btnClose);
    stackImgs = links.map(function (a, i) {
      var el = makeImg(a);
      if (i > 1) el.loading = "lazy";
      frame.appendChild(el);
      return el;
    });
  }

  function scrollToIndex(instant) {
    var el = stackImgs[index];
    if (!el) return;
    syncing = true;
    scroller.scrollTo({ top: el.offsetTop, behavior: instant ? "auto" : "smooth" });
    if (instant) {
      requestAnimationFrame(function () { scroller.scrollTop = stackImgs[index].offsetTop; });
    }
    setTimeout(function () { syncing = false; }, instant ? 120 : 420);
  }

  /* Sincroniza el contador con la imagen visible al hacer scroll */
  scroller.addEventListener("scroll", function () {
    if (!stackMode || syncing) return;
    var mid = scroller.scrollTop + scroller.clientHeight / 2;
    for (var i = 0; i < stackImgs.length; i++) {
      var el = stackImgs[i];
      if (mid >= el.offsetTop && mid < el.offsetTop + el.offsetHeight) {
        if (i !== index) { index = i; setCounter(); }
        break;
      }
    }
  }, { passive: true });

  /* ---- Modo única imagen (tablet+) -------------------------------------- */
  function renderSingle() {
    frame.textContent = "";
    /* .fbx__stage envuelve la imagen ajustándose a su tamaño exacto; las
       flechas y el cerrar se meten dentro para referirse a la imagen. */
    var stage = document.createElement("div");
    stage.className = "fbx__stage";
    stage.appendChild(makeImg(links[index]));
    stage.appendChild(btnPrev);
    stage.appendChild(btnNext);
    stage.appendChild(btnClose);
    frame.appendChild(stage);
    scroller.scrollTop = 0;
  }

  function build(instantScroll) {
    stackMode = isMobile();
    box.classList.toggle("fbx--stack", stackMode);
    if (stackMode) { buildStack(); scrollToIndex(instantScroll !== false); }
    else { renderSingle(); }
    setCounter();
  }

  function open(i) {
    index = i;
    lastFocus = document.activeElement;
    scrollY = window.scrollY || window.pageYOffset;
    /* Bloquea el scroll del documento conservando la posición actual */
    document.body.style.top = "-" + scrollY + "px";
    document.documentElement.classList.add("fbx-lock");
    box.classList.add("is-open");
    box.setAttribute("aria-hidden", "false");
    build(true);
    btnClose.focus();
  }

  function close() {
    box.classList.remove("is-open");
    box.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("fbx-lock");
    document.body.style.top = "";
    /* Restaura la posición SIN animación y una vez que el layout ya no está
       colapsado (si no, el destino se recorta a 0 y la página salta arriba). */
    var prevBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, scrollY);
    requestAnimationFrame(function () {
      window.scrollTo(0, scrollY);
      document.documentElement.style.scrollBehavior = prevBehavior;
    });
    frame.textContent = "";
    stackImgs = [];
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function go(step) {
    index = (index + step + links.length) % links.length;
    setCounter();
    if (stackMode) scrollToIndex(false);
    else renderSingle();
  }

  links.forEach(function (a, i) {
    a.addEventListener("click", function (e) { e.preventDefault(); open(i); });
  });

  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", function () { go(-1); });
  btnNext.addEventListener("click", function () { go(1); });

  /* Cerrar al hacer clic fuera de la imagen */
  box.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-fbx-close") || e.target.classList.contains("fbx__frame")) close();
  });

  document.addEventListener("keydown", function (e) {
    if (!box.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
  });

  /* Swipe horizontal — solo en modo única imagen */
  var x0 = null;
  scroller.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  scroller.addEventListener("touchend", function (e) {
    if (x0 === null || stackMode) { x0 = null; return; }
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 55) go(dx < 0 ? 1 : -1);
    x0 = null;
  }, { passive: true });

  /* Si se cruza el breakpoint con el lightbox abierto, reconstruye el modo */
  window.matchMedia(MOBILE).addEventListener("change", function () {
    if (box.classList.contains("is-open")) build(true);
  });
})();
