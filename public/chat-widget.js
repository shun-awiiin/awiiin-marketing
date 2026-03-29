(function () {
  "use strict";

  var scriptTag = document.currentScript;
  if (!scriptTag) return;

  var widgetId = scriptTag.getAttribute("data-widget-id");
  if (!widgetId) return;

  var position = scriptTag.getAttribute("data-position") || "bottom-right";
  var primaryColor = scriptTag.getAttribute("data-color") || "#6366f1";
  var brandName = scriptTag.getAttribute("data-name") || "Support";
  var brandIcon = scriptTag.getAttribute("data-icon") || "";
  var welcomeMsg = scriptTag.getAttribute("data-welcome") || "";
  var placeholderMsg = scriptTag.getAttribute("data-placeholder") || "Send a message...";
  var apiBase = scriptTag.src.replace(/\/chat-widget\.js.*$/, "");

  var STORAGE_KEY = "cw-" + widgetId;

  var state = { open: false, screen: "intro", visitorId: null, conversationId: null, name: "", email: "", messages: [], polling: null };

  // Use localStorage instead of sessionStorage so conversations persist across page reloads and widget close/reopen
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      var p = JSON.parse(saved);
      if (p.conversationId && p.visitorId) {
        state.conversationId = p.conversationId;
        state.visitorId = p.visitorId;
        state.screen = "chat";
        state.name = p.name || "";
        state.email = p.email || "";
      }
    }
  } catch (e) {}

  function save() {
    try {
      if (state.conversationId) localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversationId: state.conversationId, visitorId: state.visitorId, name: state.name, email: state.email }));
    } catch (e) {}
  }

  function $(tag, props, kids) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "style" && typeof props[k] === "object") Object.assign(el.style, props[k]);
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2).toLowerCase(), props[k]);
      else if (k === "html") el.innerHTML = props[k];
      else el.setAttribute(k, props[k]);
    });
    if (kids != null) {
      if (typeof kids === "string") el.textContent = kids;
      else if (Array.isArray(kids)) kids.forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
      else el.appendChild(kids);
    }
    return el;
  }

  function timeStr(iso) { if (!iso) return ""; var d = new Date(iso); return d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2); }

  var isR = position === "bottom-right";

  // ---- STYLES ----
  var S = document.createElement("style");
  S.textContent = '#cw-root{--cw:' + primaryColor + ';font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.5;position:fixed;bottom:24px;' + (isR ? 'right:24px' : 'left:24px') + ';z-index:2147483647}' +
    '#cw-root *{box-sizing:border-box;margin:0;padding:0}' +

    // Launcher
    '#cw-launcher{width:64px;height:64px;border-radius:50%;background:var(--cw);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.2);transition:transform .2s,box-shadow .2s}' +
    '#cw-launcher:hover{transform:scale(1.05);box-shadow:0 8px 28px rgba(0,0,0,.25)}' +
    '#cw-launcher svg{width:28px;height:28px;transition:transform .3s}' +
    '#cw-launcher.open svg{transform:rotate(90deg)}' +

    // Frame
    '#cw-frame{display:none;position:absolute;bottom:76px;' + (isR ? 'right:0' : 'left:0') + ';width:400px;height:min(680px,calc(100vh - 100px));border-radius:20px;background:#fff;box-shadow:0 16px 60px rgba(0,0,0,.16),0 0 0 1px rgba(0,0,0,.04);overflow:hidden;flex-direction:column;opacity:0;transform:translateY(16px) scale(.95);transition:opacity .25s cubic-bezier(.4,0,.2,1),transform .25s cubic-bezier(.4,0,.2,1)}' +
    '#cw-frame.open{display:flex;opacity:1;transform:translateY(0) scale(1)}' +
    '#cw-frame.closing{opacity:0;transform:translateY(16px) scale(.95)}' +

    // Header
    '#cw-header{background:var(--cw);color:#fff;padding:20px 20px 18px;flex-shrink:0}' +
    '#cw-header-row{display:flex;align-items:center;justify-content:space-between}' +
    '#cw-header-left{display:flex;align-items:center;gap:12px}' +
    '#cw-avatar{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;overflow:hidden;flex-shrink:0;border:2.5px solid rgba(255,255,255,.3)}' +
    '#cw-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}' +
    '#cw-brand{font-size:18px;font-weight:700;letter-spacing:-.02em}' +
    '#cw-sub{font-size:12px;opacity:.8;margin-top:2px;display:flex;align-items:center;gap:6px}' +
    '#cw-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:cw-glow 2s ease infinite}' +
    '@keyframes cw-glow{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.5)}50%{box-shadow:0 0 0 4px rgba(74,222,128,0)}}' +
    '#cw-x{background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;transition:background .15s}' +
    '#cw-x:hover{background:rgba(255,255,255,.22)}' +

    // Body
    '#cw-body{flex:1;overflow-y:auto;overflow-x:hidden;background:#f8f9fb;display:flex;flex-direction:column}' +
    '#cw-body::-webkit-scrollbar{width:5px}' +
    '#cw-body::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:5px}' +

    // Welcome card
    '.cw-wc{margin:20px 16px 12px;display:flex;gap:10px;align-items:flex-start}' +
    '.cw-wc-av{width:34px;height:34px;border-radius:50%;background:var(--cw);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.1)}' +
    '.cw-wc-av img{width:100%;height:100%;object-fit:cover;border-radius:50%}' +
    '.cw-wc-b{background:#fff;border-radius:16px 16px 16px 4px;padding:14px 16px;font-size:14px;color:#374151;line-height:1.7;box-shadow:0 1px 4px rgba(0,0,0,.05);white-space:pre-wrap;min-width:0;overflow-wrap:break-word;word-break:break-word}' +

    // Messages
    '.cw-msgs{padding:6px 16px 16px;display:flex;flex-direction:column;gap:6px}' +
    '.cw-m{display:flex;gap:8px;align-items:flex-end;animation:cw-up .2s ease-out;min-width:0}' +
    '.cw-m.v{flex-direction:row-reverse}' +
    '@keyframes cw-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '.cw-m-av{width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;overflow:hidden}' +
    '.cw-m-av.a{background:var(--cw);color:#fff}' +
    '.cw-m-av.a img{width:100%;height:100%;object-fit:cover;border-radius:50%}' +
    '.cw-m-c{max-width:75%;min-width:0}' +
    '.cw-m-t{padding:10px 14px;font-size:15px;line-height:1.55;overflow-wrap:break-word;word-break:break-word;white-space:pre-wrap}' +
    '.cw-m-t.v{background:var(--cw);color:#fff;border-radius:18px 18px 4px 18px}' +
    '.cw-m-t.a{background:#fff;color:#1f2937;border-radius:18px 18px 18px 4px;box-shadow:0 1px 3px rgba(0,0,0,.06)}' +
    '.cw-m-ts{font-size:11px;color:#b0b5bf;margin-top:3px;padding:0 4px}' +
    '.cw-m.v .cw-m-ts{text-align:right}' +

    // Intro form
    '#cw-intro{padding:18px 20px;background:#fff;border-top:1px solid #f0f1f3;flex-shrink:0}' +
    '#cw-intro-t{font-size:14px;color:#4b5563;margin-bottom:12px;font-weight:500}' +
    '.cw-f{margin-bottom:10px}' +
    '.cw-f label{display:block;font-size:11px;color:#9ca3af;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}' +
    '.cw-f input{width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit;background:#fafbfc;transition:all .15s}' +
    '.cw-f input:focus{border-color:var(--cw);background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.08)}' +

    // Footer
    '#cw-ft{padding:12px 16px;border-top:1px solid #f0f1f3;background:#fff;display:flex;gap:8px;align-items:flex-end;flex-shrink:0}' +
    '#cw-ft textarea{flex:1;border:1.5px solid #e5e7eb;border-radius:16px;padding:10px 16px;font-size:15px;outline:none;font-family:inherit;background:#fafbfc;transition:all .15s;resize:none;line-height:1.4;max-height:120px;min-height:42px}' +
    '#cw-ft textarea:focus{border-color:var(--cw);background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.08)}' +
    '#cw-ft input{flex:1;border:1.5px solid #e5e7eb;border-radius:20px;padding:10px 16px;font-size:15px;outline:none;font-family:inherit;background:#fafbfc;transition:all .15s}' +
    '#cw-ft input:focus{border-color:var(--cw);background:#fff;box-shadow:0 0 0 3px rgba(99,102,241,.08)}' +
    '#cw-ft button{width:42px;height:42px;border-radius:50%;background:var(--cw);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s,filter .15s}' +
    '#cw-ft button:hover{transform:scale(1.06);filter:brightness(1.1)}' +
    '#cw-ft button svg{width:18px;height:18px}' +
    '#cw-ft-hint{font-size:10px;color:#b0b5bf;text-align:center;padding:0 16px 8px;background:#fff}' +

    // Image messages
    '.cw-m-img{max-width:100%;border-radius:10px;cursor:pointer;display:block;margin:2px 0}' +
    '.cw-m-img:hover{opacity:.9}' +

    // Attachment button
    '#cw-attach{width:40px;height:40px;border-radius:50%;background:transparent;color:#9ca3af;border:1.5px solid #e5e7eb;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:color .15s,border-color .15s}' +
    '#cw-attach:hover{color:var(--cw);border-color:var(--cw)}' +
    '#cw-attach svg{width:18px;height:18px}' +

    // Responsive
    '@media(max-width:460px){#cw-frame{width:calc(100vw - 16px);height:calc(100vh - 90px);bottom:72px;' + (isR ? 'right:-12px' : 'left:-12px') + ';border-radius:16px}}';

  document.head.appendChild(S);

  // ---- DOM ----
  var root = $("div", { id: "cw-root" });
  var frame = $("div", { id: "cw-frame" });
  var launcher = $("button", { id: "cw-launcher", "aria-label": "Chat", onClick: toggle, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' });
  root.appendChild(frame);
  root.appendChild(launcher);
  document.body.appendChild(root);

  function toggle() {
    if (state.open) {
      frame.classList.add("closing");
      launcher.classList.remove("open");
      setTimeout(function () { state.open = false; frame.classList.remove("open", "closing"); stopPoll(); }, 200);
    } else {
      state.open = true;
      launcher.classList.add("open");
      frame.classList.add("open");
      if (state.conversationId) { poll(); startPoll(); }
      render();
    }
    save();
  }

  function agentAv(cls) {
    if (brandIcon) { var w = $("div", { class: cls }); w.appendChild($("img", { src: brandIcon })); return w; }
    return $("div", { class: cls }, brandName.charAt(0).toUpperCase());
  }

  function render() {
    frame.innerHTML = "";

    // Header
    var hAv = agentAv("");
    hAv.id = "cw-avatar";
    var hLeft = $("div", { id: "cw-header-left" }, [
      hAv,
      $("div", null, [
        $("div", { id: "cw-brand" }, brandName),
        $("div", { id: "cw-sub" }, [$("span", { id: "cw-dot" }), document.createTextNode("Online now")]),
      ]),
    ]);
    var xBtn = $("button", { id: "cw-x", onClick: toggle, html: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' });
    frame.appendChild($("div", { id: "cw-header" }, [$("div", { id: "cw-header-row" }, [hLeft, xBtn])]));

    state.screen === "intro" ? renderIntro() : renderChat();
  }

  function renderIntro() {
    var body = $("div", { id: "cw-body" });
    var wt = welcomeMsg || "Hi there! How can we help you today?";
    body.appendChild($("div", { class: "cw-wc" }, [agentAv("cw-wc-av"), $("div", { class: "cw-wc-b" }, wt)]));
    frame.appendChild(body);

    // Form
    var ni = $("input", { type: "text", placeholder: "Your name", value: state.name, onInput: function (e) { state.name = e.target.value; } });
    var ei = $("input", { type: "email", placeholder: "you@example.com", value: state.email, onInput: function (e) { state.email = e.target.value; } });
    frame.appendChild($("div", { id: "cw-intro" }, [
      $("div", { id: "cw-intro-t" }, "Start a conversation"),
      $("div", { class: "cw-f" }, [$("label", null, "Name"), ni]),
      $("div", { class: "cw-f" }, [$("label", null, "Email"), ei]),
    ]));

    // Footer
    var mi = $("input", { type: "text", placeholder: placeholderMsg, onKeydown: function (e) { if (e.key === "Enter") go(mi.value); } });
    var sb = $("button", { onClick: function () { go(mi.value); }, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' });
    frame.appendChild($("div", { id: "cw-ft" }, [mi, sb]));
  }

  function go(msg) {
    if (!msg || !msg.trim()) return;
    var body = { widget_id: widgetId, message: msg.trim() };
    if (state.name) body.name = state.name;
    if (state.email) body.email = state.email;
    if (state.visitorId) body.visitor_id = state.visitorId;
    fetch(apiBase + "/api/chat/public", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.data) {
          state.conversationId = j.data.conversation_id;
          state.visitorId = j.data.visitor_id;
          state.messages = [{ id: "1", role: "visitor", content: msg.trim(), created_at: new Date().toISOString() }];
          state.screen = "chat";
          save(); render(); startPoll();
        }
      }).catch(function () {});
  }

  function renderChat() {
    var body = $("div", { id: "cw-body" });
    var wt = welcomeMsg || "Hi there! How can we help you today?";
    body.appendChild($("div", { class: "cw-wc" }, [agentAv("cw-wc-av"), $("div", { class: "cw-wc-b" }, wt)]));

    var wrap = $("div", { class: "cw-msgs" });
    state.messages.forEach(function (m) {
      var isV = m.role === "visitor";
      var row;
      var bub;
      var imgUrl = m.metadata && m.metadata.image_url;
      if (imgUrl) {
        bub = $("div", { class: "cw-m-t " + (isV ? "v" : "a") });
        var img = $("img", { class: "cw-m-img", src: imgUrl, alt: "Image", onClick: function () { window.open(imgUrl, "_blank"); } });
        bub.appendChild(img);
      } else {
        bub = $("div", { class: "cw-m-t " + (isV ? "v" : "a") }, m.content);
      }
      var ts = $("div", { class: "cw-m-ts" }, timeStr(m.created_at));
      if (isV) {
        // Visitor: no avatar, just right-aligned bubble (iMessage style)
        row = $("div", { class: "cw-m v" }, [$("div", { class: "cw-m-c" }, [bub, ts])]);
      } else {
        // Agent: show avatar on left
        row = $("div", { class: "cw-m" }, [agentAv("cw-m-av a"), $("div", { class: "cw-m-c" }, [bub, ts])]);
      }
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
    frame.appendChild(body);
    setTimeout(function () { body.scrollTop = body.scrollHeight; }, 0);

    var inp = $("textarea", { rows: "1", placeholder: placeholderMsg, onKeydown: function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(inp); } }, onInput: function () { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 120) + "px"; } });
    var fileIn = $("input", { type: "file", accept: "image/jpeg,image/png,image/gif,image/webp", style: { display: "none" }, onChange: function () { if (fileIn.files && fileIn.files[0]) uploadFile(fileIn.files[0]); fileIn.value = ""; } });
    var attachBtn = $("button", { id: "cw-attach", onClick: function () { fileIn.click(); }, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>' });
    var sb = $("button", { onClick: function () { send(inp); }, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' });
    frame.appendChild($("div", { id: "cw-ft" }, [fileIn, attachBtn, inp, sb]));
    frame.appendChild($("div", { id: "cw-ft-hint" }, "Shift+Enter\u3067\u6539\u884c"));
    setTimeout(function () { inp.focus(); }, 50);
  }

  function send(el) {
    var c = el.value.trim();
    if (!c || !state.conversationId || !state.visitorId) return;
    el.value = "";
    el.style.height = "auto";
    state.messages.push({ id: "l" + Date.now(), role: "visitor", content: c, created_at: new Date().toISOString() });
    render();
    fetch(apiBase + "/api/chat/public/" + state.conversationId, { method: "POST", headers: { "Content-Type": "application/json", "x-visitor-id": state.visitorId }, body: JSON.stringify({ content: c }) }).catch(function () {});
  }

  function uploadFile(file) {
    if (!state.conversationId || !state.visitorId) return;
    var fd = new FormData();
    fd.append("file", file);
    fd.append("conversation_id", state.conversationId);
    fd.append("visitor_id", state.visitorId);
    fetch(apiBase + "/api/chat/upload", { method: "POST", body: fd })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.data && j.data.url) {
          var meta = { image_url: j.data.url };
          state.messages.push({ id: "l" + Date.now(), role: "visitor", content: "[画像]", metadata: meta, created_at: new Date().toISOString() });
          render();
          fetch(apiBase + "/api/chat/public/" + state.conversationId, { method: "POST", headers: { "Content-Type": "application/json", "x-visitor-id": state.visitorId }, body: JSON.stringify({ content: "[画像]", metadata: meta }) }).catch(function () {});
        }
      }).catch(function () {});
  }

  function poll() {
    if (!state.conversationId || !state.visitorId) return;
    fetch(apiBase + "/api/chat/public/" + state.conversationId, { headers: { "x-visitor-id": state.visitorId } })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.data && Array.isArray(j.data) && j.data.length !== state.messages.length) { state.messages = j.data; if (state.open && state.screen === "chat") render(); } })
      .catch(function () {});
  }

  function startPoll() { stopPoll(); state.polling = setInterval(poll, 3000); }
  function stopPoll() { if (state.polling) { clearInterval(state.polling); state.polling = null; } }
})();
