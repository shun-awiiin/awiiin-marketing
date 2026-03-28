(function () {
  "use strict";

  var WIDGET_ATTR = "data-widget-id";
  var POSITION_ATTR = "data-position";
  var COLOR_ATTR = "data-color";

  var scriptTag = document.currentScript;
  if (!scriptTag) return;

  var widgetId = scriptTag.getAttribute(WIDGET_ATTR);
  if (!widgetId) return;

  var position = scriptTag.getAttribute(POSITION_ATTR) || "bottom-right";
  var primaryColor = scriptTag.getAttribute(COLOR_ATTR) || "#2563eb";
  var apiBase = scriptTag.src.replace(/\/chat-widget\.js.*$/, "");

  var state = {
    open: false,
    screen: "intro",
    visitorId: null,
    conversationId: null,
    name: "",
    email: "",
    messages: [],
    polling: null,
  };

  // Restore session
  try {
    var saved = sessionStorage.getItem("cw-session-" + widgetId);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed.conversationId && parsed.visitorId) {
        state.conversationId = parsed.conversationId;
        state.visitorId = parsed.visitorId;
        state.screen = "chat";
        state.name = parsed.name || "";
        state.email = parsed.email || "";
      }
    }
  } catch (e) {
    // sessionStorage not available
  }

  function saveSession() {
    try {
      if (state.conversationId) {
        sessionStorage.setItem(
          "cw-session-" + widgetId,
          JSON.stringify({
            conversationId: state.conversationId,
            visitorId: state.visitorId,
            name: state.name,
            email: state.email,
          })
        );
      }
    } catch (e) {
      // sessionStorage not available
    }
  }

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "style" && typeof attrs[key] === "object") {
          Object.keys(attrs[key]).forEach(function (s) {
            el.style[s] = attrs[key][s];
          });
        } else if (key.indexOf("on") === 0) {
          el.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
        } else {
          el.setAttribute(key, attrs[key]);
        }
      });
    }
    if (children) {
      if (typeof children === "string") {
        el.textContent = children;
      } else if (Array.isArray(children)) {
        children.forEach(function (child) {
          if (child) {
            el.appendChild(
              typeof child === "string"
                ? document.createTextNode(child)
                : child
            );
          }
        });
      } else {
        el.appendChild(children);
      }
    }
    return el;
  }

  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? parseInt(result[1], 16) +
          "," +
          parseInt(result[2], 16) +
          "," +
          parseInt(result[3], 16)
      : "37,99,235";
  }

  var rgb = hexToRgb(primaryColor);
  var isRight = position === "bottom-right";

  var css = [
    "#cw-root{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;z-index:2147483647;position:fixed;bottom:20px;" +
      (isRight ? "right:20px" : "left:20px") +
      "}",
    "#cw-bubble{width:56px;height:56px;border-radius:50%;background:rgb(" +
      rgb +
      ");color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15);transition:transform .2s}",
    "#cw-bubble:hover{transform:scale(1.08)}",
    "#cw-bubble svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    "#cw-panel{display:none;width:360px;height:500px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);overflow:hidden;flex-direction:column;position:absolute;bottom:68px;" +
      (isRight ? "right:0" : "left:0") +
      "}",
    "#cw-panel.open{display:flex}",
    "#cw-header{background:rgb(" +
      rgb +
      ");color:#fff;padding:16px;display:flex;align-items:center;justify-content:space-between}",
    "#cw-header h3{margin:0;font-size:15px;font-weight:600}",
    "#cw-close{background:none;border:none;color:#fff;cursor:pointer;padding:4px;font-size:18px;line-height:1;opacity:.8}",
    "#cw-close:hover{opacity:1}",
    "#cw-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}",
    "#cw-footer{padding:12px;border-top:1px solid #e5e7eb;display:flex;gap:8px}",
    "#cw-footer input{flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;font-family:inherit}",
    "#cw-footer input:focus{border-color:rgb(" +
      rgb +
      ");box-shadow:0 0 0 2px rgba(" +
      rgb +
      ",.15)}",
    "#cw-send{background:rgb(" +
      rgb +
      ");color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:500;white-space:nowrap}",
    "#cw-send:disabled{opacity:.5;cursor:not-allowed}",
    ".cw-msg{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;word-wrap:break-word;white-space:pre-wrap}",
    ".cw-msg.visitor{background:rgb(" +
      rgb +
      ");color:#fff;align-self:flex-end;border-bottom-right-radius:4px}",
    ".cw-msg.agent{background:#f3f4f6;color:#1f2937;align-self:flex-start;border-bottom-left-radius:4px}",
    ".cw-msg.system{background:transparent;color:#9ca3af;align-self:center;font-size:12px;font-style:italic}",
    ".cw-intro{display:flex;flex-direction:column;gap:12px}",
    ".cw-intro label{font-size:12px;color:#6b7280;font-weight:500}",
    ".cw-intro input{border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;font-family:inherit}",
    ".cw-intro input:focus{border-color:rgb(" +
      rgb +
      ");box-shadow:0 0 0 2px rgba(" +
      rgb +
      ",.15)}",
    ".cw-intro-btn{background:rgb(" +
      rgb +
      ");color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:14px;font-weight:500}",
    ".cw-intro-btn:disabled{opacity:.5;cursor:not-allowed}",
  ].join("\n");

  document.head.appendChild(h("style", null, css));

  var root = h("div", { id: "cw-root" });
  var panel = h("div", { id: "cw-panel" });
  var bubble = h("button", {
    id: "cw-bubble",
    "aria-label": "Open chat",
    onClick: function () {
      togglePanel();
    },
  });
  bubble.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  root.appendChild(panel);
  root.appendChild(bubble);
  document.body.appendChild(root);

  function togglePanel() {
    state.open = !state.open;
    if (state.open) {
      panel.classList.add("open");
      if (state.conversationId) {
        pollMessages();
        startPolling();
      }
      renderPanel();
    } else {
      panel.classList.remove("open");
      stopPolling();
    }
    saveSession();
  }

  function renderPanel() {
    panel.innerHTML = "";

    var closeBtn = h(
      "button",
      { id: "cw-close", onClick: togglePanel, "aria-label": "Close" },
      "\u2715"
    );
    var header = h("div", { id: "cw-header" }, [
      h("h3", null, "Chat"),
      closeBtn,
    ]);
    panel.appendChild(header);

    if (state.screen === "intro") {
      renderIntro();
    } else {
      renderChat();
    }
  }

  function renderIntro() {
    var body = h("div", { id: "cw-body" });

    var greeting = h(
      "p",
      { style: { color: "#4b5563", fontSize: "13px", marginBottom: "4px" } },
      "Hi there! Enter your details to start chatting."
    );

    var form = h("div", { class: "cw-intro" });

    var nameInput = h("input", {
      type: "text",
      placeholder: "Your name (optional)",
      value: state.name,
      onInput: function (e) {
        state.name = e.target.value;
      },
    });

    var emailInput = h("input", {
      type: "email",
      placeholder: "your@email.com (optional)",
      value: state.email,
      onInput: function (e) {
        state.email = e.target.value;
      },
    });

    var msgInput = h("input", {
      type: "text",
      placeholder: "Type your message...",
      onKeydown: function (e) {
        if (e.key === "Enter") submitIntro(e.target.value);
      },
    });

    var startBtn = h(
      "button",
      {
        class: "cw-intro-btn",
        onClick: function () {
          submitIntro(msgInput.value);
        },
      },
      "Start Chat"
    );

    form.appendChild(h("label", null, "Name"));
    form.appendChild(nameInput);
    form.appendChild(h("label", null, "Email"));
    form.appendChild(emailInput);
    form.appendChild(h("label", null, "Message"));
    form.appendChild(msgInput);
    form.appendChild(startBtn);

    body.appendChild(greeting);
    body.appendChild(form);
    panel.appendChild(body);
  }

  function submitIntro(message) {
    if (!message || !message.trim()) return;

    var payload = { widget_id: widgetId, message: message.trim() };
    if (state.name) payload.name = state.name;
    if (state.email) payload.email = state.email;

    fetch(apiBase + "/api/chat/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (json) {
        if (json.data) {
          state.conversationId = json.data.conversation_id;
          state.visitorId = json.data.visitor_id;
          state.messages = [
            {
              id: "initial",
              role: "visitor",
              content: message.trim(),
              created_at: new Date().toISOString(),
            },
          ];
          state.screen = "chat";
          saveSession();
          renderPanel();
          startPolling();
        }
      })
      .catch(function () {
        // Network error
      });
  }

  function renderChat() {
    var body = h("div", { id: "cw-body" });
    state.messages.forEach(function (msg) {
      body.appendChild(h("div", { class: "cw-msg " + msg.role }, msg.content));
    });
    panel.appendChild(body);
    setTimeout(function () {
      body.scrollTop = body.scrollHeight;
    }, 0);

    var input = h("input", {
      type: "text",
      placeholder: "Type a message...",
      onKeydown: function (e) {
        if (e.key === "Enter") sendMessage(input);
      },
    });
    var sendBtn = h(
      "button",
      {
        id: "cw-send",
        onClick: function () {
          sendMessage(input);
        },
      },
      "Send"
    );

    var footer = h("div", { id: "cw-footer" }, [input, sendBtn]);
    panel.appendChild(footer);
    setTimeout(function () {
      input.focus();
    }, 50);
  }

  function sendMessage(inputEl) {
    var content = inputEl.value.trim();
    if (!content || !state.conversationId || !state.visitorId) return;
    inputEl.value = "";

    state.messages.push({
      id: "local-" + Date.now(),
      role: "visitor",
      content: content,
      created_at: new Date().toISOString(),
    });
    renderPanel();

    fetch(apiBase + "/api/chat/public/" + state.conversationId, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-visitor-id": state.visitorId,
      },
      body: JSON.stringify({ content: content }),
    }).catch(function () {
      // Network error
    });
  }

  function pollMessages() {
    if (!state.conversationId || !state.visitorId) return;

    fetch(apiBase + "/api/chat/public/" + state.conversationId, {
      headers: { "x-visitor-id": state.visitorId },
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (json) {
        if (json.data && Array.isArray(json.data)) {
          if (json.data.length !== state.messages.length) {
            state.messages = json.data;
            if (state.open && state.screen === "chat") {
              renderPanel();
            }
          }
        }
      })
      .catch(function () {
        // Network error
      });
  }

  function startPolling() {
    stopPolling();
    state.polling = setInterval(pollMessages, 3000);
  }

  function stopPolling() {
    if (state.polling) {
      clearInterval(state.polling);
      state.polling = null;
    }
  }
})();
