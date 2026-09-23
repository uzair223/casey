(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute("data-key");
  if (!key) return;
  var origin = new URL(script.src).origin;
  var frame = document.createElement("iframe");
  frame.src = origin + "/widget/" + encodeURIComponent(key);
  frame.title = "Casey";
  frame.style.cssText =
    "position:fixed;right:16px;bottom:16px;width:min(380px,calc(100vw - 24px));height:min(640px,calc(100vh - 24px));border:0;z-index:2147483000;border-radius:16px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.18);";
  document.body.appendChild(frame);
})();
