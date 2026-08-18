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
  section { margin-bottom: 1.5rem; }
  h2 { font-size: 0.95rem; margin: 0 0 0.5rem; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
  li a { display: inline-block; padding: 0.3rem 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; }
  li a.has-play::after { content: " ▸"; color: var(--muted); }
  .diag { color: var(--muted); font-size: 0.85rem; white-space: pre-wrap; }
</style>
</head>
<body>
<header>
  <h1>sunaba</h1>
  <span class="sub">component workbench</span>
  <a href="/gallery">gallery →</a>
</header>
<main id="main">loading…</main>
<script>
(async function () {
  var res = await fetch("/__sunaba/api/index");
  var data = await res.json();
  var entries = Object.values(data.index.entries);
  var groups = {};
  entries.forEach(function (entry) {
    (groups[entry.title] = groups[entry.title] || []).push(entry);
  });
  var main = document.getElementById("main");
  main.replaceChildren();
  Object.keys(groups).sort().forEach(function (title) {
    var section = document.createElement("section");
    var heading = document.createElement("h2");
    heading.textContent = title;
    section.appendChild(heading);
    var list = document.createElement("ul");
    groups[title].forEach(function (entry) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = "/render/" + entry.id;
      link.textContent = entry.name;
      if (entry.hasPlay) link.className = "has-play";
      item.appendChild(link);
      list.appendChild(item);
    });
    section.appendChild(list);
    main.appendChild(section);
  });
  if (data.diagnostics && data.diagnostics.length > 0) {
    var diag = document.createElement("p");
    diag.className = "diag";
    diag.textContent = data.diagnostics
      .map(function (d) { return d.file + ": " + d.reason; })
      .join("\\n");
    main.appendChild(diag);
  }
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
