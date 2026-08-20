/**
 * Minimal server-rendered pages for humans: the workbench (sidebar + live
 * stage) and a gallery rendering every story at once. Build-free placeholders
 * for the layer-M2 observer UI. The structure borrows what works in Storybook
 * (search, collapsible tree, a toolbar next to the canvas, a runner button);
 * the visual language follows the k8o design tokens (cool gray page, white
 * cards floating on shadow, teal accent, pill controls, no decorative
 * borders).
 */

const DARK_TOKENS = `
      --bg: #15181c;
      --surface: #1e2329;
      --ink: #e7e9ec;
      --muted: #8b95a1;
      --accent: #14b8a6;
      --accent-soft: #12332f;
      --accent-soft-ink: #5eead4;
      --danger: #ff7a82;
      --hover: #232930;
      --input-border: #333b44;
      --shadow: 0 10px 30px rgb(0 0 0 / 0.35);
      color-scheme: dark;
`;

const SHARED_CSS = `
  :root {
    --bg: #f3f4f6;
    --surface: #ffffff;
    --ink: #1c2126;
    --muted: #697280;
    --accent: #0d9488;
    --accent-soft: #e6f4f2;
    --accent-soft-ink: #0b7268;
    --danger: #b4232c;
    --hover: #e9ecef;
    --input-border: #e2e6ea;
    --radius-card: 20px;
    --shadow: 0 10px 30px rgb(25 35 45 / 0.06);
    color-scheme: light;
  }
  /* Chrome theme: follows the OS unless the user forces one via the toggle. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {${DARK_TOKENS}}
  }
  :root[data-theme="dark"] {${DARK_TOKENS}}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  button, input { font: inherit; color: inherit; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: "Noto Sans JP", "Hiragino Sans", sans-serif;
    font-size: 15px;
    line-height: 1.7;
  }
  a { color: var(--accent); text-decoration: none; }
  .brand { font-weight: 700; font-size: 1.02em; letter-spacing: -0.01em; }
  .pill {
    border: 0;
    background: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 0.85em;
    font-weight: 500;
    padding: 5px 14px;
    border-radius: 999px;
    white-space: nowrap;
    transition: background 0.15s ease-out, color 0.15s ease-out;
  }
  .pill:hover { background: var(--hover); }
  .pill.active { background: var(--accent-soft); color: var(--accent-soft-ink); font-weight: 600; }
  .pill:focus-visible, button:focus-visible, input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .pill.icon { display: inline-flex; align-items: center; padding: 6px 9px; }
  .pill svg { width: 16px; height: 16px; display: block; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

/** Applies the stored chrome theme before paint and wires the 3-state toggle. */
const UI_THEME_HEAD = `<script>
(function () {
  var stored = localStorage.getItem("sunaba-ui-theme");
  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  }
})();
</script>`;

const UI_THEME_SCRIPT = `
(function () {
  var button = document.getElementById("ui-theme");
  if (!button) return;
  var MODES = ["auto", "light", "dark"];
  function current() {
    var stored = localStorage.getItem("sunaba-ui-theme");
    return stored === "light" || stored === "dark" ? stored : "auto";
  }
  function paint() {
    var mode = current();
    button.replaceChildren();
    var template = document.getElementById("icon-theme-" + mode);
    if (template) {
      button.classList.add("icon");
      button.appendChild(template.content.firstElementChild.cloneNode(true));
    } else {
      button.classList.remove("icon");
      button.textContent = "auto";
    }
    button.title = "UI theme: " + mode;
    button.setAttribute("aria-label", "UI theme: " + mode);
    button.classList.toggle("active", mode !== "auto");
  }
  button.onclick = function () {
    var next = MODES[(MODES.indexOf(current()) + 1) % MODES.length];
    if (next === "auto") {
      localStorage.removeItem("sunaba-ui-theme");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("sunaba-ui-theme", next);
      document.documentElement.dataset.theme = next;
    }
    paint();
  };
  paint();
})();
`;

/** Inline icon templates for well-known axis values; unknown axes fall back to text pills. */
const AXIS_ICON_TEMPLATES = `
<template id="icon-theme-light"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg></template>
<template id="icon-theme-dark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></template>
`;

export const CATALOG_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>sunaba</title>
${UI_THEME_HEAD}
<style>
${SHARED_CSS}
  body { display: flex; height: 100svh; overflow: hidden; }

  aside {
    width: 264px;
    flex: none;
    display: flex;
    flex-direction: column;
    padding: 22px 14px 16px;
    gap: 14px;
    min-height: 0;
  }
  .side-head { display: flex; align-items: baseline; gap: 10px; padding: 0 8px; }
  .side-head { align-items: center; }
  .side-head a.gallery { margin-left: auto; font-size: 0.8em; color: var(--muted); }
  .side-head a.gallery:hover { color: var(--accent); }

  .search {
    width: 100%;
    height: 38px;
    border: 1.5px solid var(--input-border);
    background: var(--surface);
    border-radius: 12px;
    padding: 0 14px;
    outline: none;
    font-size: 0.9em;
    transition: border-color 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  .search::placeholder { color: var(--muted); }
  .search:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
  }

  nav { flex: 1; overflow-y: auto; min-height: 0; padding: 2px 0 8px; }
  .group-head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    border: 0;
    background: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 0.78em;
    font-weight: 600;
    padding: 6px 8px 4px;
    margin-top: 10px;
    text-align: left;
  }
  .group-head:first-child { margin-top: 0; }
  .group-head .chev {
    display: inline-block;
    transition: transform 0.15s ease-out;
    font-size: 0.85em;
  }
  .group.closed .chev { transform: rotate(-90deg); }
  .group.closed .items { display: none; }
  .story {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    border: 0;
    background: none;
    color: var(--ink);
    padding: 7px 12px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.92em;
    transition: background 0.15s ease-out;
  }
  .story:hover { background: var(--hover); }
  .story.active { background: var(--accent-soft); color: var(--accent-soft-ink); font-weight: 600; }
  .story .play-mark { margin-left: auto; font-size: 0.72em; color: var(--muted); }
  .story.active .play-mark { color: var(--accent-soft-ink); }
  .hidden { display: none !important; }

  main { flex: 1; min-width: 0; padding: 16px 16px 16px 2px; display: flex; }
  .card {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .toolbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 18px;
  }
  .crumb { flex: 1; font-size: 0.85em; color: var(--muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .crumb b { color: var(--ink); font-weight: 600; }
  @media (max-width: 900px) { .crumb .crumb-title { display: none; } }
  .runner {
    border: 0;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85em;
    background: var(--accent);
    color: #fff;
    border-radius: 999px;
    padding: 6px 16px;
    transition: filter 0.15s ease-out;
  }
  .runner:hover { filter: brightness(0.93); }
  .runner:disabled { opacity: 0.6; cursor: default; }
  .stage-wrap { flex: 1; min-height: 0; }
  .stage-wrap iframe { width: 100%; height: 100%; border: 0; display: block; }
  .statusbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    font-size: 0.8em;
    color: var(--muted);
  }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--muted); flex: none; }
  .dot.rendered { background: var(--accent); }
  .dot.error { background: var(--danger); }
  .statusbar .open { margin-left: auto; }
  .logpanel {
    flex: none;
    max-height: 160px;
    overflow-y: auto;
    padding: 4px 18px 8px;
    font-size: 0.78em;
    color: var(--muted);
  }
  .logpanel > div { padding: 2px 0; }
  .logpanel b { color: var(--ink); font-weight: 600; }
  .logpanel .ok { color: var(--accent); font-weight: 600; }
  .logpanel .ng { color: var(--danger); font-weight: 600; }
  .logpanel .entry.expandable { cursor: pointer; }
  .logpanel .entry.expandable:hover { color: var(--ink); }
  .steps { margin: 2px 0 6px 20px; }
  .steps button {
    display: block;
    width: 100%;
    text-align: left;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 1em;
    padding: 2px 6px;
    border-radius: 6px;
    cursor: pointer;
  }
  .steps button:hover { background: var(--hover); color: var(--ink); }
  .steps button:disabled { cursor: default; opacity: 0.55; }
  .steps button.viewing { background: var(--accent-soft); color: var(--accent-soft-ink); }
</style>
</head>
<body>
<aside>
  <div class="side-head">
    <span class="brand">sunaba</span>
    <a class="gallery" href="/gallery">gallery &rarr;</a>
    <button class="pill" id="ui-theme"></button>
  </div>
  <input id="search" class="search" type="search" placeholder="Filter stories (/)" aria-label="Filter stories" />
  <nav id="sidebar"></nav>
</aside>
${AXIS_ICON_TEMPLATES}
<main>
  <div class="card">
    <div class="toolbar">
      <span class="crumb" id="crumb"></span>
      <span id="axes" style="display:flex; gap:4px;"></span>
      <button class="runner hidden" id="run-play">Run play</button>
      <button class="pill" id="reload" title="Remount">&#8635;</button>
    </div>
    <div class="stage-wrap"><iframe id="stage" title="stage"></iframe></div>
    <div class="logpanel hidden" id="logpanel" aria-label="Operation log"></div>
    <div class="statusbar">
      <span class="dot" id="dot"></span>
      <span id="status">connecting…</span>
      <a href="#" class="open" id="open" target="_blank" rel="noreferrer">open &#8599;</a>
      <button class="pill" id="log-toggle">log</button>
    </div>
  </div>
</main>
<script>
(async function () {
  var res = await fetch("/__sunaba/api/index");
  var data = await res.json();
  var entries = Object.values(data.index.entries);
  var byId = data.index.entries;
  var envState = {};
  new URLSearchParams(location.search).forEach(function (value, key) {
    if (key.indexOf("env.") === 0) envState[key.slice(4)] = value;
  });
  var currentId = null;
  var frame = document.getElementById("stage");
  var statusBox = document.getElementById("status");
  var dot = document.getElementById("dot");
  var crumb = document.getElementById("crumb");
  var runPlayButton = document.getElementById("run-play");

  function storyUrl(id) {
    var params = new URLSearchParams();
    Object.keys(envState).forEach(function (axis) {
      params.set("env." + axis, envState[axis]);
    });
    var query = params.toString();
    return "/render/" + id + (query ? "?" + query : "");
  }

  function setCrumb(id) {
    var entry = byId[id];
    crumb.replaceChildren();
    if (!entry) return;
    var titlePart = document.createElement("span");
    titlePart.className = "crumb-title";
    titlePart.textContent = entry.title + " / ";
    crumb.appendChild(titlePart);
    var name = document.createElement("b");
    name.textContent = entry.name;
    crumb.appendChild(name);
  }

  function highlight(id) {
    currentId = id;
    document.querySelectorAll("button.story").forEach(function (button) {
      button.classList.toggle("active", button.dataset.id === id);
    });
    setCrumb(id);
    var entry = byId[id];
    runPlayButton.classList.toggle("hidden", !(entry && entry.hasPlay));
  }

  function select(id) {
    highlight(id);
    location.hash = "#/story/" + id;
    frame.src = storyUrl(id);
  }

  var sidebar = document.getElementById("sidebar");
  var groups = {};
  entries.forEach(function (entry) {
    (groups[entry.title] = groups[entry.title] || []).push(entry);
  });
  Object.keys(groups).sort().forEach(function (title) {
    var group = document.createElement("div");
    group.className = "group";
    var head = document.createElement("button");
    head.className = "group-head";
    var chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "\\u25be";
    head.appendChild(chev);
    head.append(title);
    head.onclick = function () { group.classList.toggle("closed"); };
    group.appendChild(head);
    var items = document.createElement("div");
    items.className = "items";
    groups[title].forEach(function (entry) {
      var button = document.createElement("button");
      button.className = "story";
      button.dataset.id = entry.id;
      button.append(entry.name);
      if (entry.hasPlay) {
        var mark = document.createElement("span");
        mark.className = "play-mark";
        mark.textContent = "play";
        button.appendChild(mark);
      }
      button.onclick = function () { select(entry.id); };
      items.appendChild(button);
    });
    group.appendChild(items);
    sidebar.appendChild(group);
  });

  var search = document.getElementById("search");
  search.oninput = function () {
    var needle = search.value.toLowerCase();
    document.querySelectorAll(".group").forEach(function (group) {
      var any = false;
      group.querySelectorAll("button.story").forEach(function (button) {
        var match = button.dataset.id.toLowerCase().includes(needle);
        button.classList.toggle("hidden", !match);
        if (match) any = true;
      });
      group.classList.toggle("hidden", !any);
      if (needle) group.classList.remove("closed");
    });
  };
  document.addEventListener("keydown", function (event) {
    if (event.target === search) {
      if (event.key === "Escape") { search.value = ""; search.oninput(); search.blur(); }
      return;
    }
    if (event.key === "/" || (event.key === "k" && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      search.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      var visible = Array.prototype.filter.call(
        document.querySelectorAll("button.story"),
        function (button) { return !button.classList.contains("hidden") && !button.closest(".group").classList.contains("closed"); }
      );
      var index = visible.findIndex(function (button) { return button.dataset.id === currentId; });
      var next = event.key === "ArrowDown" ? index + 1 : index - 1;
      if (next >= 0 && next < visible.length) select(visible[next].dataset.id);
    }
  });

  var axesBox = document.getElementById("axes");
  Object.keys(data.axes || {}).sort().forEach(function (axis) {
    var config = data.axes[axis];
    var fallback = config.default !== undefined ? config.default : config.values[0];
    var button = document.createElement("button");
    button.className = "pill";
    function currentValue() {
      return envState[axis] !== undefined ? envState[axis] : fallback;
    }
    function paint() {
      var value = currentValue();
      var template = document.getElementById("icon-" + axis + "-" + value);
      button.replaceChildren();
      if (template) {
        button.classList.add("icon");
        button.appendChild(template.content.firstElementChild.cloneNode(true));
      } else {
        button.classList.remove("icon");
        button.textContent = axis + ": " + value;
      }
      button.title = axis + ": " + value;
      button.setAttribute("aria-label", axis + ": " + value);
      button.classList.toggle("active", envState[axis] !== undefined);
    }
    button.onclick = function () {
      var index = config.values.indexOf(currentValue());
      var next = config.values[(index + 1) % config.values.length];
      if (next === fallback) delete envState[axis]; else envState[axis] = next;
      paint();
      if (currentId) select(currentId);
    };
    paint();
    axesBox.appendChild(button);
  });

  runPlayButton.onclick = async function () {
    runPlayButton.disabled = true;
    runPlayButton.textContent = "Running…";
    try {
      var result = await fetch("/__sunaba/api/play", { method: "POST" }).then(function (r) { return r.json(); });
      statusBox.textContent = result.status === "passed"
        ? "play passed"
        : "play " + result.status + (result.error ? " — " + result.error.message : result.reason ? " — " + result.reason : "");
    } finally {
      runPlayButton.disabled = false;
      runPlayButton.textContent = "Run play";
    }
  };

  document.getElementById("reload").onclick = function () {
    if (currentId) frame.src = storyUrl(currentId);
  };

  document.getElementById("open").onclick = async function (event) {
    event.preventDefault();
    // The server-computed permalink is canonical (covers agent-set args the
    // iframe URL does not reflect after client-side selects).
    var session = await fetch("/__sunaba/api/session").then(function (r) { return r.json(); });
    window.open(session.permalink || frame.src, "_blank");
  };

  // Operation log: play results and every actor's commands, live.
  var logPanel = document.getElementById("logpanel");

  // Play rows expand into their recorded steps; clicking a step replays that
  // moment's DOM snapshot on the stage ("live" restores the running story).
  function toggleSteps(row, runId) {
    var existing = row.nextElementSibling;
    if (existing && existing.classList.contains("steps")) {
      existing.remove();
      return;
    }
    fetch("/__sunaba/api/play-run?id=" + encodeURIComponent(runId))
      .then(function (r) { return r.json(); })
      .then(function (run) {
        if (!run.steps) return;
        var box = document.createElement("div");
        box.className = "steps";
        function stepButton(label, stepIndex, enabled) {
          var button = document.createElement("button");
          button.textContent = label;
          button.disabled = !enabled;
          button.onclick = function () {
            fetch("/__sunaba/api/show-snapshot", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ runId: runId, step: stepIndex }),
            });
            box.querySelectorAll("button").forEach(function (candidate) {
              candidate.classList.toggle("viewing", candidate === button && stepIndex >= 0);
            });
          };
          box.appendChild(button);
        }
        run.steps.forEach(function (step) {
          var mark = step.kind === "mount" ? "\u25cb " : step.kind === "step" ? "\u25b8 " : "\u2192 ";
          stepButton(mark + step.label + (step.hasSnapshot ? "" : " (no snapshot)"), step.index, step.hasSnapshot);
        });
        stepButton("\u21ba live", -1, true);
        row.after(box);
        logPanel.scrollTop = logPanel.scrollHeight;
      });
  }

  function appendLogEntry(entry) {
    var payload = entry.payload || {};
    var row = document.createElement("div");
    row.className = "entry";
    row.append(entry.at.slice(11, 19) + " ");
    var actor = document.createElement("b");
    actor.textContent = entry.actor;
    row.appendChild(actor);
    var story = payload.story || (payload.address && payload.address.story) || "";
    row.append(" " + entry.command + (story ? " " + story.split("/").pop() : "") + " ");
    if (payload.status) {
      var badge = document.createElement("span");
      badge.className = payload.status === "passed" ? "ok" : "ng";
      badge.textContent = payload.status;
      row.appendChild(badge);
    }
    var detail = payload.error || payload.reason || "";
    if (detail) row.append(" — " + (detail.length > 160 ? detail.slice(0, 160) + "…" : detail));
    if (payload.runId) {
      row.classList.add("expandable");
      row.title = "Click to inspect steps";
      row.onclick = function () { toggleSteps(row, payload.runId); };
    }
    logPanel.appendChild(row);
    logPanel.scrollTop = logPanel.scrollHeight;
  }
  document.getElementById("log-toggle").onclick = function () {
    logPanel.classList.toggle("hidden");
    this.classList.toggle("active");
    logPanel.scrollTop = logPanel.scrollHeight;
  };
  fetch("/__sunaba/api/session").then(function (r) { return r.json(); }).then(function (session) {
    (session.log || []).forEach(appendLogEntry);
  });

  // Observer socket: follow whatever the live stage shows (including
  // agent-driven MCP selects) and surface render status.
  var protocol = location.protocol === "https:" ? "wss:" : "ws:";
  var socket = new WebSocket(protocol + "//" + location.host + "/__sunaba/ws");
  socket.onmessage = function (event) {
    var message = JSON.parse(event.data);
    if (message.kind === "log") {
      appendLogEntry(message.entry);
      return;
    }
    if (message.kind !== "session") return;
    var state = message.state;
    dot.className = "dot " + state.render.status;
    var message = state.render.error ? state.render.error.message : "";
    if (message.length > 200) message = message.slice(0, 200) + "…";
    statusBox.textContent = state.render.status + (message ? " — " + message : "");
    if (state.address && state.address.story !== currentId) {
      highlight(state.address.story);
    }
  };

  var fromHash = location.hash.startsWith("#/story/") ? location.hash.slice("#/story/".length) : null;
  var first = fromHash && byId[fromHash] ? fromHash : (entries[0] && entries[0].id);
  if (first) select(first);
})();
${UI_THEME_SCRIPT}
</script>
</body>
</html>
`;

