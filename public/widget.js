(function () {
  var script = document.currentScript;
  if (!script || !script.parentNode) return;
  var key = script.getAttribute("data-key");
  if (!key) return;
  var origin = new URL(script.src).origin;
  var frame = document.createElement("iframe");
  var pass = new URLSearchParams();
  var search = new URLSearchParams(window.location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach(
    function (name) {
      var value = search.get(name);
      if (value) pass.set(name, value.slice(0, 200));
    },
  );
  var placement = script.getAttribute("data-campaign");
  if (placement) {
    pass.set("placement", placement.slice(0, 80));
    if (!pass.get("utm_campaign")) pass.set("utm_campaign", placement.slice(0, 80));
  }
  pass.set("page", (window.location.origin + window.location.pathname).slice(0, 300));
  if (document.referrer) pass.set("referrer", document.referrer.slice(0, 300));
  frame.src = origin + "/widget/" + encodeURIComponent(key) + "?" + pass.toString();
  frame.title = "Casey";
  frame.allow = "fullscreen";
  frame.style.cssText = "width:100%;height:100%;border:0;display:block;background:#fff;";
  script.parentNode.insertBefore(frame, script);
})();
