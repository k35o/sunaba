/**
 * Minimal server-rendered pages for humans: a catalog top page and a gallery
 * that renders every story at once. These are intentionally build-free
 * placeholders — the real observer UI (prebuilt React app) replaces them in
 * layer M2.
 */

const SHARED_CSS = `
  :root { --bg:#f7f6f3; --fg:#1f2328; --muted:#6b7280; --accent:#0a7c6a; --border:#d5d2ca; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14171a; --fg:#e8e6e1; --muted:#9aa4ad; --accent:#2fbf9f; --border:#3a4046; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:system-ui,sans-serif; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  header { display:flex; align-items:baseline; gap:1rem; padding:1.25rem 2rem; border-bottom:1px solid var(--border); }
  header h1 { font-size:1.1rem; margin:0; }
  header .sub { color:var(--muted); font-size:0.85rem; }
  main { padding: 1.5rem 2rem; }
`;

export const CATALOG_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>sunaba</title>
<style>
${SHARED_CSS}
  body { display: flex; flex-direction: column; height: 100svh; }
  header { flex: none; align-items: center; padding: 0.75rem 1.25rem; }
  .axes { margin-left: auto; display: flex; gap: 0.4rem; }
  .axes button { border: 1px solid var(--border); background: transparent; color: var(--fg); border-radius: 0.4rem; padding: 0.2rem 0.6rem; cursor: pointer; }
  .axes button.active { border-color: var(--accent); color: var(--accent); }
  .layout { flex: 1; display: flex; min-height: 0; }
  aside { width: 240px; flex: none; overflow-y: auto; border-right: 1px solid var(--border); padding: 1rem 0.75rem; }
  aside h2 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 1rem 0 0.25rem; }
  aside h2:first-child { margin-top: 0; }
  aside button.story { display: block; width: 100%; text-align: left; border: 0; background: transparent; color: var(--fg); padding: 0.3rem 0.6rem; border-radius: 0.4rem; cursor: pointer; font-size: 0.9rem; }
  aside button.story:hover { background: color-mix(in oklab, var(--accent) 12%, transparent); }
  aside button.story.active { background: color-mix(in oklab, var(--accent) 20%, transparent); color: var(--accent); }
  .stage { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .stage iframe { flex: 1; border: 0; width: 100%; }
  .stagebar { flex: none; display: flex; gap: 1rem; padding: 0.4rem 1rem; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--muted); }
</style>
</head>
<body>
<header>
  <h1>sunaba</h1>
  <span class="sub">component workbench</span>
  <a href="/gallery">gallery →</a>
  <span class="axes" id="axes"></span>
</header>
<div class="layout">
  <aside id="sidebar">loading…</aside>
  <div class="stage">
    <iframe id="stage" title="stage"></iframe>
    <div class="stagebar">
      <span id="status"></span>
      <a href="#" id="open" target="_blank" rel="noreferrer">open ↗</a>
    </div>
  </div>