export const GALLERY_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>sunaba gallery</title>
${UI_THEME_HEAD}
<style>
${SHARED_CSS}
  header {
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding: 22px 28px 6px;
  }
  header .sub { color: var(--muted); font-size: 0.85em; }
  header .axes { margin-left: auto; display: flex; gap: 4px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    padding: 18px 28px 40px;
  }
  figure {
    background: var(--surface);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow);
    overflow: hidden;
    transition: translate 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  figure:hover { translate: 0 -2px; box-shadow: 0 14px 34px rgb(25 35 45 / 0.09); }
  figure iframe { width: 100%; height: 220px; border: 0; display: block; }
  figcaption { padding: 10px 18px 12px; font-size: 0.85em; }
  figcaption a { color: var(--ink); font-weight: 600; }
  figcaption a:hover { color: var(--accent); }
  figcaption .title { color: var(--muted); font-size: 0.9em; margin-left: 6px; }
</style>
</head>
<body>
<header>
  <span class="brand"><a href="/" style="color:inherit">sunaba</a></span>
  <span class="sub">gallery — every story at once</span>
  <span class="axes" id="axes"></span>
</header>
${AXIS_ICON_TEMPLATES}
<div class="grid" id="grid"></div>
<script>
(async function () {
  var res = await fetch("/__sunaba/api/index");
  var data = await res.json();
  var entries = Object.values(data.index.entries);
  var params = new URLSearchParams(location.search);

  var axesBox = document.getElementById("axes");
  Object.keys(data.axes || {}).sort().forEach(function (axis) {
    var config = data.axes[axis];
    var fallback = config.default !== undefined ? config.default : config.values[0];
    var key = "env." + axis;
    var current = params.get(key) !== null ? params.get(key) : fallback;
    var button = document.createElement("button");
    button.className = "pill";
    var template = document.getElementById("icon-" + axis + "-" + current);
    if (template) {
      button.classList.add("icon");
      button.appendChild(template.content.firstElementChild.cloneNode(true));
    } else {
      button.textContent = axis + ": " + current;
    }
    button.title = axis + ": " + current;
    button.setAttribute("aria-label", axis + ": " + current);
    if (params.get(key) !== null) button.classList.add("active");
    button.onclick = function () {
      var index = config.values.indexOf(current);
      var value = config.values[(index + 1) % config.values.length];
      var next = new URLSearchParams(location.search);
      if (value === fallback) next.delete(key); else next.set(key, value);
      location.search = next.toString();
    };
    axesBox.appendChild(button);
  });

  var query = params.toString();
  var grid = document.getElementById("grid");

  // Only tiles near the viewport stay live. A tile is a full page (modules,
  // React root, HMR socket), so hundreds of always-on iframes would pile up
  // memory, CPU (running animations/timers), and websocket connections.
  var observer = new IntersectionObserver(
    function (observed) {
      observed.forEach(function (item) {
        var frame = item.target.querySelector("iframe");
        if (item.isIntersecting) {
          if (frame.dataset.src && frame.src !== frame.dataset.src) {
            frame.src = frame.dataset.src;
          }
        } else if (frame.src && frame.src !== "about:blank") {
          frame.src = "about:blank";
        }
      });
    },
    { rootMargin: "600px 0px" },
  );

  entries.forEach(function (entry) {
    var figure = document.createElement("figure");
    var frame = document.createElement("iframe");
    frame.dataset.src =
      location.origin + "/render/" + entry.id + (query ? "?" + query : "") + "#passive";
    var caption = document.createElement("figcaption");
    var link = document.createElement("a");
    link.href = "/" + (query ? "?" + query : "") + "#/story/" + entry.id;
    link.textContent = entry.name;
    var title = document.createElement("span");
    title.className = "title";
    title.textContent = entry.title;
    caption.appendChild(link);
    caption.appendChild(title);
    figure.appendChild(frame);
    figure.appendChild(caption);
    grid.appendChild(figure);
    observer.observe(figure);
  });
})();
${UI_THEME_SCRIPT}
</script>
</body>
</html>
`;
