/*
 * Widget del cotizador en línea de HETNA CNC (estrategia 2.3).
 * Pega en tu página web, donde quieras que aparezca el cotizador:
 *
 *   <div data-hetna-cotizador="tu-taller"></div>
 *   <script src="https://hetnacnc.com/widget/cotizador.js" async></script>
 *
 * Crea un iframe con hetnacnc.com/mx/embed/t/<taller> y lo hace crecer a la
 * altura de su contenido (el iframe avisa su alto con postMessage).
 */
(function () {
  var ORIGEN = "https://hetnacnc.com";
  var SLUG = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;
  function montar(el) {
    if (el.getAttribute("data-hetna-listo")) return;
    var slug = String(el.getAttribute("data-hetna-cotizador") || "").trim().toLowerCase();
    if (!SLUG.test(slug)) return;
    el.setAttribute("data-hetna-listo", "1");
    var f = document.createElement("iframe");
    f.src = ORIGEN + "/mx/embed/t/" + slug;
    f.title = "Cotizador en línea";
    f.loading = "lazy";
    f.setAttribute("data-hetna-slug", slug);
    f.style.cssText = "width:100%;min-height:640px;border:0;display:block;background:#fff;border-radius:12px";
    f.allow = "clipboard-write";
    el.appendChild(f);
  }
  function todos() {
    var els = document.querySelectorAll("[data-hetna-cotizador]");
    for (var i = 0; i < els.length; i++) montar(els[i]);
  }
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGEN || !e.data || e.data.hetna !== "alto") return;
    var fs = document.querySelectorAll("iframe[data-hetna-slug]");
    for (var i = 0; i < fs.length; i++) {
      if (fs[i].contentWindow === e.source) fs[i].style.height = Math.max(400, Math.min(6000, Number(e.data.alto) || 0)) + "px";
    }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", todos);
  else todos();
})();
