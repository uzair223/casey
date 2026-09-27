(function () {
  var script = document.currentScript;
  if (!script || !script.parentNode) return;
  var key = script.getAttribute("data-key");
  if (!key) return;
  var origin = new URL(script.src).origin;
  var frame = document.createElement("iframe");
  frame.src = origin + "/widget/" + encodeURIComponent(key);
  frame.title = "Casey";
  frame.allow = "fullscreen";
  frame.style.cssText = "width:100%;height:100%;border:0;display:block;background:#fff;";
  script.parentNode.insertBefore(frame, script);
})();
