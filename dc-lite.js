/* dc-lite: a tiny runtime that renders the DRAFTORA Design Component (.dc.html)
   sources in project/ as a normal website. Supports the subset of the format
   those files use: {{holes}}, <sc-if>, <sc-for>, <dc-import>, onClick/onChange,
   and `class Component extends DCLogic`. */
(function () {
  "use strict";

  var PAGES = {
    Main: "project/Main.dc.html",
    Templates: "project/Templates.dc.html",
    Editor: "project/Editor.dc.html",
    Banners: "project/Banners.dc.html",
    BannerEditor: "project/BannerEditor.dc.html"
  };

  var root = document.getElementById("app");
  var cache = {};      // file -> {markup, Class}
  var instances = {};  // key -> component instance
  var rootInstance = null;
  var scheduled = false;

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(p) {
      this.state = Object.assign({}, this.state, typeof p === "function" ? p(this.state) : p);
      schedule();
    }
    forceUpdate() { schedule(); }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(function () { scheduled = false; render(); });
  }

  function lookup(path, scope) {
    path = path.trim();
    var neg = false;
    if (path[0] === "!") { neg = true; path = path.slice(1).trim(); }
    var v;
    if (path === "true") v = true;
    else if (path === "false") v = false;
    else if (path === "null") v = null;
    else if (/^-?\d+(\.\d+)?$/.test(path)) v = Number(path);
    else {
      v = scope;
      var parts = path.split(".");
      for (var i = 0; i < parts.length; i++) {
        if (v == null) { v = undefined; break; }
        v = v[parts[i]];
      }
    }
    return neg ? !v : v;
  }

  var HOLE = /\{\{([^}]*)\}\}/g;
  function whole(str) { var m = /^\s*\{\{([^}]*)\}\}\s*$/.exec(str); return m ? m[1] : null; }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null || v === false ? "" : String(v); });
  }
  function camel(s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }

  function loadFile(file) {
    if (cache[file]) return Promise.resolve(cache[file]);
    return fetch(file).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + file);
      return r.text();
    }).then(function (text) {
      var doc = new DOMParser().parseFromString(text, "text/html");
      var host = doc.querySelector("x-dc");
      var helmet = host.querySelector("helmet");
      if (helmet) {
        Array.prototype.forEach.call(helmet.querySelectorAll("style,link"), function (el) {
          var sig = el.outerHTML;
          if (!document.head.querySelector('[data-dc="' + CSS.escape(file) + '"]') || true) {
            var c = el.cloneNode(true);
            c.setAttribute("data-dc", file);
            if (!Array.prototype.some.call(document.head.children, function (h) { return h.outerHTML === c.outerHTML; })) document.head.appendChild(c);
          }
        });
        helmet.remove();
      }
      var script = doc.querySelector("script[data-dc-script]");
      var Cls = new Function("DCLogic", script.textContent + "\n;return Component;")(DCLogic);
      var entry = { markup: host, Class: Cls, title: (doc.title || "") };
      cache[file] = entry;
      return entry;
    });
  }

  function collectImports(node, out) {
    Array.prototype.forEach.call(node.childNodes, function (n) {
      if (n.nodeType !== 1) return;
      if (n.tagName === "DC-IMPORT") out[n.getAttribute("name")] = true;
      collectImports(n, out);
    });
  }

  function instanceFor(key, file, props) {
    var entry = cache[file];
    var inst = instances[key];
    if (!inst) { inst = instances[key] = new entry.Class(props); }
    inst.props = props;
    return inst;
  }

  /* ---------- build DOM from a template node ---------- */
  function build(node, scope, ctx) {
    var out = [];
    Array.prototype.forEach.call(node.childNodes, function (n) {
      if (n.nodeType === 3) {
        out.push(document.createTextNode(interp(n.nodeValue, scope)));
      } else if (n.nodeType === 1) {
        buildEl(n, scope, ctx, out);
      }
    });
    return out;
  }

  function buildEl(n, scope, ctx, out) {
    var tag = n.tagName.toLowerCase();
    if (tag === "sc-if") {
      var h = whole(n.getAttribute("value") || "");
      if (h != null ? lookup(h, scope) : false) build(n, scope, ctx).forEach(function (x) { out.push(x); });
      return;
    }
    if (tag === "sc-for") {
      var list = lookup(whole(n.getAttribute("list")), scope) || [];
      var as = n.getAttribute("as");
      list.forEach(function (item, idx) {
        var s = Object.create(scope);
        s[as] = item; s.$index = idx;
        build(n, s, ctx).forEach(function (x) { out.push(x); });
      });
      return;
    }
    if (tag === "dc-import") {
      var name = n.getAttribute("name");
      var file = "project/" + name + ".dc.html";
      var props = {};
      Array.prototype.forEach.call(n.attributes, function (a) {
        if (a.name === "name" || a.name.indexOf("hint-") === 0) return;
        var w = whole(a.value);
        props[camel(a.name)] = w != null ? lookup(w, scope) : a.value;
      });
      var cnt = (ctx.counts[name] = (ctx.counts[name] || 0) + 1);
      var inst = instanceFor(name + "#" + cnt, file, props);
      var vals = inst.renderVals();
      build(cache[file].markup, vals, ctx).forEach(function (x) { out.push(x); });
      return;
    }
    var el = document.createElement(tag);
    Array.prototype.forEach.call(n.attributes, function (a) {
      var name = a.name, val = a.value, w = whole(val);
      if (name.indexOf("hint-") === 0) return;
      var m = /^on([a-z]+)$/.exec(name);
      if (m && w != null) {
        var fn = lookup(w, scope);
        if (typeof fn !== "function") return;
        var type = m[1];
        if (type === "change") type = (tag === "input" && el.type === "file") || tag === "select" ? "change" : "input";
        el["on" + type] = fn;
        return;
      }
      if (name === "value" && (tag === "input" || tag === "textarea")) {
        el.value = w != null ? (lookup(w, scope) == null ? "" : String(lookup(w, scope))) : interp(val, scope);
        return;
      }
      var v = w != null ? lookup(w, scope) : interp(val, scope);
      if (v == null || v === false) return;
      el.setAttribute(name, v === true ? "" : String(v));
    });
    if (tag === "textarea") {
      if (!el.value) el.value = interp(n.textContent, scope);
    } else {
      build(n, scope, ctx).forEach(function (c) { el.appendChild(c); });
    }
    out.push(el);
  }

  /* ---------- morph existing DOM to the new DOM, keeping focus ---------- */
  var HANDLERS = ["onclick", "oninput", "onchange"];
  function morphChildren(oldP, newNodes) {
    var i = 0;
    for (; i < newNodes.length; i++) {
      var o = oldP.childNodes[i], nw = newNodes[i];
      if (!o) { oldP.appendChild(nw); continue; }
      if (o.nodeType === 3 && nw.nodeType === 3) { if (o.nodeValue !== nw.nodeValue) o.nodeValue = nw.nodeValue; continue; }
      if (o.nodeType === 1 && nw.nodeType === 1 && o.tagName === nw.tagName && (o.type || "") === (nw.type || "")) {
        morphEl(o, nw); continue;
      }
      oldP.replaceChild(nw, o);
    }
    while (oldP.childNodes.length > newNodes.length) oldP.removeChild(oldP.lastChild);
  }
  function morphEl(o, nw) {
    Array.prototype.slice.call(o.attributes).forEach(function (a) { if (!nw.hasAttribute(a.name)) o.removeAttribute(a.name); });
    Array.prototype.forEach.call(nw.attributes, function (a) { if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value); });
    HANDLERS.forEach(function (h) { o[h] = nw[h] || null; });
    if ((o.tagName === "INPUT" && o.type !== "file") || o.tagName === "TEXTAREA") {
      if (o.value !== nw.value) o.value = nw.value;
    }
    if (o.tagName !== "TEXTAREA") morphChildren(o, Array.prototype.slice.call(nw.childNodes));
  }

  function render() {
    if (!rootInstance) return;
    var entry = cache[rootInstance.file];
    var ctx = { counts: {} };
    var vals = rootInstance.inst.renderVals();
    var nodes = build(entry.markup, vals, ctx);
    var active = document.activeElement, selStart, selEnd;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      try { selStart = active.selectionStart; selEnd = active.selectionEnd; } catch (e) {}
    }
    morphChildren(root, nodes);
    if (selStart != null && document.activeElement === active) {
      try { active.setSelectionRange(selStart, selEnd); } catch (e) {}
    }
    wireExports();
  }

  /* ---------- download buttons ---------- */
  function wireExports() {
    Array.prototype.forEach.call(root.querySelectorAll("button"), function (b) {
      var t = b.textContent.trim();
      if (t === "Download PDF") {
        b.onclick = function () {
          var target = root.querySelector('div[style*="max-width:560px"]');
          if (!target) return;
          target.classList.add("dc-print-target");
          window.print();
          setTimeout(function () { target.classList.remove("dc-print-target"); }, 500);
        };
      } else if (t === "Download PNG") {
        b.onclick = function () {
          var target = root.querySelector('div[style*="aspect-ratio"]');
          if (!target) return;
          function run() {
            window.html2canvas(target, { scale: 2, useCORS: true, backgroundColor: null }).then(function (c) {
              var a = document.createElement("a");
              a.download = "banner.png"; a.href = c.toDataURL("image/png"); a.click();
            });
          }
          if (window.html2canvas) return run();
          var s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = run; document.head.appendChild(s);
        };
      }
    });
  }

  /* ---------- routing ---------- */
  function pageFromUrl() {
    var p = new URLSearchParams(location.search).get("page");
    return PAGES[p] ? p : "Main";
  }

  function load(page) {
    var file = PAGES[page];
    return loadFile(file).then(function (entry) {
      var imports = {};
      collectImports(entry.markup, imports);
      return Promise.all(Object.keys(imports).map(function (n) { return loadFile("project/" + n + ".dc.html"); }));
    }).then(function () {
      instances = {};
      rootInstance = { file: file, inst: new cache[file].Class({}) };
      var tt = { Main: "Home", Templates: "Resume templates", Editor: "Resume editor", Banners: "Banner templates", BannerEditor: "Banner editor" }[page];
      document.title = "DRAFTORA — " + tt;
      root.textContent = "";
      render();
      window.scrollTo(0, 0);
    });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var m = /^([A-Za-z]+)\.dc\.html$/.exec(a.getAttribute("href"));
    if (!m || !PAGES[m[1]]) return;
    e.preventDefault();
    history.pushState({}, "", m[1] === "Main" ? "./" : "?page=" + m[1]);
    load(m[1]);
  }, true);
  window.addEventListener("popstate", function () { load(pageFromUrl()); });

  load(pageFromUrl()).catch(function (err) {
    root.textContent = "Could not load the page: " + err.message;
  });
})();