</div>
<script>
(async function () {
  var res = await fetch("/__sunaba/api/index");
  var data = await res.json();
  var entries = Object.values(data.index.entries);
  var envState = {};
  var currentId = null;
  var frame = document.getElementById("stage");
  var statusBox = document.getElementById("status");

  function storyUrl(id) {
    var params = new URLSearchParams();
    Object.keys(envState).forEach(function (axis) {
      params.set("env." + axis, envState[axis]);
    });
    var query = params.toString();
    return "/render/" + id + (query ? "?" + query : "");
  }

  function highlight(id) {
    currentId = id;
    document.querySelectorAll("button.story").forEach(function (button) {
      button.classList.toggle("active", button.dataset.id === id);
    });
  }

  function select(id) {
    highlight(id);
    location.hash = "#/story/" + id;
    frame.src = storyUrl(id);
  }

  var sidebar = document.getElementById("sidebar");
  sidebar.replaceChildren();
  var groups = {};
  entries.forEach(function (entry) {
    (groups[entry.title] = groups[entry.title] || []).push(entry);
  });
  Object.keys(groups).sort().forEach(function (title) {
    var heading = document.createElement("h2");
    heading.textContent = title;
    sidebar.appendChild(heading);
    groups[title].forEach(function (entry) {
      var button = document.createElement("button");
      button.className = "story";
      button.dataset.id = entry.id;
      button.textContent = entry.name + (entry.hasPlay ? " \u25b8" : "");
      button.onclick = function () { select(entry.id); };
      sidebar.appendChild(button);
    });
  });

  var axesBox = document.getElementById("axes");
  Object.keys(data.axes || {}).sort().forEach(function (axis) {
    data.axes[axis].forEach(function (value) {
      var button = document.createElement("button");
      button.textContent = axis + ":" + value;
      button.onclick = function () {
        if (envState[axis] === value) delete envState[axis]; else envState[axis] = value;
        axesBox.querySelectorAll("button").forEach(function (candidate) {
          var parts = candidate.textContent.split(":");
          candidate.classList.toggle("active", envState[parts[0]] === parts[1]);
        });
        if (currentId) select(currentId);
      };
      axesBox.appendChild(button);
    });
  });

  document.getElementById("open").onclick = async function (event) {
    event.preventDefault();
    // The server-computed permalink is canonical (covers agent-set args the
    // iframe URL does not reflect after client-side selects).
    var session = await fetch("/__sunaba/api/session").then(function (r) { return r.json(); });
    window.open(session.permalink || frame.src, "_blank");
  };

  // Observer socket: follow whatever the live stage shows (including
  // agent-driven MCP selects) and surface render status.
  var protocol = location.protocol === "https:" ? "wss:" : "ws:";
  var socket = new WebSocket(protocol + "//" + location.host + "/__sunaba/ws");
  socket.onmessage = function (event) {
    var message = JSON.parse(event.data);
    if (message.kind !== "session") return;
    var state = message.state;
    statusBox.textContent = state.render.status +
      (state.render.error ? " — " + state.render.error.message : "");
    if (state.address && state.address.story !== currentId) {
      highlight(state.address.story);
    }
  };

  var fromHash = location.hash.startsWith("#/story/") ? location.hash.slice("#/story/".length) : null;
  var first = fromHash && data.index.entries[fromHash] ? fromHash : (entries[0] && entries[0].id);
  if (first) select(first);
})();
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
<style>
${SHARED_CSS}
  .axes { margin-left: auto; display: flex; gap: 0.4rem; }
  .axes button { border: 1px solid var(--border); background: transparent; color: var(--fg); border-radius: 0.4rem; padding: 0.2rem 0.6rem; cursor: pointer; }
  .axes button.active { border-color: var(--accent); color: var(--accent); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; padding: 1.5rem 2rem; }
  figure { margin: 0; border: 1px solid var(--border); border-radius: 0.75rem; overflow: hidden; }
  figure iframe { width: 100%; height: 220px; border: 0; display: block; background: transparent; }
  figcaption { padding: 0.4rem 0.75rem; font-size: 0.8rem; border-top: 1px solid var(--border); }
  figcaption .title { color: var(--muted); }
</style>
</head>
<body>
<header>
  <h1><a href="/">sunaba</a></h1>
  <span class="sub">gallery — every story at once</span>
  <span class="axes" id="axes"></span>
</header>
<div class="grid" id="grid">loading…</div>
<script>
(async function () {
  var res = await fetch("/__sunaba/api/index");
  var data = await res.json();
  var entries = Object.values(data.index.entries);
  var params = new URLSearchParams(location.search);

  var axesBox = document.getElementById("axes");
  Object.keys(data.axes || {}).sort().forEach(function (axis) {
    data.axes[axis].forEach(function (value) {
      var button = document.createElement("button");
      button.textContent = axis + ":" + value;
      var key = "env." + axis;
      if (params.get(key) === value) button.className = "active";
      button.onclick = function () {
        var next = new URLSearchParams(location.search);
        if (next.get(key) === value) next.delete(key); else next.set(key, value);
        location.search = next.toString();
      };
      axesBox.appendChild(button);
    });
  });

  var query = params.toString();
  var grid = document.getElementById("grid");
  grid.replaceChildren();
  entries.forEach(function (entry) {
    var figure = document.createElement("figure");
    var frame = document.createElement("iframe");
    frame.loading = "lazy";
    frame.src = "/render/" + entry.id + (query ? "?" + query : "") + "#passive";
    var caption = document.createElement("figcaption");
    var link = document.createElement("a");
    link.href = "/render/" + entry.id + (query ? "?" + query : "");
    link.textContent = entry.name;
    var title = document.createElement("span");
    title.className = "title";
    title.textContent = " — " + entry.title;
    caption.appendChild(link);
    caption.appendChild(title);
    figure.appendChild(frame);
    figure.appendChild(caption);
    grid.appendChild(figure);
  });
})();
</script>
</body>
</html>
`;
