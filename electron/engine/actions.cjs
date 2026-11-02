const { wait } = require('./capture.cjs');

// Every action drives the real VinaCAD UI with mouse/keyboard events and then verifies its
// postcondition from Redux or the CAD database. Selectors come from vinacad_web_fe (develop).

const PANEL_LABELS = { Prop: 'Thuộc tính', Layers: 'Lớp', Blocks: 'Khối', XREF: 'XREF', Traces: 'Dấu vết', Activity: 'Hoạt động' };

const RIBBON = {
  RECTANG: ['Vẽ', 'HÌNH CHỮ NHẬT'], RECTANGLE: ['Vẽ', 'HÌNH CHỮ NHẬT'], CIRCLE: ['Vẽ', 'HÌNH TRÒN'], ARC: ['Vẽ', 'CUNG'],
  SPLINE: ['Vẽ', 'ĐƯỜNG CONG MỀM'], XLINE: ['Vẽ', 'ĐƯỜNG VÔ HẠN'], LINE: ['Vẽ', 'ĐƯỜNG THẲNG'], PLINE: ['Vẽ', 'ĐƯỜNG NỐI'],
  ELLIPSE: ['Vẽ', 'ELIP'], POLYGON: ['Vẽ', 'ĐA GIÁC'], MTEXT: ['Chú thích', 'VĂN BẢN'],
  MOVE: ['Chỉnh sửa', 'DI CHUYỂN'], STRETCH: ['Chỉnh sửa', 'KÉO GIÃN'], MIRROR: ['Chỉnh sửa', 'GƯƠNG'], FILLET: ['Chỉnh sửa', 'BO TRÒN'],
  CHAMFER: ['Chỉnh sửa', 'VÁT MÉP'], COPY: ['Chỉnh sửa', 'SAO CHÉP'], TRIM: ['Chỉnh sửa', 'CẮT GỌT'], ERASE: ['Chỉnh sửa', 'XÓA'],
  ROTATE: ['Chỉnh sửa', 'XOAY'], SCALE: ['Chỉnh sửa', 'TỶ LỆ'], OFFSET: ['Chỉnh sửa', 'SAO CHÉP SONG SONG'], JOIN: ['Chỉnh sửa', 'NỐI'],
  MATCHPROP: ['Chỉnh sửa', 'KHỚP THUỘC TÍNH'], EXTEND: ['Chỉnh sửa', 'KÉO DÀI'], EXPLODE: ['Chỉnh sửa', 'PHÂN RÃ'],
};
const EDIT_COMMANDS = new Set(['MOVE', 'COPY', 'ROTATE', 'SCALE', 'MIRROR', 'OFFSET', 'TRIM', 'EXTEND', 'FILLET', 'CHAMFER', 'STRETCH', 'ERASE', 'JOIN', 'EXPLODE', 'BREAK', 'MATCHPROP']);
const MODE_TOGGLES = {
  OSNAP: { label: 'BẮT ĐT', read: 's.settingDialog?.setting?.objectSnapEnabled' },
  OTRACK: { label: 'TH.DÕI BẮT', read: 's.settingDialog?.setting?.objectSnapTrackingEnabled' },
  ORTHO: { label: 'TRỰC GIAO', read: 's.settingDialog?.setting?.orthoEnabled' },
  POLAR: { label: 'CỰC', read: 's.settingDialog?.setting?.tracking?.polarTracking' },
  GRID: { key: 'F7', read: 's.settingDialog?.setting?.snapAndGrid?.grid' },
};
// Camera zoom caps per target kind: UI chrome and drawing get a gentle push-in (the CAD view is
// already zoomed with the wheel when shapes are small), side panels a closer one.
const ZOOM = { chrome: 1.35, panel: 1.9, drawing: 1.35 };

const PAGE_HELPERS = `(() => {
  if (window.__vcq) return true;
  const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
  const rectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const state = () => (window.store && window.store.getState ? window.store.getState() : null);
  const inWeb = () => window.__inWeb || window.__INWEB_INSTANCE__;
  const swatches = () => Array.from(document.querySelectorAll('button.shrink-0.w-4.h-4'))
    .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 4 && r.left < 900; });
  window.__vcHistory = window.__vcHistory || [];
  try {
    inWeb().subscribeEvent('pushhistory', (msg) => {
      window.__vcHistory.push(typeof msg === 'string' ? msg : JSON.stringify(msg));
      if (window.__vcHistory.length > 200) window.__vcHistory.shift();
    });
  } catch (e) {}
  window.alert = (m) => console.warn('[alert]', m);
  window.__vcq = {
    state,
    cmd() {
      const cm = inWeb()?.commandManager;
      const name = cm?.currentCmdName || '';
      const display = document.getElementById('command-display');
      let prompt = '';
      let el = display ? display.nextElementSibling : null;
      while (el && !prompt) {
        if (el.tagName === 'H1' && !el.classList.contains('hidden')) prompt = (el.innerText || '').trim();
        el = el.nextElementSibling;
      }
      if (!prompt && display) {
        const lines = String(display.innerText || '').split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
        prompt = lines.slice(-2).find((line) => /chỉ định|xác định|lệnh:|select|command/i.test(line)) || '';
      }
      const selectionPrompt = name === 'SELECT' && /chọn đối tượng|select object|select objects|góc đối diện|opposite corner|tap or drag|chỉ định/i.test(prompt);
      return { name, active: (Boolean(cm?.currentCmd) && name !== '' && name !== 'SELECT') || selectionPrompt, prompt };
    },
    layers() {
      const s = state();
      return {
        current: s?.layers?.selectedLayer || '',
        list: (s?.layers?.layers || []).map((l) => ({ name: l.name, rgb: l.colorRGB, isLocked: Boolean(l.isLocked), isFrozen: Boolean(l.isFrozen) })),
      };
    },
    layerRow(name) {
      const s = state();
      const list = s?.layers?.layers || [];
      const index = list.findIndex((l) => norm(l.name) === norm(name));
      if (index < 0) return null;
      const sw = swatches()[index];
      if (!sw) return null;
      const row = sw.parentElement;
      row.scrollIntoView({ block: 'nearest' });
      const label = row.querySelector('span.ml-2') || row.querySelector('span');
      return {
        index,
        row: rectOf(row),
        name: rectOf(label),
        swatch: rectOf(sw),
        lock: rectOf(row.querySelector('button[title="Lock layer"], button[title="Unlock layer"]')),
        freeze: rectOf(row.querySelector('button[title="Freeze layer"], button[title="Thaw layer"]')),
        renaming: Boolean(row.querySelector('input[maxlength="50"]')),
      };
    },
    renameInput() {
      const input = document.querySelector('input[maxlength="50"]');
      return input ? { rect: rectOf(input), focused: document.activeElement === input, value: input.value } : null;
    },
    sidebarTab(label) {
      const span = Array.from(document.querySelectorAll('span.mt-2'))
        .find((sp) => norm(sp.textContent) === norm(label) && sp.getBoundingClientRect().left < 90);
      return span ? rectOf(span.parentElement) : null;
    },
    panelRect() {
      const sw = swatches();
      if (sw.length) {
        const first = sw[0].parentElement.getBoundingClientRect();
        const last = sw[sw.length - 1].parentElement.getBoundingClientRect();
        return { x: 72, y: Math.max(0, first.top - 46), w: Math.max(260, first.right - 72), h: last.bottom - first.top + 60 };
      }
      return null;
    },
    plusButton() {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => (b.textContent || '').trim() === '+' && b.getBoundingClientRect().left < 700 && b.getBoundingClientRect().top < 260);
      return rectOf(btn);
    },
    picker() {
      const root = document.querySelector('div.fixed.z-\\\\[9999\\\\]');
      if (!root) return null;
      return {
        rect: rectOf(root),
        hex: rectOf(root.querySelector('input[name="hex"]')),
        red: rectOf(root.querySelector('input[name="red"]')),
        green: rectOf(root.querySelector('input[name="green"]')),
        blue: rectOf(root.querySelector('input[name="blue"]')),
      };
    },
    neutralSpot() {
      const label = Array.from(document.querySelectorAll('span, div, p'))
        .find((el) => norm(el.textContent) === 'thuộc tính lớp' && el.getBoundingClientRect().left < 400 && el.children.length === 0);
      return rectOf(label);
    },
    menuItem(text) {
      const menus = Array.from(document.querySelectorAll('div.fixed.z-50'));
      for (const menu of menus) {
        const el = Array.from(menu.querySelectorAll('button, div, span, li'))
          .find((n) => norm(n.textContent) === norm(text) && n.children.length <= 1);
        if (el) {
          const holder = el.closest('[title]');
          const disabled = Boolean(el.closest('button')?.disabled || el.getAttribute('aria-disabled') === 'true'
            || getComputedStyle(el).pointerEvents === 'none' || el.closest('.cursor-not-allowed, .opacity-50'));
          return { rect: rectOf(el), disabled, reason: holder ? holder.getAttribute('title') : '' };
        }
      }
      return null;
    },
    ribbon(group, label) {
      const groups = Array.from(document.querySelectorAll('[data-ribbon-group]'))
        .filter((g) => norm(g.getAttribute('data-ribbon-group')).startsWith(norm(group)));
      for (const g of groups) {
        const tip = Array.from(g.querySelectorAll('div.tooltip')).find((t) => norm(t.textContent) === norm(label));
        if (tip) return rectOf(tip.parentElement);
      }
      return null;
    },
    byTooltip(label) {
      const tip = Array.from(document.querySelectorAll('div, span'))
        .find((el) => el.children.length === 0 && norm(el.textContent) === norm(label));
      if (!tip) return null;
      let node = tip.parentElement;
      for (let i = 0; i < 4 && node; i++) {
        const r = node.getBoundingClientRect();
        if (r.width >= 16 && r.height >= 16 && r.width < 120) return rectOf(node);
        node = node.parentElement;
      }
      return null;
    },
    footer(label) {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => norm(b.textContent) === norm(label) && b.getBoundingClientRect().top > innerHeight - 80);
      return rectOf(btn);
    },
    commandInput() {
      return rectOf(document.getElementById('command-prompt-input'));
    },
    focusCommandInput() {
      const input = document.getElementById('command-prompt-input');
      if (!input || input.disabled) return false;
      input.focus();
      return document.activeElement === input;
    },
    canvasRect() {
      return rectOf(document.getElementById('view'));
    },
    textEditor() {
      const input = document.querySelector('[data-text-editor-input][role="textbox"]');
      if (!input) return null;
      const content = input.querySelector('[data-text-editor-content]');
      return {
        rect: rectOf(input),
        text: content ? String(content.innerText || content.textContent || '') : '',
        focused: document.activeElement === input || input.contains(document.activeElement),
      };
    },
    textApplyButton() {
      return rectOf(document.querySelector('button[aria-label="Apply text"]'));
    },
    textHeightInput() {
      return rectOf(document.querySelector('input[aria-label="Text height"]'));
    },
    entityLayerColors(layerName) {
      const app = inWeb();
      const entities = app?.databaseManager?.getAllEntities?.() || [];
      const call = (obj, name) => {
        try { return typeof obj?.[name] === 'function' ? obj[name]() : null; } catch { return null; }
      };
      let entityCount = 0;
      let byLayer = 0;
      let explicit = 0;
      let unknown = 0;
      let blockRefs = 0;
      let blockByLayer = 0;
      let blockExplicit = 0;
      let blockUnknown = 0;
      const inspectBlock = (entity, depth = 0) => {
        if (depth > 8) { blockUnknown += 1; return; }
        try {
          const type = entity.isA?.().name?.().toString?.() || '';
          if (!/BlockReference$/i.test(type)) return;
          blockRefs += 1;
          const ref = app.CadModule.OdDbBlockReference.cast(entity);
          const id = call(ref, 'blockTableRecord') || call(ref, 'blockTableRecordId');
          const opened = id?.safeOpenObject?.(0, false);
          const record = opened && app.CadModule.OdDbBlockTableRecord.cast(opened);
          if (opened && opened !== record) opened.delete?.();
          const iterator = record?.newIterator?.(true, false, false);
          if (!iterator) { blockUnknown += 1; return; }
          let found = false;
          for (; !iterator.done(); iterator.step(true, true)) {
            const child = iterator.entity?.(0, false) || iterator.object?.();
            if (!child) continue;
            found = true;
            const childLayer = call(child, 'layer')?.toString?.() || String(call(child, 'layer') || '');
            const childByLayer = call(child, 'colorIsByLayer') ?? call(child, 'isColorByLayer');
            const childColor = call(child, 'color') || call(child, 'trueColor');
            if (childColor?.isByBlock?.() === true || ((childByLayer === true || childColor?.isByLayer?.() === true) && (childLayer === '0' || String(childLayer).toLowerCase() === String(layerName).toLowerCase()))) blockByLayer += 1;
            else if (childColor || childByLayer === false) blockExplicit += 1;
            else blockUnknown += 1;
            inspectBlock(child, depth + 1);
            child?.delete?.();
          }
          iterator.delete?.();
          record.delete?.();
          id?.delete?.();
          if (!found) blockUnknown += 1;
        } catch { blockUnknown += 1; }
      };
      for (const entity of entities) {
        try {
          const layer = call(entity, 'layer')?.toString?.() || String(call(entity, 'layer') || '');
          if (String(layer).toLowerCase() !== String(layerName).toLowerCase()) continue;
          entityCount += 1;
          const byLayerFlag = call(entity, 'colorIsByLayer') ?? call(entity, 'isColorByLayer');
          const color = call(entity, 'color') || call(entity, 'trueColor');
          const colorByLayer = typeof color?.isByLayer === 'function' ? color.isByLayer() : false;
          if (byLayerFlag === true || colorByLayer === true) byLayer += 1;
          else if (color || byLayerFlag === false) explicit += 1;
          else unknown += 1;
          inspectBlock(entity);
        } catch { unknown += 1; }
        try { entity.delete?.(); } catch {}
      }
      return { layer: layerName, entityCount, byLayer, explicit, unknown, blockRefs, blockByLayer, blockExplicit, blockUnknown, blockInternalsChecked: blockRefs === 0 || blockUnknown === 0,
        report: entityCount && byLayer === 0 && blockByLayer === 0 ? 'Các entity của layer không báo ByLayer; chỉ xác minh được màu trong bảng layer.' : null };
    },
    selectedEntities() {
      try {
        const sm = inWeb()?.selectionManager;
        let selected = sm?.getSelectedEntities?.() || [];
        // SELECT ends by clearing the temporary selectionManager. The persistent
        // UI selection still owns its grip entities; inspect those read-only.
        if (!selected.length) selected = (inWeb()?.gripManager?.gripEntities || []).map((grip) => grip.entity).filter(Boolean);
        const point = (p) => p ? { x: Number(p.x), y: Number(p.y), z: Number(p.z) || 0 } : null;
        const idOf = (entity, fallback) => {
          try {
            const objectId = entity.objectId?.();
            const handle = objectId?.getHandle?.();
            const ascii = typeof handle?.ascii === 'function' ? handle.ascii() : handle?.ascii;
            const id = String(ascii?.toString?.() || ascii || '');
            objectId?.delete?.();
            return id || ('selected-' + fallback);
          } catch {
            return 'selected-' + fallback;
          }
        };
        const out = Array.from(selected).map((entity, index) => {
          const ext = new (inWeb().CadModule.OdGeExtents3d)();
          let bounds = null;
          try {
            if (entity.getGeomExtents(ext) === 0) bounds = { min: point(ext.minPoint()), max: point(ext.maxPoint()) };
          } catch {}
          ext.delete?.();
          let type = '';
          try { type = entity.isA().name().toString().replace(/^AcDb/, ''); } catch {}
          return { id: idOf(entity, index), type, bounds };
        });
        const ids = out.map((entity) => entity.id);
        if (ids.some((id) => !id || /^(entity|selected)-/.test(id))) return { __error: 'Không đọc được handle ASCII của entity.' };
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicates.length) return { __error: 'selectedEntities có id trùng: ' + [...new Set(duplicates)].join(', ') };
        return out;
      } catch {
        return [];
      }
    },
    selectionDiagnostics() {
      const app = inWeb();
      const names = (obj) => {
        if (!obj) return [];
        const values = new Set();
        let current = obj;
        for (let depth = 0; current && depth < 2; depth++, current = Object.getPrototypeOf(current)) {
          for (const key of Object.getOwnPropertyNames(current)) if (/select|entity|object/i.test(key)) values.add(key);
        }
        return Array.from(values).slice(0, 80);
      };
      return { app: names(app), commandManager: names(app?.commandManager), view: names(app?.View), database: names(app?.Database), selectionManager: names(app?.selectionManager) };
    },
    entitySnapshot() {
      const app = inWeb();
      const cad = app?.CadModule;
      const entities = app?.databaseManager?.getAllEntities?.() || [];
      const point = (p) => p ? { x: Number(p.x), y: Number(p.y), z: Number(p.z) || 0 } : null;
      const invoke = (obj, name) => {
        try { return typeof obj?.[name] === 'function' ? obj[name]() : null; } catch { return null; }
      };
      const uv = (p) => {
        const plane = this.planeAxes() || { u: 'x', v: 'y' };
        return [Number(p?.[plane.u] || 0), Number(p?.[plane.v] || 0)];
      };
      const idOf = (entity, fallback) => {
        try {
          const objectId = entity.objectId?.();
          const handle = objectId?.getHandle?.();
          const ascii = typeof handle?.ascii === 'function' ? handle.ascii() : handle?.ascii;
          const id = String(ascii?.toString?.() || ascii || '');
          objectId?.delete?.();
          return id || ('entity-' + fallback);
        } catch {
          return 'entity-' + fallback;
        }
      };
      const out = [];
      entities.forEach((entity, index) => {
        try {
          const type = entity.isA().name().toString().replace(/^AcDb/, '');
          const ext = new cad.OdGeExtents3d();
          let bounds = null;
          if (entity.getGeomExtents(ext) === 0) bounds = { min: uv(point(ext.minPoint())), max: uv(point(ext.maxPoint())) };
          ext.delete?.();
          const layerValue = invoke(entity, 'layer');
          const item = { id: idOf(entity, index), type, bounds, layer: layerValue?.toString?.() || String(layerValue || '') };
          if (type === 'Line') {
            const line = cad.OdDbLine.cast(entity);
            item.start = uv(point(invoke(line, 'startPoint')));
            item.end = uv(point(invoke(line, 'endPoint')));
          } else if (type === 'Polyline' || type === '2dPolyline') {
            const poly = cad.OdDbPolyline?.cast?.(entity) || cad.OdDb2dPolyline?.cast?.(entity);
            const vertices = [];
            const count = Number(invoke(poly, 'numVerts') || 0);
            for (let i = 0; i < count; i++) {
              const p = new cad.OdGePoint3d();
              try { poly.getPointAt1(i, p); vertices.push(uv(point(p))); } catch {}
              p.delete?.();
            }
            item.vertices = vertices;
            item.closed = Boolean(invoke(poly, 'isClosed'));
          } else if (type === 'Circle') {
            const circle = cad.OdDbCircle.cast(entity);
            item.center = uv(point(invoke(circle, 'center')));
            item.radius = Number(invoke(circle, 'radius'));
          } else if (type === 'MText') {
            const mtext = cad.OdDbMText.cast(entity);
            const rawText = invoke(mtext, 'contents') || invoke(mtext, 'textString') || '';
            item.text = String(rawText?.toString?.() || rawText || '');
            item.height = Number(invoke(mtext, 'textHeight') || 0);
            item.location = uv(point(invoke(mtext, 'location') || invoke(mtext, 'insertionPoint')));
          } else if (type === 'Text') {
            const text = cad.OdDbText.cast(entity);
            const rawText = invoke(text, 'textString') || '';
            item.text = String(rawText?.toString?.() || rawText || '');
            item.height = Number(invoke(text, 'height') || 0);
            item.location = uv(point(invoke(text, 'position')));
          }
          out.push(item);
        } catch {}
        try { entity.delete?.(); } catch {}
      });
      const ids = out.map((entity) => entity.id);
      if (ids.some((id) => !id || /^(entity|selected)-/.test(id))) return { __error: 'Không đọc được handle ASCII của entity.' };
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicates.length) return { __error: 'entitySnapshot có id trùng: ' + [...new Set(duplicates)].join(', ') };
      return out;
    },
    zoomCheck(min, max) {
      const a = this.worldToClient(Number(min[0]), Number(min[1]));
      const b = this.worldToClient(Number(max[0]), Number(max[1]));
      const canvas = this.canvasRect();
      if (!a || !b || !canvas) return null;
      return {
        inside: Boolean(a.inside && b.inside),
        fraction: Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / Math.max(1, Math.min(canvas.w, canvas.h)),
      };
    },
    worldTolerance() {
      const a = this.worldToClient(0, 0);
      const b = this.worldToClient(1, 0);
      if (!a || !b) return 8;
      const pixelsPerUnit = Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
      return Number.isFinite(pixelsPerUnit) && pixelsPerUnit > 1e-6 ? Math.max(2, 10 / pixelsPerUnit) : 8;
    },
    cursorPoint() {
      try {
        const point = inWeb()?.lastPointDrawingPlane;
        const plane = this.planeAxes();
        if (!point || !plane) return null;
        const value = [Number(point[plane.u]), Number(point[plane.v])];
        if (!value.every(Number.isFinite)) return null;
        return { point: value, client: this.worldToClient(...value), osnap: Boolean(state()?.settingDialog?.setting?.objectSnapEnabled), tolerance: this.worldTolerance() };
      } catch { return null; }
    },
    cleanState() {
      let command = { name: '', active: false, prompt: '' };
      let selection = [];
      let selectionError = '';
      let editor = null;
      let picker = null;
      let menus = [];
      try { command = this.cmd() || command; } catch {}
      try {
        selection = this.selectedEntities() || [];
        if (selection?.__error) selectionError = String(selection.__error);
      } catch (error) { selectionError = String(error?.message || error); }
      try { editor = this.textEditor(); } catch {}
      try { picker = this.picker(); } catch {}
      try {
        const viewLabels = ['trên', 'dưới', 'trái', 'phải', 'trước', 'sau', 'isometric', 'trục z'];
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return r.width > 1 && r.height > 1 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
        };
        const candidates = Array.from(document.querySelectorAll('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-floating-ui-portal], div.fixed, div.absolute'))
          .filter(visible)
          .filter((el) => {
            const style = getComputedStyle(el);
            const z = Number.parseInt(style.zIndex, 10);
            const text = norm(el.innerText || '');
            const viewHits = viewLabels.filter((label) => text.includes(label)).length;
            const itemCount = el.querySelectorAll('button, [role="menuitem"], li').length;
            const explicitMenu = el.matches('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-floating-ui-portal], div.fixed.z-50');
            const viewPopup = viewHits >= 3 && /(fixed|z-50)/i.test(String(el.className || ''));
            return explicitMenu
              || viewPopup
              || (Number.isFinite(z) && z >= 40 && itemCount >= 2 && el.getBoundingClientRect().width < 620);
          });
        menus = candidates
          .filter((el) => {
            return visible(el);
          })
          .map((el) => String(el.innerText || '').trim().slice(0, 120));
      } catch {}
      return {
        command: { name: command?.name || '', active: Boolean(command?.active), prompt: command?.prompt || '' },
        selectionCount: Array.isArray(selection) ? selection.length : 0,
        snapshotError: selectionError,
        editor: Boolean(editor),
        picker: Boolean(picker),
        menus,
      };
    },
    // The input drawing plane is XY in a top view but XZ/YZ in front/side views; find which two
    // world axes vary across the canvas so plan coordinates (a, b) map onto that plane.
    planeAxes() {
      const canvas = document.getElementById('view');
      const app = inWeb();
      if (!canvas || !app || !app.screenToInputDrawingPlane) return null;
      const W = canvas.width;
      const H = canvas.height;
      const sample = (px, py) => {
        const p = app.screenToInputDrawingPlane(px, py);
        const out = { x: Number(p.x), y: Number(p.y), z: Number(p.z) || 0 };
        p.delete?.();
        return out;
      };
      const p0 = sample(0, 0);
      const p1 = sample(W, 0);
      const p2 = sample(0, H);
      const keys = ['x', 'y', 'z'];
      const du = keys.map((k) => Math.abs(p1[k] - p0[k]));
      const u = keys[du.indexOf(Math.max(...du))];
      const rest = keys.filter((k) => k !== u);
      const dv = rest.map((k) => Math.abs(p2[k] - p0[k]));
      const v = rest[dv.indexOf(Math.max(...dv))];
      return { u, v, p0, p1, p2, W, H };
    },
    worldToClient(a, b) {
      const canvas = document.getElementById('view');
      const plane = this.planeAxes();
      if (!canvas || !plane) return null;
      const { u, v, p0, p1, p2, W, H } = plane;
      const r = canvas.getBoundingClientRect();
      const ax = (p1[u] - p0[u]) / W;
      const ay = (p1[v] - p0[v]) / W;
      const bx = (p2[u] - p0[u]) / H;
      const by = (p2[v] - p0[v]) / H;
      const det = ax * by - bx * ay;
      if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
      const dx = a - p0[u];
      const dy = b - p0[v];
      const sx = (dx * by - bx * dy) / det;
      const sy = (ax * dy - dx * ay) / det;
      const cx = r.left + sx * (r.width / W);
      const cy = r.top + sy * (r.height / H);
      return { x: cx, y: cy, inside: cx > r.left + 4 && cx < r.right - 4 && cy > r.top + 4 && cy < r.bottom - 4 };
    },
    entityCount() {
      try {
        const app = inWeb();
        const CadModule = app.CadModule;
        const ms = CadModule.OdDbBlockTableRecord.cast(app.Database.getModelSpaceId().safeOpenObject(0, false));
        let count = 0;
        const it = ms.newIterator(true, true, false);
        for (; !it.done(); it.step(true, true)) count++;
        it.delete?.();
        ms.delete?.();
        return count;
      } catch (e) {
        return -1;
      }
    },
    hasSelection() {
      return Boolean(Array.from(document.querySelectorAll('[data-ribbon-group]'))
        .find((g) => norm(g.getAttribute('data-ribbon-group')) === 'chỉnh sửa lựa chọn'));
    },
    historySince(n) {
      return window.__vcHistory.slice(n);
    },
    historyLength() {
      return window.__vcHistory.length;
    },
    findClickable(text) {
      const want = norm(text);
      const nodes = Array.from(document.querySelectorAll('button, [role="button"], a, label, span, div'));
      const hit = nodes.find((el) => {
        const label = norm(el.getAttribute('title') || el.getAttribute('aria-label') || (el.children.length === 0 ? el.textContent : ''));
        const r = el.getBoundingClientRect();
        return label === want && r.width > 6 && r.height > 6 && r.width < 400;
      });
      return rectOf(hit);
    },
  };
  return true;
})()`;

class ActionFailure extends Error {}

const js = (win, code) => win.webContents.executeJavaScript(code, true);
const q = async (win, call) => {
  const value = await js(win, `window.__vcq ? window.__vcq.${call} : null`).catch(() => null);
  if (value?.__error) throw new ActionFailure(value.__error);
  return value;
};
const snapshotOrFail = (value, label) => {
  if (value?.__error) fail(value.__error);
  if (!Array.isArray(value)) fail(`Không đọc được snapshot entity trước/sau ${label}.`);
  return value;
};
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const fail = (message) => {
  throw new ActionFailure(message);
};

function averageBitmapRgb(bitmap, width, height, x, y, radius = 2) {
  let r = 0; let g = 0; let b = 0; let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = Math.max(0, Math.min(width - 1, Math.round(x + dx)));
      const py = Math.max(0, Math.min(height - 1, Math.round(y + dy)));
      const index = (py * width + px) * 4;
      if (index + 2 >= bitmap.length) continue;
      b += bitmap[index];
      g += bitmap[index + 1];
      r += bitmap[index + 2];
      count += 1;
    }
  }
  return count ? { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) } : null;
}

async function sampleLayerPixels(ctx, layerName, snapshot = null) {
  const entities = snapshot || snapshotOrFail(await q(ctx.win, 'entitySnapshot()'), `pixel ${layerName}`);
  const points = [];
  for (const entity of entities.filter((item) => String(item.layer || '').toLowerCase() === String(layerName).toLowerCase() && item.bounds)) {
    const min = entity.bounds.min;
    const max = entity.bounds.max;
    points.push({ id: entity.id, world: [Number((min[0] + max[0]) / 2), Number((min[1] + max[1]) / 2)] });
    if (Math.abs(max[0] - min[0]) + Math.abs(max[1] - min[1]) > 5) {
      points.push({ id: `${entity.id}:min`, world: [Number(min[0]), Number(min[1])] });
      points.push({ id: `${entity.id}:max`, world: [Number(max[0]), Number(max[1])] });
    }
  }
  const size = ctx.win.getContentSize();
  const image = await ctx.win.webContents.capturePage();
  const imageSize = image.getSize();
  const bitmap = image.toBitmap();
  const mapped = [];
  for (const item of points.slice(0, 120)) {
    const pos = await q(ctx.win, `worldToClient(${item.world[0]}, ${item.world[1]})`);
    if (!pos?.inside || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue;
    const x = pos.x * imageSize.width / Math.max(1, size[0]);
    const y = pos.y * imageSize.height / Math.max(1, size[1]);
    const counts = new Map();
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const rgb = averageBitmapRgb(bitmap, imageSize.width, imageSize.height, x + dx, y + dy, 0);
      const key = JSON.stringify(rgb);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const background = JSON.parse([...counts].sort((a, b) => b[1] - a[1])[0][0]);
    mapped.push({ id: item.id, world: item.world, background, rgb: averageBitmapRgb(bitmap, imageSize.width, imageSize.height, x, y) });
  }
  return { layer: layerName, entityCount: entities.filter((item) => String(item.layer || '').toLowerCase() === String(layerName).toLowerCase()).length, samples: mapped };
}

function pixelDistance(a, b) {
  return a && b ? Math.hypot(Number(a.r) - Number(b.r), Number(a.g) - Number(b.g), Number(a.b) - Number(b.b)) : 0;
}

function pixelTowardTarget(before, after, target, background) {
  if (!before || !after || !background || pixelDistance(before, after) < 8) return false;
  const direction = ['r', 'g', 'b'].map((key) => target[key] - background[key]);
  const norm = direction.reduce((sum, value) => sum + value * value, 0);
  if (!norm) return false;
  const residual = (rgb) => {
    const observed = ['r', 'g', 'b'].map((key) => rgb[key] - background[key]);
    const alpha = Math.max(0, Math.min(1, observed.reduce((sum, value, i) => sum + value * direction[i], 0) / norm));
    return { alpha, error: Math.hypot(...observed.map((value, i) => value - alpha * direction[i])) };
  };
  const a = residual(before); const b = residual(after);
  return b.alpha >= 0.03 && b.error <= 12 && b.error + 3 < a.error;
}

const VISIBLE_POSTCONDITION_COMMANDS = new Set([
  'LINE', 'PLINE', 'RECTANG', 'RECTANGLE', 'CIRCLE', 'MTEXT',
  'MOVE', 'COPY', 'ROTATE', 'OFFSET',
]);

async function captureCanvasSnapshot(win) {
  const contentSize = win.getContentSize();
  const image = await win.webContents.capturePage();
  const imageSize = image.getSize();
  return {
    contentWidth: Math.max(1, Number(contentSize[0]) || 1920),
    contentHeight: Math.max(1, Number(contentSize[1]) || 1080),
    width: imageSize.width,
    height: imageSize.height,
    bitmap: image.toBitmap(),
  };
}

function entitySegments(entity) {
  if (!entity) return [];
  if (entity.type === 'Line' && Array.isArray(entity.start) && Array.isArray(entity.end)) {
    return [[entity.start, entity.end]];
  }
  if ((entity.type === 'Polyline' || entity.type === '2dPolyline') && Array.isArray(entity.vertices) && entity.vertices.length >= 2) {
    const verts = entity.vertices;
    const segs = [];
    for (let i = 0; i < verts.length - 1; i++) {
      segs.push([verts[i], verts[i + 1]]);
    }
    if (entity.closed && verts.length >= 3) {
      const first = verts[0];
      const last = verts[verts.length - 1];
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) > 1e-3) {
        segs.push([last, first]);
      }
    }
    return segs;
  }
  return [];
}

function pointToSegmentDist(pt, a, b) {
  const dx = Number(b[0]) - Number(a[0]);
  const dy = Number(b[1]) - Number(a[1]);
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(Number(pt[0]) - Number(a[0]), Number(pt[1]) - Number(a[1]));
  const t = Math.max(0, Math.min(1, ((Number(pt[0]) - Number(a[0])) * dx + (Number(pt[1]) - Number(a[1])) * dy) / lenSq));
  return Math.hypot(Number(pt[0]) - (Number(a[0]) + t * dx), Number(pt[1]) - (Number(a[1]) + t * dy));
}

function entitySamplePoints(entity, step = null) {
  if (!entity) return [];
  const fractions = [0.12, 0.20, 0.28, 0.36, 0.43, 0.50, 0.57, 0.64, 0.72, 0.80, 0.88];
  const segs = entitySegments(entity);
  if (segs.length) {
    const pts = [];
    for (const [a, b] of segs) {
      for (const t of fractions) {
        pts.push([Number(a[0]) + (Number(b[0]) - Number(a[0])) * t, Number(a[1]) + (Number(b[1]) - Number(a[1])) * t]);
      }
    }
    return pts;
  }
  if (entity.type === 'Circle' && Array.isArray(entity.center) && Number.isFinite(entity.radius)) {
    const angles = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
    return angles.map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return [Number(entity.center[0]) + entity.radius * Math.cos(rad), Number(entity.center[1]) + entity.radius * Math.sin(rad)];
    });
  }
  if (entity.type === 'MText' || entity.type === 'Text') {
    const h = Math.max(Number(entity.height) || Number(step?.height) || 120, 20);
    const stepPts = (step?.inputs || []).filter((i) => Array.isArray(i.point) && i.point.length >= 2).map((i) => i.point);
    const loc = Array.isArray(entity.location) && entity.location.length >= 2
      ? entity.location
      : (stepPts[0] || entity.bounds?.min || [0, 0]);
    const xs = [Number(loc[0]), Number(loc[0]) + h * 6, ...stepPts.map((p) => Number(p[0]))];
    const ys = [Number(loc[1]), Number(loc[1]) - h * 3.0, ...stepPts.map((p) => Number(p[1])), ...stepPts.map((p) => Number(p[1]) - h * 2.5)];
    if (entity.bounds?.min && entity.bounds?.max) {
      xs.push(Number(entity.bounds.min[0]), Number(entity.bounds.max[0]));
      ys.push(Number(entity.bounds.min[1]), Number(entity.bounds.max[1]));
    }
    const minX = Math.min(...xs.filter(Number.isFinite));
    const maxX = Math.max(...xs.filter(Number.isFinite));
    const minY = Math.min(...ys.filter(Number.isFinite));
    const maxY = Math.max(...ys.filter(Number.isFinite));
    const pts = [];
    for (const tx of [0.08, 0.20, 0.32, 0.44, 0.56, 0.68, 0.80, 0.92]) {
      for (const ty of [0.15, 0.30, 0.45, 0.60, 0.75, 0.90]) {
        pts.push([minX + (maxX - minX) * tx, minY + (maxY - minY) * ty]);
      }
    }
    return pts;
  }
  if (entity.bounds?.min && entity.bounds?.max) {
    const min = entity.bounds.min;
    const max = entity.bounds.max;
    return fractions.map((t) => [Number(min[0]) + (Number(max[0]) - Number(min[0])) * t, Number(min[1]) + (Number(max[1]) - Number(min[1])) * t]);
  }
  return [];
}

function collinearOverlapStats(newEntities, existingEntities, tolerance = 8) {
  const newSegs = (newEntities || []).flatMap(entitySegments);
  const oldSegs = (existingEntities || []).flatMap(entitySegments);
  if (!newSegs.length || !oldSegs.length) return { totalPoints: 0, overlappedPoints: 0, overlapRatio: 0 };
  const sampleFractions = [0.18, 0.34, 0.50, 0.66, 0.82];
  let totalPoints = 0;
  let overlappedPoints = 0;
  for (const [a, b] of newSegs) {
    const len = Math.hypot(Number(b[0]) - Number(a[0]), Number(b[1]) - Number(a[1]));
    if (len < 1e-3) continue;
    const ux = (Number(b[0]) - Number(a[0])) / len;
    const uy = (Number(b[1]) - Number(a[1])) / len;
    const tol = Math.max(2, Math.min(25, tolerance * 0.6, len * 0.01));
    for (const t of sampleFractions) {
      totalPoints += 1;
      const pt = [Number(a[0]) + (Number(b[0]) - Number(a[0])) * t, Number(a[1]) + (Number(b[1]) - Number(a[1])) * t];
      const hit = oldSegs.some(([c, d]) => {
        const oldLen = Math.hypot(Number(d[0]) - Number(c[0]), Number(d[1]) - Number(c[1]));
        if (oldLen < 1e-3) return false;
        const vx = (Number(d[0]) - Number(c[0])) / oldLen;
        const vy = (Number(d[1]) - Number(c[1])) / oldLen;
        if (Math.abs(ux * vx + uy * vy) < 0.985) return false;
        return pointToSegmentDist(pt, c, d) <= tol;
      });
      if (hit) overlappedPoints += 1;
    }
  }
  return {
    totalPoints,
    overlappedPoints,
    overlapRatio: totalPoints ? Math.round((overlappedPoints / totalPoints) * 1000) / 1000 : 0,
  };
}

function patchPixelDiff(beforeSnap, afterSnap, clientX, clientY, radius = 4) {
  const bx = Math.round((clientX * beforeSnap.width) / beforeSnap.contentWidth);
  const by = Math.round((clientY * beforeSnap.height) / beforeSnap.contentHeight);
  const bg = { r: 33, g: 40, b: 48 };
  let maxDiff = 0;
  let beforeContrast = 0;
  let afterContrast = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = Math.max(0, Math.min(beforeSnap.width - 1, bx + dx));
      const py = Math.max(0, Math.min(beforeSnap.height - 1, by + dy));
      const idx = (py * beforeSnap.width + px) * 4;
      if (idx + 2 >= beforeSnap.bitmap.length || idx + 2 >= afterSnap.bitmap.length) continue;
      const b1 = beforeSnap.bitmap[idx];
      const g1 = beforeSnap.bitmap[idx + 1];
      const r1 = beforeSnap.bitmap[idx + 2];
      const b2 = afterSnap.bitmap[idx];
      const g2 = afterSnap.bitmap[idx + 1];
      const r2 = afterSnap.bitmap[idx + 2];
      const diff = Math.hypot(r2 - r1, g2 - g1, b2 - b1);
      if (diff > maxDiff) maxDiff = diff;
      const c1 = Math.hypot(r1 - bg.r, g1 - bg.g, b1 - bg.b);
      const c2 = Math.hypot(r2 - bg.r, g2 - bg.g, b2 - bg.b);
      if (c1 > beforeContrast) beforeContrast = c1;
      if (c2 > afterContrast) afterContrast = c2;
    }
  }
  return {
    maxDiff: Math.round(maxDiff * 100) / 100,
    beforeContrast: Math.round(beforeContrast * 100) / 100,
    afterContrast: Math.round(afterContrast * 100) / 100,
  };
}

async function evaluateWorldPointsPixels(win, worldPoints, beforeSnap, afterSnap, diffThreshold = 18, patchRadius = 4) {
  const samples = [];
  for (const pt of (worldPoints || []).slice(0, 56)) {
    const pos = await q(win, `worldToClient(${Number(pt[0])}, ${Number(pt[1])})`);
    if (!pos?.inside || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue;
    const metrics = patchPixelDiff(beforeSnap, afterSnap, pos.x, pos.y, patchRadius);
    samples.push({
      world: [ Math.round(Number(pt[0]) * 100) / 100, Math.round(Number(pt[1]) * 100) / 100 ],
      changed: metrics.maxDiff >= diffThreshold,
      ...metrics,
    });
  }
  const sampledPoints = samples.length;
  const changedPoints = samples.filter((s) => s.changed).length;
  const maxDiff = samples.reduce((m, s) => Math.max(m, s.maxDiff), 0);
  const meanDiff = sampledPoints ? Math.round((samples.reduce((sum, s) => sum + s.maxDiff, 0) / sampledPoints) * 100) / 100 : 0;
  const beforeContrastMax = samples.reduce((m, s) => Math.max(m, s.beforeContrast), 0);
  const afterContrastMax = samples.reduce((m, s) => Math.max(m, s.afterContrast), 0);
  return {
    sampledPoints,
    changedPoints,
    changedRatio: sampledPoints ? Math.round((changedPoints / sampledPoints) * 1000) / 1000 : 0,
    meanDiff,
    maxDiff,
    beforeContrastMax,
    afterContrastMax,
    samples: samples.slice(0, 12),
  };
}

async function verifyCommandVisibility(ctx, name, step, before, after, selectedBefore, beforeSnap, afterSnap, tolerance = 8) {
  if (!VISIBLE_POSTCONDITION_COMMANDS.has(name) || !beforeSnap || !afterSnap) return null;
  const beforeIds = new Set((before || []).map((e) => e.id));
  const created = (after || []).filter((e) => !beforeIds.has(e.id));

  if (['LINE', 'PLINE', 'RECTANG', 'RECTANGLE', 'CIRCLE', 'MTEXT'].includes(name)) {
    const overlap = ['LINE', 'PLINE', 'RECTANG', 'RECTANGLE'].includes(name)
      ? collinearOverlapStats(created, before, tolerance)
      : { totalPoints: 0, overlappedPoints: 0, overlapRatio: 0 };
    const maxOverlap = (name === 'RECTANG' || name === 'RECTANGLE') ? 0.95 : 0.75;
    if (overlap.overlapRatio >= maxOverlap) {
      fail(`Nét mới của lệnh ${name} trùng trực tiếp với đường có sẵn trên bản vẽ (${Math.round(overlap.overlapRatio * 100)}% điểm mẫu trùng đoạn có sẵn).`);
    }
    const pts = created.flatMap((e) => entitySamplePoints(e, step));
    const patchRadius = name === 'MTEXT' ? 12 : 4;
    const newPosition = await evaluateWorldPointsPixels(ctx.win, pts, beforeSnap, afterSnap, 18, patchRadius);
    const minRatio = name === 'MTEXT' ? 0.08 : 0.35;
    if (newPosition.sampledPoints === 0 || newPosition.changedPoints < 2 || newPosition.changedRatio < minRatio || newPosition.maxDiff < 22) {
      fail(`Lệnh ${name} không tạo thay đổi nhìn thấy được trên canvas (${newPosition.changedPoints}/${newPosition.sampledPoints} điểm mẫu thay đổi, changedRatio=${newPosition.changedRatio}, maxDiff=${newPosition.maxDiff}).`);
    }
    return {
      command: name,
      threshold: { pixelDiff: 18, minChangedRatio: minRatio, maxCollinearOverlap: maxOverlap },
      collinearOverlap: overlap,
      newPosition,
      visible: true,
    };
  }

  if (name === 'OFFSET') {
    const overlap = collinearOverlapStats(created, before, tolerance);
    const sourceEntities = (selectedBefore || []).map((s) => (before || []).find((e) => e.id === s.id) || s);
    const oldPts = sourceEntities.flatMap(entitySamplePoints);
    const newPts = created.flatMap(entitySamplePoints);
    const oldPosition = await evaluateWorldPointsPixels(ctx.win, oldPts, beforeSnap, afterSnap, 18);
    const newPosition = await evaluateWorldPointsPixels(ctx.win, newPts, beforeSnap, afterSnap, 18);
    if (overlap.overlapRatio >= 0.75) {
      fail(`Nét mới của lệnh OFFSET trùng trực tiếp với đường có sẵn trên bản vẽ (${Math.round(overlap.overlapRatio * 100)}% điểm mẫu trùng đoạn có sẵn, changedRatio=${newPosition.changedRatio}).`);
    }
    if (oldPosition.sampledPoints > 0 && oldPosition.afterContrastMax < 20) {
      fail(`Lệnh OFFSET làm mất hiển thị đối tượng nguồn tại vị trí cũ (afterContrastMax=${oldPosition.afterContrastMax}).`);
    }
    if (newPosition.sampledPoints === 0 || newPosition.changedPoints < 2 || newPosition.changedRatio < 0.35 || newPosition.maxDiff < 22) {
      fail(`Lệnh OFFSET không tạo thay đổi nhìn thấy được tại vị trí mới trên canvas (${newPosition.changedPoints}/${newPosition.sampledPoints} điểm mẫu thay đổi, maxDiff=${newPosition.maxDiff}).`);
    }
    return {
      command: name,
      threshold: { pixelDiff: 18, minChangedRatio: 0.35, maxCollinearOverlap: 0.75 },
      collinearOverlap: overlap,
      oldPosition,
      newPosition,
      visible: true,
    };
  }

  if (name === 'COPY') {
    const sourceEntities = (selectedBefore || []).map((s) => (before || []).find((e) => e.id === s.id) || s);
    const oldPts = sourceEntities.flatMap(entitySamplePoints);
    const newPts = created.flatMap(entitySamplePoints);
    const oldPosition = await evaluateWorldPointsPixels(ctx.win, oldPts, beforeSnap, afterSnap, 18);
    const newPosition = await evaluateWorldPointsPixels(ctx.win, newPts, beforeSnap, afterSnap, 18);
    if (oldPosition.sampledPoints > 0 && oldPosition.afterContrastMax < 20) {
      fail(`Lệnh COPY làm mất hiển thị đối tượng gốc tại vị trí cũ (afterContrastMax=${oldPosition.afterContrastMax}).`);
    }
    if (newPosition.sampledPoints === 0 || newPosition.changedPoints < 1 || newPosition.changedRatio < 0.30 || newPosition.maxDiff < 18) {
      fail(`Lệnh COPY không tạo thay đổi nhìn thấy được tại vị trí mới trên canvas (${newPosition.changedPoints}/${newPosition.sampledPoints} điểm mẫu thay đổi, maxDiff=${newPosition.maxDiff}).`);
    }
    return {
      command: name,
      threshold: { pixelDiff: 18, minChangedRatio: 0.30 },
      oldPosition,
      newPosition,
      visible: true,
    };
  }

  if (name === 'MOVE' || name === 'ROTATE') {
    const selectedIds = new Set((selectedBefore || []).map((s) => s.id));
    const beforeEntities = (before || []).filter((e) => selectedIds.has(e.id));
    const afterEntities = (after || []).filter((e) => selectedIds.has(e.id));
    const beforeSegs = beforeEntities.flatMap(entitySegments);
    const afterSegs = afterEntities.flatMap(entitySegments);
    const sepTol = Math.max(tolerance * 1.5, 12);
    const rawOldPts = beforeEntities.flatMap(entitySamplePoints);
    const rawNewPts = afterEntities.flatMap(entitySamplePoints);
    const oldPts = afterSegs.length
      ? rawOldPts.filter((pt) => afterSegs.every(([a, b]) => pointToSegmentDist(pt, a, b) > sepTol))
      : rawOldPts;
    const newPts = beforeSegs.length
      ? rawNewPts.filter((pt) => beforeSegs.every(([a, b]) => pointToSegmentDist(pt, a, b) > sepTol))
      : rawNewPts;
    const oldPosition = await evaluateWorldPointsPixels(ctx.win, oldPts.length ? oldPts : rawOldPts, beforeSnap, afterSnap, 18);
    const newPosition = await evaluateWorldPointsPixels(ctx.win, newPts.length ? newPts : rawNewPts, beforeSnap, afterSnap, 18);
    if (oldPosition.sampledPoints === 0 || oldPosition.changedPoints < 1 || oldPosition.maxDiff < 18) {
      fail(`Lệnh ${name} không tạo thay đổi pixel nhìn thấy được tại vị trí cũ (${oldPosition.changedPoints}/${oldPosition.sampledPoints} điểm đổi, maxDiff=${oldPosition.maxDiff}).`);
    }
    if (newPosition.sampledPoints === 0 || newPosition.changedPoints < 1 || newPosition.maxDiff < 18 || newPosition.afterContrastMax < 20) {
      fail(`Lệnh ${name} không tạo thay đổi pixel nhìn thấy được tại vị trí mới (${newPosition.changedPoints}/${newPosition.sampledPoints} điểm đổi, maxDiff=${newPosition.maxDiff}).`);
    }
    return {
      command: name,
      threshold: { pixelDiff: 18, minChangedPoints: 1 },
      oldPosition,
      newPosition,
      visible: true,
    };
  }
  return null;
}

function verifyZoomFraction(check, minimum = 0.40) {
  if (!check?.inside || !Number.isFinite(Number(check.fraction)) || Number(check.fraction) < minimum) {
    fail(`ZOOM_TO không đưa vùng cần xem vào khung đủ lớn (fraction=${check?.fraction ?? 'n/a'}, cần ≥${minimum}).`);
  }
  return { ...check, verified: true };
}

async function waitFor(win, call, predicate, timeoutMs = 2500) {
  const started = Date.now();
  let value = null;
  while (Date.now() - started < timeoutMs) {
    value = await q(win, call);
    if (predicate(value)) return value;
    await wait(70);
  }
  return null;
}

function addTarget(ctx, rect, kind = 'panel') {
  if (!rect) return;
  ctx.scene.targets.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, t: ctx.rec.time, zoom: ZOOM[kind] || ZOOM.panel });
}

async function clickAt(ctx, rect, { button = 'left', count = 1, dwell = 0, kind = 'panel' } = {}) {
  addTarget(ctx, rect, kind);
  const c = center(rect);
  await ctx.input.moveTo(c.x, c.y);
  if (dwell > 0) await ctx.input.hold(dwell);
  await ctx.input.click({ button, count });
}

async function ensurePanel(ctx, panel) {
  const current = await q(ctx.win, 'state()?.ui?.structuralElement');
  if (current === panel) return false;
  const tab = await q(ctx.win, `sidebarTab(${JSON.stringify(PANEL_LABELS[panel] || panel)})`);
  if (!tab) fail(`Không tìm thấy tab "${PANEL_LABELS[panel] || panel}" ở thanh bên trái.`);
  await clickAt(ctx, tab, { kind: 'panel' });
  const ok = await waitFor(ctx.win, 'state()?.ui?.structuralElement', (v) => v === panel);
  if (!ok) fail(`Không mở được bảng ${PANEL_LABELS[panel] || panel}.`);
  await ctx.input.hold(0.25);
  return true;
}

async function layerRow(ctx, name) {
  await ensurePanel(ctx, 'Layers');
  const row = await q(ctx.win, `layerRow(${JSON.stringify(name)})`);
  if (!row || !row.name) fail(`Không tìm thấy layer "${name}" trong bảng Lớp.`);
  return row;
}

async function layerState(ctx) {
  return (await q(ctx.win, 'layers()')) || { current: '', list: [] };
}

async function selectAll(ctx) {
  await ctx.input.press('A', { modifiers: ['control'], frames: 2 });
}

async function waitIdle(ctx, timeoutMs = 3000) {
  return waitFor(ctx.win, 'cmd()', (c) => c && !c.active, timeoutMs);
}

function promptKind(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (!text) return 'idle';
  if (/chọn đối tượng|select object|select objects/.test(text)) return 'selection';
  if (/điểm tiếp theo|next point|điểm thứ hai|second point|góc đối diện|opposite corner|điểm đích|second corner|phía cần|offset side|side to offset/.test(text)) return 'next-point';
  if (/điểm gốc|base point|điểm đầu tiên|first point|chỉ định điểm|xác định điểm|specify point|góc đầu tiên|first corner|tâm/.test(text)) return 'point';
  if (/bán kính|radius|khoảng cách|distance|góc xoay|rotation angle|góc|angle|tỷ lệ|scale factor|chiều cao|height|giá trị|value/.test(text)) return 'value';
  if (/enter|nhấn|kết thúc|finish|thoát|exit/.test(text)) return 'enter';
  return 'unknown';
}

async function assertCleanState(ctx, { allowSelection = false, allowEditor = false, allowMenus = false } = {}) {
  let state;
  try {
    state = await js(ctx.win, 'window.__vcq ? window.__vcq.cleanState() : null');
  } catch (error) {
    fail(`Không đọc được trạng thái sạch của VinaCAD: ${error?.message || error}`);
  }
  if (!state) fail('Không đọc được trạng thái sạch của VinaCAD.');
  return assertCleanStateSnapshot(state, { allowSelection, allowEditor, allowMenus });
}

function assertCleanStateSnapshot(state, { allowSelection = false, allowEditor = false, allowMenus = false } = {}) {
  if (!state) fail('Không đọc được trạng thái sạch của VinaCAD.');
  const problems = [];
  if (state.snapshotError) problems.push(`không kiểm tra được entity id: ${state.snapshotError}`);
  if (state.command?.active) problems.push(`dòng lệnh còn hoạt động: ${state.command.name} — ${state.command.prompt || '(không có prompt)'}`);
  if (state.selectionCount > 0 && !allowSelection) problems.push(`còn ${state.selectionCount} đối tượng được chọn`);
  if (state.editor && !allowEditor) problems.push('trình soạn thảo TEXT/MTEXT vẫn mở');
  if (state.picker) problems.push('bảng chọn màu vẫn mở');
  if (state.menus?.length && !allowMenus) problems.push(`popup/menu vẫn mở: ${state.menus[0] || 'không rõ'}`);
  if (problems.length) fail(`Trạng thái VinaCAD chưa sạch: ${problems.join('; ')}.`);
  return {
    commandIdle: !state.command?.active,
    selectionCount: state.selectionCount,
    editorClosed: !state.editor,
    pickerClosed: !state.picker,
    menusClosed: !state.menus?.length,
  };
}

async function worldPoint(ctx, point, { allowOutside = false } = {}) {
  const pos = await q(ctx.win, `worldToClient(${Number(point[0])}, ${Number(point[1])})`);
  if (!pos) fail('Không quy đổi được toạ độ bản vẽ sang màn hình.');
  if (!pos.inside && !allowOutside) fail(`Điểm [${point}] nằm ngoài vùng đang hiển thị của bản vẽ.`);
  return pos;
}

async function settleSnapPoint(ctx, requested, target) {
  const before = await q(ctx.win, 'cursorPoint()');
  if (!before?.osnap || !before.client || pointClose(before.point, requested, before.tolerance)) return null;
  const canvas = await q(ctx.win, 'canvasRect()');
  if (!canvas) fail('Không đọc được vùng canvas để kiểm tra điểm bắt.');
  const dx = target.x - before.client.x;
  const dy = target.y - before.client.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 0.1) fail('Không xác định được hướng tiếp cận điểm bắt.');
  const approach = {
    x: Math.max(canvas.x + 8, Math.min(canvas.x + canvas.w - 8, target.x + dx / distance * 28)),
    y: Math.max(canvas.y + 8, Math.min(canvas.y + canvas.h - 8, target.y + dy / distance * 28)),
  };
  await ctx.input.moveTo(approach.x, approach.y, { duration: 0.2, bend: 0 });
  await wait(200);
  await ctx.input.moveTo(target.x, target.y, { duration: 0.3, bend: 0 });
  await wait(300);
  await ctx.input.frame();
  const after = await q(ctx.win, 'cursorPoint()');
  if (!after?.point || !pointClose(after.point, requested, after.tolerance)) {
    fail(`Điểm [${requested}] vẫn đang bắt sang [${after?.point || 'không đọc được'}] sau khi rê lại chuột; dừng trước click.`);
  }
  return { requested, before: before.point, after: after.point, approach, tolerance: after.tolerance };
}

// Zooms the CAD view with real wheel notches (anchored at the cursor) until the world box fills
// about `fill` of the canvas: small shapes become clickable and readable, off-screen ones visible.
async function zoomToBox(ctx, min, max, { fill = 0.5, force = false } = {}) {
  const canvas = await q(ctx.win, 'canvasRect()');
  if (!canvas) return false;
  const measure = async () => {
    const a = await worldPoint(ctx, min, { allowOutside: true });
    const b = await worldPoint(ctx, max, { allowOutside: true });
    return { a, b, size: Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1), inside: a.inside && b.inside };
  };
  let m = await measure();
  const target = Math.min(canvas.w, canvas.h) * fill;
  const tooSmall = m.size < target * 0.55;
  const tooBig = m.size > Math.min(canvas.w, canvas.h) * 0.92 || !m.inside;
  if (!force && !tooSmall && !tooBig) return false;
  const centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  addTarget(ctx, { x: canvas.x + canvas.w * 0.2, y: canvas.y + canvas.h * 0.2, w: canvas.w * 0.6, h: canvas.h * 0.6 }, 'chrome');
  // Phase 1: zoom out around the canvas centre until the whole box is in view.
  if (!m.inside) {
    await ctx.input.moveTo(canvas.x + canvas.w / 2, canvas.y + canvas.h / 2);
    for (let i = 0; i < 24 && !m.inside; i++) {
      await ctx.input.wheelStep(-120);
      m = await measure();
    }
    if (!m.inside) fail('Không đưa được vùng cần thao tác vào khung nhìn.');
  }
  // Centre the requested area with a real middle-button pan before zooming.
  const c = await worldPoint(ctx, centre, { allowOutside: true });
  const destination = { x: canvas.x + canvas.w / 2, y: canvas.y + canvas.h / 2 };
  if (Math.hypot(c.x - destination.x, c.y - destination.y) > 4) {
    await ctx.input.moveTo(c.x, c.y);
    ctx.input.wc.sendInputEvent({ type: 'mouseDown', button: 'middle', x: Math.round(c.x), y: Math.round(c.y), clickCount: 1 });
    for (let i = 1; i <= 12; i++) {
      ctx.input.x = c.x + (destination.x - c.x) * i / 12;
      ctx.input.y = c.y + (destination.y - c.y) * i / 12;
      ctx.input.wc.sendInputEvent({ type: 'mouseMove', x: Math.round(ctx.input.x), y: Math.round(ctx.input.y), modifiers: ['middleButtonDown'] });
      await ctx.input.frame();
    }
    ctx.input.wc.sendInputEvent({ type: 'mouseUp', button: 'middle', x: Math.round(destination.x), y: Math.round(destination.y), clickCount: 1 });
    await ctx.input.frame();
    m = await measure();
  }
  const zoomCentre = await worldPoint(ctx, centre, { allowOutside: true });
  if (m.size < target * 0.85 || m.size > target * 1.35) {
    await ctx.input.moveTo(zoomCentre.x, zoomCentre.y);
    for (let i = 0; i < 20; i++) {
      const zoomIn = m.size < target * 0.85;
      const zoomOut = m.size > target * 1.35;
      if (!zoomIn && !zoomOut) break;
      await ctx.input.wheelStep(zoomIn ? 120 : -120);
      const next = await measure();
      if (!next.inside && zoomIn) {
        await ctx.input.wheelStep(-120);
        m = await measure();
        break;
      }
      m = next;
    }
  }
  await ctx.input.hold(0.3);
  return true;
}

function boxOf(points, pad = 0.25, extents = null) {
  const safe = points.filter((p) => Array.isArray(p) && p.length >= 2);
  if (!safe.length) return null;
  const xs = safe.map((p) => p[0]);
  const ys = safe.map((p) => p[1]);
  let minX = Math.min(...xs);
  let minY = Math.min(...ys);
  let maxX = Math.max(...xs);
  let maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const drawingW = extents?.max?.[0] - extents?.min?.[0];
  const drawingH = extents?.max?.[1] - extents?.min?.[1];
  const minSpan = Math.max(400, Math.max(Number.isFinite(drawingW) ? drawingW : 0, Number.isFinite(drawingH) ? drawingH : 0) * 0.13);
  const span = Math.max(w, h, minSpan);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  if (Math.max(w, h) < minSpan) {
    minX = cx - span / 2;
    maxX = cx + span / 2;
    minY = cy - span / 2;
    maxY = cy + span / 2;
  }
  const padding = Math.max(maxX - minX, maxY - minY, 400) * pad;
  return {
    min: [minX - padding, minY - padding],
    max: [maxX + padding, maxY + padding],
  };
}

function boundsCenter(bounds) {
  if (!bounds) return null;
  return [(Number(bounds.min?.[0]) + Number(bounds.max?.[0])) / 2, (Number(bounds.min?.[1]) + Number(bounds.max?.[1])) / 2];
}

function boundsDelta(a, b) {
  if (!a || !b) return null;
  return [Number(b.min?.[0]) - Number(a.min?.[0]), Number(b.min?.[1]) - Number(a.min?.[1])];
}

function entitiesAtPoints(entities, points) {
  const found = [];
  for (const point of points || []) {
    let best = null;
    let bestDistance = Infinity;
    for (const entity of entities || []) {
      const bounds = entity.bounds;
      if (!bounds) continue;
      const minX = Math.min(bounds.min[0], bounds.max[0]) - 20;
      const maxX = Math.max(bounds.min[0], bounds.max[0]) + 20;
      const minY = Math.min(bounds.min[1], bounds.max[1]) - 20;
      const maxY = Math.max(bounds.min[1], bounds.max[1]) + 20;
      const dx = point[0] < minX ? minX - point[0] : point[0] > maxX ? point[0] - maxX : 0;
      const dy = point[1] < minY ? minY - point[1] : point[1] > maxY ? point[1] - maxY : 0;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) { best = entity; bestDistance = distance; }
    }
    if (best && !found.some((entity) => entity.id === best.id)) found.push(best);
  }
  return found;
}

function entitiesNearPoints(entities, points) {
  const found = [];
  for (const point of points || []) {
    const scored = [];
    for (const entity of entities || []) {
      const bounds = entity.bounds;
      if (!bounds) continue;
      const minX = Math.min(bounds.min[0], bounds.max[0]) - 20;
      const maxX = Math.max(bounds.min[0], bounds.max[0]) + 20;
      const minY = Math.min(bounds.min[1], bounds.max[1]) - 20;
      const maxY = Math.max(bounds.min[1], bounds.max[1]) + 20;
      const dx = point[0] < minX ? minX - point[0] : point[0] > maxX ? point[0] - maxX : 0;
      const dy = point[1] < minY ? minY - point[1] : point[1] > maxY ? point[1] - maxY : 0;
      const distance = Math.hypot(dx, dy);
      scored.push({ entity, distance });
    }
    scored.sort((a, b) => a.distance - b.distance);
    const bestDistance = scored[0]?.distance ?? Infinity;
    for (const item of scored) {
      if (item.distance <= Math.max(0.01, bestDistance + 0.01) && !found.some((entity) => entity.id === item.entity.id)) {
        found.push(item.entity);
      }
    }
  }
  return found;
}

function closeEnough(a, b, tolerance = 2) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(0.001, Number(tolerance) || 0);
}

function pointClose(a, b, tolerance) {
  return Array.isArray(a) && Array.isArray(b) && closeEnough(Number(a[0]), Number(b[0]), tolerance)
    && closeEnough(Number(a[1]), Number(b[1]), tolerance);
}

function boundsCloseTranslated(before, after, delta, tolerance) {
  return before?.min && before?.max && after?.min && after?.max
    && pointClose(after.min, [before.min[0] + delta[0], before.min[1] + delta[1]], tolerance)
    && pointClose(after.max, [before.max[0] + delta[0], before.max[1] + delta[1]], tolerance);
}

function normalizeVertices(vertices) {
  const out = Array.isArray(vertices) ? vertices.filter((point) => Array.isArray(point) && point.length >= 2) : [];
  if (out.length > 1 && pointClose(out[0], out[out.length - 1], 1e-6)) out.pop();
  return out;
}

function verticesMatch(actualVertices, expectedVertices, tolerance, { closed = false } = {}) {
  const actual = normalizeVertices(actualVertices);
  const expected = normalizeVertices(expectedVertices);
  if (actual.length !== expected.length || !actual.length) return false;
  const orientations = [expected, [...expected].reverse()];
  for (const oriented of orientations) {
    for (let offset = 0; offset < actual.length; offset++) {
      if (oriented.every((point, index) => pointClose(actual[(index + offset) % actual.length], point, tolerance))) return true;
    }
  }
  return false;
}

function directionOf(entity) {
  if (entity?.start && entity?.end) return { a: entity.start, b: entity.end };
  const vertices = normalizeVertices(entity?.vertices);
  if (vertices.length >= 2) return { a: vertices[0], b: vertices[1] };
  return null;
}

function angleDeg(direction) {
  return Math.atan2(Number(direction.b[1]) - Number(direction.a[1]), Number(direction.b[0]) - Number(direction.a[0])) * 180 / Math.PI;
}

function wrapAngle(value) {
  let out = Number(value);
  while (out > 180) out -= 360;
  while (out < -180) out += 360;
  return out;
}

function rotatePoint(point, centre, degrees) {
  const radians = Number(degrees) * Math.PI / 180;
  const dx = Number(point[0]) - Number(centre[0]);
  const dy = Number(point[1]) - Number(centre[1]);
  return [Number(centre[0]) + dx * Math.cos(radians) - dy * Math.sin(radians), Number(centre[1]) + dx * Math.sin(radians) + dy * Math.cos(radians)];
}

function normalizedText(value) {
  return String(value || '')
    .replace(/\\[ACcFfHhQqTtWwp][^;{}]*;/g, '')
    .replace(/\\P/g, '\n')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\~/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\r/g, '')
    .trim();
}

function verifyCommand(name, step, before, after, selectedBefore, tolerance = 8) {
  for (const list of [before, after, selectedBefore]) {
    if (new Set(list.map((e) => e.id)).size !== list.length) fail('Snapshot có id trùng.');
  }
  const beforeIds = new Set(before.map((entity) => entity.id));
  const created = after.filter((entity) => !beforeIds.has(entity.id));
  const expectedPoints = step.inputs?.filter((input) => input.point).map((input) => input.point) || [];
  if (name === 'LINE') {
    if (expectedPoints.length < 2 || created.length !== expectedPoints.length - 1) fail('LINE không tạo đúng số đoạn mới theo các điểm nhập.');
    const unmatched = [...created];
    for (let index = 1; index < expectedPoints.length; index += 1) {
      const start = expectedPoints[index - 1];
      const end = expectedPoints[index];
      const match = unmatched.findIndex((entity) => entity.type === 'Line' && entity.start && entity.end
        && ((pointClose(entity.start, start, tolerance) && pointClose(entity.end, end, tolerance))
          || (pointClose(entity.start, end, tolerance) && pointClose(entity.end, start, tolerance))));
      if (match < 0) fail(`LINE thiếu đoạn khớp [${start}] → [${end}].`);
      unmatched.splice(match, 1);
    }
    return { kind: 'create', entityType: 'Line', created: created[0].id, createdIds: created.map((entity) => entity.id), start: created[0].start, end: created[0].end, verified: true };
  }
  if (name === 'RECTANG' || name === 'RECTANGLE' || name === 'PLINE') {
    const candidate = created.find((entity) => (entity.type === 'Polyline' || entity.type === '2dPolyline') && entity.vertices?.length);
    if (!candidate || expectedPoints.length < 2) fail(`${name} không tạo polyline mới hoặc thiếu điểm kiểm tra.`);
    const expected = name === 'PLINE'
      ? expectedPoints
      : [[expectedPoints[0][0], expectedPoints[0][1]], [expectedPoints[1][0], expectedPoints[0][1]], expectedPoints[1], [expectedPoints[0][0], expectedPoints[1][1]]];
    const ok = verticesMatch(candidate.vertices, expected, tolerance, { closed: name !== 'PLINE' });
    if (!ok || (name !== 'PLINE' && !candidate.closed)) fail(`${name} có vertices ${JSON.stringify(candidate.vertices)}, không khớp hình học yêu cầu.`);
    return { kind: 'create', entityType: candidate.type, created: candidate.id, vertices: candidate.vertices, closed: candidate.closed, verified: true };
  }
  if (name === 'CIRCLE') {
    const center = expectedPoints[0];
    const radius = Number(step.inputs?.find((input) => input.value !== undefined)?.value);
    const candidate = created.find((entity) => entity.type === 'Circle' && Number.isFinite(entity.radius));
    if (!candidate || created.length !== 1) fail('CIRCLE không tạo đúng một entity Circle mới.');
    if (!Number.isFinite(candidate.radius) || !closeEnough(candidate.radius, radius, Math.max(0.01, radius * 0.01))) fail(`CIRCLE tạo bán kính ${candidate.radius}, cần ${radius}.`);
    if (!center || !candidate.center || !pointClose(candidate.center, center, tolerance)) {
      fail(`Tâm CIRCLE lệch khỏi điểm yêu cầu [${center}].`);
    }
    return { kind: 'create', entityType: 'Circle', created: candidate.id, radius: candidate.radius, verified: true };
  }
  if (name === 'MTEXT') {
    const expected = String(step.inputs?.find((input) => input.value !== undefined)?.value || '').replace(/\r/g, '').trim();
    const candidate = created.find((entity) => entity.type === 'MText'
      && normalizedText(entity.text) === expected);
    if (!candidate) fail(`MTEXT không có nội dung đúng: "${expected}" (đã đọc: ${JSON.stringify(after.filter((entity) => entity.type === 'MText').map((entity) => ({ text: entity.text, height: entity.height })))}).`);
    if (step.height !== undefined && !closeEnough(candidate.height, Number(step.height), Math.max(0.01, Number(step.height) * 0.01))) {
      fail(`MTEXT có chiều cao ${candidate.height}, cần ${step.height}.`);
    }
    return { kind: 'create', entityType: 'MText', created: candidate.id, text: candidate.text, height: candidate.height, verified: true };
  }
  if (name === 'MOVE') {
    const selected = selectedBefore.filter((entity) => entity.bounds);
    const points = step.inputs?.filter((input) => input.point).map((input) => input.point) || [];
    const delta = points.length >= 2 ? [Number(points[1][0]) - Number(points[0][0]), Number(points[1][1]) - Number(points[0][1])] : null;
    if (!selected.length || !delta) {
      fail(`MOVE thiếu tập đối tượng hoặc vector base → destination để kiểm tra (selected=${JSON.stringify(selectedBefore)}).`);
    }
    let actualDelta = null;
    for (const original of selected) {
      const moved = after.find((entity) => entity.id === original.id);
      const actual = boundsDelta(original.bounds, moved?.bounds);
      if (!actual || !boundsCloseTranslated(original.bounds, moved?.bounds, delta, tolerance)
        || !boundsCloseTranslated(original.bounds, moved?.bounds, actual, 0.01)
        || (actualDelta && !pointClose(actual, actualDelta, 0.01))) {
        fail(`MOVE không dịch đúng vector [${delta}]; đối tượng ${original.id} cho delta ${actual || '(không tìm thấy)'} (trước=${JSON.stringify(original.bounds)}, sau=${JSON.stringify(moved?.bounds)}).`);
      }
      actualDelta = actualDelta || actual;
    }
    return { kind: 'edit', moved: selected.map((entity) => entity.id), delta, actualDelta, tolerance, verified: true };
  }
  if (name === 'COPY') {
    const points = expectedPoints;
    const delta = points.length >= 2 ? [Number(points[1][0]) - Number(points[0][0]), Number(points[1][1]) - Number(points[0][1])] : null;
    if (!selectedBefore.length || !delta) fail('COPY thiếu đối tượng đã chọn hoặc vector base → destination.');
    if (created.length !== selectedBefore.length) fail(`COPY tạo ${created.length} entity mới, cần đúng ${selectedBefore.length}.`);
    const originalsRemain = selectedBefore.every((entity) => after.some((candidate) => candidate.id === entity.id && boundsCloseTranslated(entity.bounds, candidate.bounds, [0, 0], 0.01))); 
    if (!originalsRemain) fail('COPY làm mất hoặc thay đổi entity gốc.');
    const vectorTolerance = tolerance;
    const unmatched = [...selectedBefore];
    let actualDelta = null;
    for (const copy of created) {
      const index = unmatched.findIndex((original) => {
        const actual = boundsDelta(original.bounds, copy.bounds);
        return original.type === copy.type && actual
          && boundsCloseTranslated(original.bounds, copy.bounds, delta, vectorTolerance)
          && boundsCloseTranslated(original.bounds, copy.bounds, actual, 0.01)
          && (!actualDelta || pointClose(actual, actualDelta, 0.01));
      });
      if (index < 0) {
        fail(`COPY tạo bản sao ${copy.id} không dời đúng vector [${delta}] trong dung sai bắt điểm ${vectorTolerance}; originals=${JSON.stringify(selectedBefore.map((item) => ({ id: item.id, bounds: item.bounds })))} copy=${JSON.stringify(copy.bounds)}.`);
      }
      actualDelta = actualDelta || boundsDelta(unmatched[index].bounds, copy.bounds);
      unmatched.splice(index, 1);
    }
    return { kind: 'edit', copied: created.map((entity) => entity.id), requestedDelta: delta, actualDelta, vectorTolerance, originalsRemain, verified: true };
  }
  if (name === 'ERASE') {
    const removed = selectedBefore.filter((entity) => !after.some((candidate) => candidate.id === entity.id));
    if (!selectedBefore.length || removed.length !== selectedBefore.length || before.length - after.length !== selectedBefore.length) {
      fail(`ERASE giảm tổng ${before.length - after.length} entity, làm mất ${removed.length}/${selectedBefore.length} id được chọn; phải khớp cả hai.`);
    }
    return { kind: 'edit', beforeCount: before.length, afterCount: after.length, removed: removed.map((entity) => entity.id), verified: true };
  }
  if (name === 'OFFSET') {
    if (created.length !== 1) fail(`OFFSET tạo ${created.length} entity mới, cần đúng 1.`);
    const distance = Number(step.inputs?.find((input) => input.value !== undefined)?.value);
    const candidates = selectedBefore.filter((entity) => entity.bounds);
    const newCenter = boundsCenter(created[0]?.bounds);
    const copyDirection = directionOf(created[0]);
    const isOffsetMatch = (candidate) => {
      const remaining = after.find((entity) => entity.id === candidate.id);
      if (!remaining || !boundsCloseTranslated(candidate.bounds, remaining.bounds, [0, 0], 0.01)) return false;
      const center = boundsCenter(candidate.bounds);
      const dist = center && newCenter ? Math.hypot(newCenter[0] - center[0], newCenter[1] - center[1]) : NaN;
      if (!Number.isFinite(distance) || !Number.isFinite(dist) || !closeEnough(dist, distance, Math.max(tolerance * 2, distance * 0.05))) return false;
      const dir = directionOf(candidate);
      if (candidate.type !== 'Line' || created[0]?.type !== 'Line' || !dir || !copyDirection) return false;
      const ang = Math.abs(wrapAngle(angleDeg(copyDirection) - angleDeg(dir)));
      const vec = dir.b.map((value, axis) => value - dir.a[axis]);
      const len = Math.hypot(...vec);
      const copyLen = Math.hypot(...copyDirection.b.map((value, axis) => value - copyDirection.a[axis]));
      const d = newCenter.map((value, axis) => value - center[axis]);
      const perp = Math.abs(vec[0] * d[1] - vec[1] * d[0]) / len;
      const along = Math.abs(vec[0] * d[0] + vec[1] * d[1]) / len;
      return Math.min(ang, Math.abs(180 - ang)) <= 1 && closeEnough(copyLen, len, 0.01)
        && along <= 0.01 && closeEnough(perp, distance, Math.max(0.01, distance * 0.01));
    };
    if (!candidates.every((candidate) => {
      const remaining = after.find((entity) => entity.id === candidate.id);
      return remaining && boundsCloseTranslated(candidate.bounds, remaining.bounds, [0, 0], 0.01);
    })) fail('OFFSET làm mất hoặc thay đổi đối tượng nguồn.');
    const source = candidates.find(isOffsetMatch) || candidates[0];
    const remainingSource = source && after.find((entity) => entity.id === source.id);
    if (!remainingSource || !boundsCloseTranslated(source.bounds, remainingSource.bounds, [0, 0], 0.01)) fail('OFFSET làm mất hoặc thay đổi đối tượng nguồn.');
    const sourceCenter = boundsCenter(source?.bounds);
    const actual = sourceCenter && newCenter ? Math.hypot(newCenter[0] - sourceCenter[0], newCenter[1] - sourceCenter[1]) : NaN;
    if (!source || !Number.isFinite(distance) || !Number.isFinite(actual) || !closeEnough(actual, distance, Math.max(tolerance * 2, distance * 0.05))) {
      fail(`OFFSET tạo entity cách tâm nguồn khoảng ${actual.toFixed(2)}, cần gần ${distance}.`);
    }
    const originalDirection = directionOf(source);
    if (source.type !== 'Line' || created[0].type !== 'Line' || !originalDirection || !copyDirection) {
      fail('OFFSET hiện chỉ kiểm chứng hình học đường Line.');
    }
    const angle = Math.abs(wrapAngle(angleDeg(copyDirection) - angleDeg(originalDirection)));
    const vector = originalDirection.b.map((value, axis) => value - originalDirection.a[axis]);
    const length = Math.hypot(...vector);
    const copyLength = Math.hypot(...copyDirection.b.map((value, axis) => value - copyDirection.a[axis]));
    const delta = newCenter.map((value, axis) => value - sourceCenter[axis]);
    const perpendicularDistance = Math.abs(vector[0] * delta[1] - vector[1] * delta[0]) / length;
    const alongDistance = Math.abs(vector[0] * delta[0] + vector[1] * delta[1]) / length;
    if (Math.min(angle, Math.abs(180 - angle)) > 1 || !closeEnough(copyLength, length, 0.01)
      || alongDistance > 0.01 || !closeEnough(perpendicularDistance, distance, Math.max(0.01, distance * 0.01))) {
      fail(`OFFSET chưa tạo đoạn song song cùng chiều dài, cách ${distance}; đo được góc ${angle.toFixed(2)}°, khoảng cách ${perpendicularDistance.toFixed(2)}.`);
    }
    return { kind: 'edit', created: created.map((entity) => entity.id), distance, measuredCenterDistance: actual, verified: true };
  }
  if (name === 'ROTATE') {
    const angle = Number(step.inputs?.find((input) => input.value !== undefined)?.value);
    const base = expectedPoints[0];
    if (!selectedBefore.length || !base || !Number.isFinite(angle)) fail('ROTATE thiếu đối tượng, điểm gốc hoặc góc số.');
    const measured = [];
    for (const source of selectedBefore) {
      const current = after.find((entity) => entity.id === source.id);
      if (!current || !directionOf(source) || !directionOf(current)) fail('ROTATE thiếu entity có hướng đo được.');
      const beforeDirection = directionOf(source);
      const afterDirection = directionOf(current);
      const actual = wrapAngle(angleDeg(afterDirection) - angleDeg(beforeDirection));
      if (Math.abs(wrapAngle(actual - angle)) > 1) fail(`ROTATE đổi hướng ${actual.toFixed(2)}°, cần ${angle}°.`);
      const expectedStart = rotatePoint(beforeDirection.a, base, angle);
      const expectedEnd = rotatePoint(beforeDirection.b, base, angle);
      const direct = pointClose(afterDirection.a, expectedStart, tolerance) && pointClose(afterDirection.b, expectedEnd, tolerance);
      const reverse = pointClose(afterDirection.a, expectedEnd, tolerance) && pointClose(afterDirection.b, expectedStart, tolerance);
      if (!direct && !reverse) fail(`ROTATE không quay quanh điểm gốc [${base}] với sai số ${tolerance}.`);
      measured.push({ id: source.id, angle: actual });
    }
    return { kind: 'edit', rotated: measured[0].id, rotatedIds: measured.map((entity) => entity.id), angle: measured[0].angle, measured, verified: true };
  }
  fail(`Lệnh ${name} chưa có hậu điều kiện hình học được kiểm chứng.`);
}

const ACTIONS = {
  async open_panel(ctx, step) {
    const opened = await ensurePanel(ctx, step.panel);
    const panel = await q(ctx.win, 'panelRect()');
    addTarget(ctx, panel, 'panel');
    if (!opened) await ctx.input.hold(0.4);
    return `Mở bảng ${PANEL_LABELS[step.panel] || step.panel}`;
  },

  async select_layer(ctx, step) {
    const row = await layerRow(ctx, step.layer);
    await clickAt(ctx, row.name, { kind: 'panel' });
    const ok = await waitFor(ctx.win, 'layers()', (s) => s && String(s.current).toLowerCase() === step.layer.toLowerCase());
    if (!ok) fail(`Chọn layer "${step.layer}" không thành công (layer có thể đang bị đóng băng).`);
    return `Chọn layer ${step.layer} (đặt làm layer hiện hành)`;
  },

  async set_current_layer(ctx, step) {
    return ACTIONS.select_layer(ctx, step);
  },

  async rename_layer(ctx, step) {
    const row = await layerRow(ctx, step.layer);
    if (step.layer === '0') fail('Không thể đổi tên layer 0.');
    await clickAt(ctx, row.name, { count: 2, kind: 'panel' });
    const input = await waitFor(ctx.win, 'renameInput()', (v) => v && v.rect);
    if (!input) fail(`Không mở được ô đổi tên cho layer "${step.layer}".`);
    if (!input.focused) {
      await clickAt(ctx, input.rect, { kind: 'panel' });
    }
    await selectAll(ctx);
    await ctx.input.type(step.to, { cps: 11 });
    await ctx.input.press('Enter', { frames: 8 });
    const ok = await waitFor(ctx.win, 'layers()', (s) => s && s.list.some((l) => l.name === step.to) && !s.list.some((l) => l.name === step.layer));
    if (!ok) fail(`Đổi tên "${step.layer}" → "${step.to}" không được VinaCAD ghi nhận.`);
    await ctx.input.hold(0.3);
    return `Đổi tên layer ${step.layer} → ${step.to}`;
  },

  async set_layer_color(ctx, step) {
    const hex = String(step.color).replace('#', '').toUpperCase();
    const want = { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
    const beforeEntitySnapshot = snapshotOrFail(await q(ctx.win, 'entitySnapshot()'), `layer-color ${step.layer} (before)`);
    const pixelBefore = await sampleLayerPixels(ctx, step.layer, beforeEntitySnapshot);
    const row = await layerRow(ctx, step.layer);
    await clickAt(ctx, row.swatch, { kind: 'panel' });
    const picker = await waitFor(ctx.win, 'picker()', (p) => p && p.hex);
    if (!picker) fail('Bảng chọn màu không mở.');
    addTarget(ctx, picker.rect, 'panel');
    await clickAt(ctx, picker.hex, { kind: 'panel' });
    await selectAll(ctx);
    await ctx.input.type(hex, { cps: 2 });
    const matches = (s) => {
      const layer = s && s.list.find((l) => l.name.toLowerCase() === step.layer.toLowerCase());
      return Boolean(layer && layer.rgb && layer.rgb.r === want.r && layer.rgb.g === want.g && layer.rgb.b === want.b);
    };
    // react-pick-color commits the hex value on blur. Give its controlled state
    // one render before tabbing out; if a browser build drops that blur, fill
    // the three numeric fields, each of which calls VinaCAD's layer handler.
    await ctx.input.hold(0.35);
    await ctx.input.press('Tab', { frames: 3 });
    let ok = await waitFor(ctx.win, 'layers()', matches, 2200);
    if (!ok) {
      for (const [field, value] of [[picker.red, want.r], [picker.green, want.g], [picker.blue, want.b]]) {
        if (!field) continue;
        await clickAt(ctx, field, { kind: 'panel' });
        await selectAll(ctx);
        await ctx.input.type(String(value), { cps: 12 });
        await ctx.input.press('Tab', { frames: 2 });
        await wait(120);
      }
      ok = await waitFor(ctx.win, 'layers()', matches, 2200);
    }
    if (!ok) fail(`Đổi màu layer "${step.layer}" sang #${hex} không được ghi nhận.`);
    await ctx.input.hold(0.5);
    const spot = await q(ctx.win, 'neutralSpot()');
    if (spot) await clickAt(ctx, spot, { kind: 'panel' });
    else await ctx.input.press('Escape', { frames: 4 });
    await waitFor(ctx.win, 'picker()', (p) => !p, 1500);
    const entityColorState = await q(ctx.win, `entityLayerColors(${JSON.stringify(step.layer)})`);
    const afterEntitySnapshot = snapshotOrFail(await q(ctx.win, 'entitySnapshot()'), `layer-color ${step.layer} (after)`);
    const pixelAfter = await sampleLayerPixels(ctx, step.layer, afterEntitySnapshot);
    const comparisons = pixelBefore.samples.map((beforeSample) => {
      const afterSample = pixelAfter.samples.find((sample) => sample.id === beforeSample.id);
      return {
        id: beforeSample.id,
        before: beforeSample.rgb,
        after: afterSample?.rgb || null,
        changed: pixelDistance(beforeSample.rgb, afterSample?.rgb) >= 8,
        towardTarget: pixelTowardTarget(beforeSample.rgb, afterSample?.rgb, want, beforeSample.background),
      };
    });
    const changed = comparisons.filter((item) => item.changed);
    const towardTarget = comparisons.filter((item) => item.towardTarget);
    const layerAfter = await q(ctx.win, 'layers()');
    const layerRecord = layerAfter?.list?.find((item) => String(item.name).toLowerCase() === String(step.layer).toLowerCase()) || null;
    const layerColorMatches = Boolean(layerRecord?.rgb && layerRecord.rgb.r === want.r && layerRecord.rgb.g === want.g && layerRecord.rgb.b === want.b);
    // Compare against the target composited with the observed canvas background.
    const visibleEvidence = changed.length > 0 && towardTarget.length > 0;
    if (pixelBefore.entityCount > 0 && (!layerColorMatches || !visibleEvidence)) {
      fail(`Đổi màu layer "${step.layer}" sang #${hex} chưa được xác nhận trên nét hiển thị. layerAfter=${JSON.stringify(layerRecord)} samples=${JSON.stringify(comparisons.slice(0, 6))} state=${JSON.stringify(entityColorState)}`);
    }
    return {
      intent: `Đổi màu layer ${step.layer} sang #${hex}`,
      verification: { kind: 'layer-color', layer: step.layer, rgb: want, entityColorState: entityColorState || null, layerRecord, pixelBefore, pixelAfter, pixelComparisons: comparisons, visibleChangedSamples: changed.length, visibleTowardTargetSamples: towardTarget.length, verified: true },
    };
  },

  async toggle_layer(ctx, step) {
    const before = (await layerState(ctx)).list.find((l) => l.name.toLowerCase() === step.layer.toLowerCase());
    if (!before) fail(`Layer "${step.layer}" không tồn tại.`);
    const row = await layerRow(ctx, step.layer);
    const key = step.property === 'locked' ? 'lock' : 'freeze';
    const field = step.property === 'locked' ? 'isLocked' : 'isFrozen';
    if (!row[key]) fail(step.property === 'locked' ? 'Không tìm thấy nút khoá layer.' : `Không thể tắt hiển thị layer hiện hành "${step.layer}".`);
    // The icons only appear on hover, exactly like a real user discovering them.
    addTarget(ctx, row.row, 'panel');
    const rc = center(row.row);
    await ctx.input.moveTo(rc.x, rc.y);
    await ctx.input.hold(0.25);
    await clickAt(ctx, row[key], { kind: 'panel' });
    const ok = await waitFor(ctx.win, 'layers()', (s) => {
      const layer = s && s.list.find((l) => l.name.toLowerCase() === step.layer.toLowerCase());
      return Boolean(layer && layer[field] !== before[field]);
    });
    if (!ok) fail(`Bật/tắt ${step.property === 'locked' ? 'khoá' : 'hiển thị'} layer "${step.layer}" không được ghi nhận.`);
    await ctx.input.hold(0.3);
    const verb = step.property === 'locked' ? (before.isLocked ? 'Mở khoá' : 'Khoá') : (before.isFrozen ? 'Bật hiển thị' : 'Tắt hiển thị');
    return `${verb} layer ${step.layer}`;
  },

  async create_layer(ctx, step) {
    await ensurePanel(ctx, 'Layers');
    const before = await layerState(ctx);
    const plus = await q(ctx.win, 'plusButton()');
    if (!plus) fail('Không tìm thấy nút + tạo layer.');
    await clickAt(ctx, plus, { kind: 'panel' });
    const input = await waitFor(ctx.win, 'renameInput()', (v) => v && v.rect, 2500);
    if (step.name && input) {
      await selectAll(ctx);
      await ctx.input.type(step.name, { cps: 11 });
    }
    if (input) await ctx.input.press('Enter', { frames: 8 });
    const ok = await waitFor(ctx.win, 'layers()', (s) => s && s.list.length === before.list.length + 1
      && (!step.name || s.list.some((l) => l.name === step.name)));
    if (!ok) fail('Tạo layer mới không thành công.');
    await ctx.input.hold(0.3);
    return step.name ? `Tạo layer ${step.name}` : 'Tạo layer mới';
  },

  async delete_layer(ctx, step) {
    let s = await layerState(ctx);
    if (!s.list.some((l) => l.name.toLowerCase() === step.layer.toLowerCase())) fail(`Layer "${step.layer}" không tồn tại.`);
    if (String(s.current).toLowerCase() === step.layer.toLowerCase()) {
      // VinaCAD refuses to delete the current layer: switch to layer 0 first, as a user would.
      const zero = await layerRow(ctx, '0');
      await clickAt(ctx, zero.name, { kind: 'panel' });
      await waitFor(ctx.win, 'layers()', (v) => v && v.current === '0');
      s = await layerState(ctx);
    }
    const row = await layerRow(ctx, step.layer);
    await clickAt(ctx, row.name, { button: 'right', kind: 'panel' });
    const item = await waitFor(ctx.win, 'menuItem("Xóa")', (m) => m && m.rect, 2000);
    if (!item) fail('Menu chuột phải của layer không hiện mục "Xóa".');
    if (item.disabled) fail(`VinaCAD không cho xoá layer "${step.layer}"${item.reason ? `: ${item.reason}` : ''}.`);
    addTarget(ctx, item.rect, 'panel');
    const c = center(item.rect);
    // The context menu closes on mouseleave, so travel straight onto the item.
    await ctx.input.moveTo(c.x, c.y, { duration: 0.32, bend: 0 });
    await ctx.input.click();
    const ok = await waitFor(ctx.win, 'layers()', (v) => v && !v.list.some((l) => l.name.toLowerCase() === step.layer.toLowerCase()));
    if (!ok) fail(`Xoá layer "${step.layer}" không thành công.`);
    await ctx.input.hold(0.3);
    return `Xoá layer trống ${step.layer}`;
  },

  async command(ctx, step) {
    const name = step.name.toUpperCase();
    const initial = await q(ctx.win, 'cmd()');
    if (initial?.active) fail(`Không thể bắt đầu ${name}: lệnh ${initial.name || 'khác'} vẫn đang chạy.`);
    const inputs = step.inputs || [];
    const points = inputs.filter((i) => i.point).map((i) => i.point);
    const windowPoints = inputs.filter((i) => Array.isArray(i.window) && i.window.length === 2).flatMap((i) => i.window);
    const preselectPoints = ctx.selectedSnapshot?.length ? (ctx.lastSelectStep?.window || ctx.lastSelectStep?.points || []) : [];
    const translatedPreselect = preselectPoints.length && points.length >= 2 && EDIT_COMMANDS.has(name)
      ? preselectPoints.map((p) => [p[0] + points[1][0] - points[0][0], p[1] + points[1][1] - points[0][1]])
      : [];
    const geometryPoints = [...points, ...windowPoints, ...preselectPoints, ...translatedPreselect];
    if (name === 'CIRCLE' && points[0] && Number.isFinite(Number(inputs.find((i) => i.value !== undefined)?.value))) {
      const r = Number(inputs.find((i) => i.value !== undefined)?.value);
      geometryPoints.push([points[0][0] - r, points[0][1] - r], [points[0][0] + r, points[0][1] + r]);
    }
    const box = boxOf(geometryPoints, 0.25, ctx.context?.extents);
    if (box) await zoomToBox(ctx, box.min, box.max, { fill: 0.42 });
    ctx.measureTolerance = Number(await q(ctx.win, 'worldTolerance()')) || 8;
    const historyStart = (await q(ctx.win, 'historyLength()')) || 0;
    const before = snapshotOrFail(await q(ctx.win, 'entitySnapshot()'), `${name} (before)`);
    const selectedPageRaw = await q(ctx.win, 'selectedEntities()');
    const selectedPage = selectedPageRaw?.__error ? snapshotOrFail(selectedPageRaw, `${name} (selection)`) : selectedPageRaw;
    // selectedEntities() is a UI wrapper with object-shaped bounds. Prefer the
    // normalized CAD snapshot captured by the preceding select action so the
    // geometric verifier can compare vectors without mixing representations.
    let selectedBefore = ctx.selectedSnapshot?.length ? ctx.selectedSnapshot : (selectedPage || []);
    const beforeSnap = VISIBLE_POSTCONDITION_COMMANDS.has(name) ? await captureCanvasSnapshot(ctx.win) : null;
    const ribbon = RIBBON[name] ? await q(ctx.win, `ribbon(${JSON.stringify(RIBBON[name][0])}, ${JSON.stringify(RIBBON[name][1])})`) : null;
    if (ribbon) {
      await clickAt(ctx, ribbon, { dwell: 0.45, kind: 'chrome' });
    } else {
      const input = await q(ctx.win, 'commandInput()');
      if (!input) fail('Không tìm thấy ô nhập lệnh.');
      await clickAt(ctx, input, { kind: 'chrome' });
      await q(ctx.win, 'focusCommandInput()');
      await ctx.input.type(name, { cps: 10 });
      await ctx.input.press('Enter', { frames: 6 });
    }
    let state = await waitFor(ctx.win, 'cmd()', (c) => c && c.active, 3000);
    // Some edit commands finish immediately when the preselected set is empty. That is a real
    // failure, while a preselected set may legitimately complete without another prompt.
    if (!state && !(selectedBefore?.length && EDIT_COMMANDS.has(name) && !inputs.length)) {
      const history = (await q(ctx.win, `historySince(${historyStart})`)) || [];
      fail(`Lệnh ${name} không khởi động được${history.length ? ` (${history.slice(-1)[0]})` : ''}.`);
    }

    const expectPrompt = async (kind, label) => {
      state = await waitFor(ctx.win, 'cmd()', (c) => c && c.active, 2500);
      if (!state) fail(`Lệnh ${name} không còn hoạt động trước ${label}.`);
      const actual = promptKind(state.prompt);
      if (actual !== kind && !(kind === 'next-point' && actual === 'point')) {
        fail(`Lệnh ${name} đang chờ ${state.prompt || '(không rõ)'}, không khớp dữ liệu ${label}.`);
      }
      return state;
    };
    const pointerCorrections = [];
    const clickWorldPoint = async (input) => {
      const pos = await worldPoint(ctx, input.point);
      addTarget(ctx, { x: pos.x - 90, y: pos.y - 90, w: 180, h: 180 }, 'drawing');
      await wait(180);
      await ctx.input.moveTo(pos.x, pos.y);
      await wait(180);
      const correction = await settleSnapPoint(ctx, input.point, pos);
      if (correction) pointerCorrections.push(correction);
      await ctx.input.hold(Math.max(0.2, input.hover || 0));
      await ctx.input.click();
    };
    const selectWindowAtPrompt = async (windowInput) => {
      if (!Array.isArray(windowInput) || windowInput.length !== 2) fail(`Lệnh ${name} cần window gồm đúng hai góc.`);
      const start = await worldPoint(ctx, windowInput[0]);
      const end = await worldPoint(ctx, windowInput[1]);
      addTarget(ctx, { x: Math.min(start.x, end.x) - 20, y: Math.min(start.y, end.y) - 20, w: Math.abs(end.x - start.x) + 40, h: Math.abs(end.y - start.y) + 40 }, 'drawing');
      await expectPrompt('selection', 'khung chọn');
      await ctx.input.moveTo(start.x, start.y, { duration: 0.35, bend: 0 });
      await ctx.input.click({ button: 'left' });
      await ctx.input.moveTo(end.x, end.y, { duration: 0.7, bend: 0 });
      await ctx.input.click({ button: 'left' });
      await ctx.input.press('Enter', { frames: 6 });
      await wait(160);
      const after = await q(ctx.win, 'cmd()');
      if (after?.active && promptKind(after.prompt) === 'selection') {
        // A drag is the normal web-select path when the two-corner click is
        // swallowed by Chromium's pointer synthesis.
        await ctx.input.press('Escape', { frames: 4 });
        await expectPrompt('selection', 'khung chọn bằng kéo');
        await ctx.input.moveTo(start.x, start.y, { duration: 0.35, bend: 0 });
        ctx.input.wc.sendInputEvent({ type: 'mouseDown', button: 'left', x: Math.round(start.x), y: Math.round(start.y), clickCount: 1 });
        await ctx.input.frame();
        await ctx.input.moveTo(end.x, end.y, { duration: 0.75, bend: 0 });
        ctx.input.wc.sendInputEvent({ type: 'mouseMove', x: Math.round(end.x), y: Math.round(end.y), movementX: 0, movementY: 0 });
        await ctx.input.frame();
        ctx.input.wc.sendInputEvent({ type: 'mouseUp', button: 'left', x: Math.round(end.x), y: Math.round(end.y), clickCount: 1 });
        await ctx.input.frame();
        await ctx.input.press('Enter', { frames: 6 });
        await wait(160);
      }
      const final = await q(ctx.win, 'cmd()');
      if (final?.active && promptKind(final.prompt) === 'selection') fail(`Lệnh ${name} không chấp nhận khung chọn [${windowInput[0]}] – [${windowInput[1]}].`);
    };

    let editorCommitted = false;
    for (const input of inputs) {
      if (input.window) {
        const current = await q(ctx.win, 'cmd()');
        if (promptKind(current?.prompt) === 'selection') {
          await selectWindowAtPrompt(input.window);
        } else if (promptKind(current?.prompt) === 'point' && selectedBefore.length) {
          const low = input.window[0].map((value, axis) => Math.min(value, input.window[1][axis]));
          const high = input.window[0].map((value, axis) => Math.max(value, input.window[1][axis]));
          const expected = before.filter((entity) => entity.bounds && [0, 1].every((axis) => entity.bounds.min[axis] >= low[axis] && entity.bounds.max[axis] <= high[axis]));
          if (expected.length !== selectedBefore.length || !expected.every((entity) => selectedBefore.some((picked) => picked.id === entity.id))) {
            fail(`Lệnh ${name} đã có vùng chọn nhưng không khớp toàn bộ khung yêu cầu.`);
          }
        } else {
          fail(`Lệnh ${name} không ở prompt chọn đối tượng cho window.`);
        }
      } else if (input.point) {
        const current = await q(ctx.win, 'cmd()');
        if (name === 'OFFSET' && ['selection', 'value'].includes(promptKind(current?.prompt))) {
          if (promptKind(current?.prompt) === 'selection') await clickWorldPoint(input);
          selectedBefore = entitiesNearPoints(before || [], [input.point]);
          ctx.selectedSnapshot = selectedBefore;
          await wait(80);
          continue;
        }
        if (EDIT_COMMANDS.has(name) && name !== 'OFFSET' && promptKind(current?.prompt) === 'selection') {
          if (ctx.lastSelectStep?.window?.length === 2) {
            await selectWindowAtPrompt(ctx.lastSelectStep.window);
          } else if (ctx.lastSelectStep?.points?.length) {
            for (const pt of ctx.lastSelectStep.points) await clickWorldPoint({ point: pt });
            await ctx.input.press('Enter', { frames: 6 });
            await wait(160);
          }
        }
        await expectPrompt(points.indexOf(input.point) > 0 ? 'next-point' : 'point', 'điểm');
        await clickWorldPoint(input);
      } else if (input.value !== undefined) {
        if (name === 'MTEXT') {
          const editor = await waitFor(ctx.win, 'textEditor()', (v) => v && v.rect, 3000);
          if (!editor) fail('MTEXT không mở trình soạn thảo trên canvas.');
          if (step.height !== undefined) {
            const heightInput = await q(ctx.win, 'textHeightInput()');
            if (!heightInput) fail('Không tìm thấy ô chiều cao chữ MTEXT.');
            await clickAt(ctx, heightInput, { kind: 'chrome' });
            await selectAll(ctx);
            await ctx.input.type(String(step.height), { cps: 10 });
            await ctx.input.press('Enter', { frames: 5 });
          }
          const currentEditor = await q(ctx.win, 'textEditor()');
          if (!currentEditor?.rect) fail('Ô nhập MTEXT đã đóng trước khi nhập nội dung.');
          await clickAt(ctx, currentEditor.rect, { kind: 'chrome' });
          await selectAll(ctx);
          await ctx.input.type(String(input.value), { cps: 11 });
          const apply = await waitFor(ctx.win, 'textApplyButton()', (v) => v, 1500);
          if (!apply) fail('Không tìm thấy nút xác nhận MTEXT (Apply text).');
          await clickAt(ctx, apply, { kind: 'chrome' });
          await wait(350);
          const debugEditor = await q(ctx.win, 'textEditor()');
          if (debugEditor) {
            const debugButton = await q(ctx.win, 'textApplyButton()');
            fail(`Nút Apply text không đóng trình soạn thảo MTEXT (editor=${JSON.stringify(debugEditor)}, button=${JSON.stringify(debugButton)}).`);
          }
          editorCommitted = true;
        } else {
          const currentPrompt = await q(ctx.win, 'cmd()');
          if (name === 'OFFSET' && promptKind(currentPrompt?.prompt) === 'selection') {
            await ctx.input.press('Enter', { frames: 6 });
            await wait(80);
          }
          const p = name === 'ROTATE' && currentPrompt?.active && promptKind(currentPrompt.prompt) === 'point'
            ? currentPrompt
            : await expectPrompt('value', `giá trị ${input.value}`);
          if (name !== 'ROTATE' && promptKind(p.prompt) !== 'value') fail(`Prompt của ${name} không nhận giá trị số.`);
          await q(ctx.win, 'focusCommandInput()');
          await ctx.input.type(String(input.value), { cps: 11 });
          await ctx.input.press('Enter', { frames: 6 });
        }
      } else if (input.key === 'Escape') {
        await ctx.input.press('Escape', { frames: 6 });
      } else if (input.key === 'Enter') {
        state = await waitFor(ctx.win, 'cmd()', (c) => c && c.active, 2500);
        if (!state) fail(`Lệnh ${name} không còn hoạt động trước Enter.`);
        const kind = promptKind(state.prompt);
        if (!['selection', 'next-point', 'enter'].includes(kind)) fail(`Không được nhấn Enter trong prompt: ${state.prompt}`);
        await ctx.input.press('Enter', { frames: 6 });
      } else {
        fail(`Input của ${name} không có point, value hoặc key hợp lệ.`);
      }
      await wait(80);
    }
    if (editorCommitted && name === 'MTEXT') await wait(300);
    const idle = await waitIdle(ctx, 3500);
    const history = (await q(ctx.win, `historySince(${historyStart})`)) || [];
    const problem = history.find((h) => /invalid input|unsupported command|required|không hợp lệ/i.test(h));
    if (problem) fail(`Lệnh ${name} báo lỗi: ${problem}`);
    if (!idle) {
      await ctx.input.press('Escape', { frames: 4 });
      fail(`Lệnh ${name} chưa kết thúc sau các bước nhập (thiếu điểm hoặc thiếu Enter).`);
    }
    const after = snapshotOrFail(await q(ctx.win, 'entitySnapshot()'), `${name} (after)`);
    const afterSnap = VISIBLE_POSTCONDITION_COMMANDS.has(name) ? await captureCanvasSnapshot(ctx.win) : null;
    let verification;
    try {
      verification = verifyCommand(name, step, before || [], after || [], selectedBefore || [], ctx.measureTolerance);
      const visibility = await verifyCommandVisibility(ctx, name, step, before || [], after || [], selectedBefore || [], beforeSnap, afterSnap, ctx.measureTolerance);
      if (visibility) verification.visibility = visibility;
      if (pointerCorrections.length) verification.pointerCorrections = pointerCorrections;
    } catch (error) {
      fail(`${error.message} history=${JSON.stringify(history.slice(-8))}`);
    }
    ctx.selectedSnapshot = [];
    ctx.lastSelectStep = null;
    await ctx.input.hold(0.35);
    return { intent: `Lệnh ${name}`, verification };
  },

  async hover(ctx, step) {
    const p = step.point;
    await zoomToBox(ctx, [p[0] - 1, p[1] - 1], [p[0] + 1, p[1] + 1], { fill: 0.001 });
    const pos = await worldPoint(ctx, step.point);
    addTarget(ctx, { x: pos.x - 90, y: pos.y - 90, w: 180, h: 180 }, 'drawing');
    await ctx.input.moveTo(pos.x, pos.y);
    await ctx.input.hold(step.seconds || 1);
    return `Rê chuột tới [${step.point}]`;
  },

  async select(ctx, step) {
    const state = await q(ctx.win, 'cmd()');
    if (state?.active) fail('Đang có lệnh chạy, không thể chọn đối tượng.');
    const selectionPoints = step.window ? step.window : step.points;
    const box = boxOf(selectionPoints, 0.05, ctx.context?.extents);
    await zoomToBox(ctx, box.min, box.max, { fill: step.window?.length === 2 ? 0.55 : 0.001 });
    ctx.measureTolerance = Number(await q(ctx.win, 'worldTolerance()')) || 8;
    const snapshot = snapshotOrFail(await q(ctx.win, 'entitySnapshot()'), 'select');
    if (step.window?.length === 2) {
      const start = await worldPoint(ctx, step.window[0]);
      const end = await worldPoint(ctx, step.window[1]);
      addTarget(ctx, { x: Math.min(start.x, end.x) - 20, y: Math.min(start.y, end.y) - 20, w: Math.abs(end.x - start.x) + 40, h: Math.abs(end.y - start.y) + 40 }, 'drawing');
      const drag = async (a, b) => {
        await ctx.input.moveTo(a.x, a.y, { duration: 0.35, bend: 0 });
        ctx.input.wc.sendInputEvent({ type: 'mouseDown', button: 'left', x: Math.round(a.x), y: Math.round(a.y), clickCount: 1 });
        await ctx.input.frame();
        await ctx.input.moveTo(b.x, b.y, { duration: 0.7, bend: 0 });
        ctx.input.wc.sendInputEvent({ type: 'mouseMove', x: Math.round(b.x), y: Math.round(b.y), movementX: 0, movementY: 0 });
        await ctx.input.frame();
        ctx.input.wc.sendInputEvent({ type: 'mouseUp', button: 'left', x: Math.round(b.x), y: Math.round(b.y), clickCount: 1 });
        await ctx.input.frame();
        // VinaCAD's web selection handler can miss a synthetic mouseUp when the
        // browser has just entered SELECT. A real click at the second corner
        // completes the same window without changing the intended coordinates.
        await ctx.input.click({ button: 'left' });
        await wait(180);
      };
      // First try the CAD-native two-corner flow. In VinaCAD a blank click
      // starts SELECT and the next click supplies the opposite corner; this
      // is more reliable than relying on Chromium's synthetic drag state.
      await ctx.input.moveTo(start.x, start.y, { duration: 0.35, bend: 0 });
      await ctx.input.click({ button: 'left' });
      await ctx.input.moveTo(end.x, end.y, { duration: 0.7, bend: 0 });
      await ctx.input.click({ button: 'left' });
      let pickedWindow = await q(ctx.win, 'selectedEntities()');
      if (!Array.isArray(pickedWindow) || !pickedWindow.length) {
        await ctx.input.press('Escape', { frames: 4 });
        await drag(end, start);
      }
    } else for (const point of step.points) {
      const pos = await worldPoint(ctx, point);
      addTarget(ctx, { x: pos.x - 90, y: pos.y - 90, w: 180, h: 180 }, 'drawing');
      await ctx.input.moveTo(pos.x, pos.y);
      await ctx.input.hold(0.2);
      await ctx.input.click();
    }
    const ok = step.window?.length === 2
      ? await waitFor(ctx.win, 'selectedEntities()', (value) => Array.isArray(value) && value.length > 0, 2200)
      : await waitFor(ctx.win, 'hasSelection()', Boolean, 1500);
    if (!ok) {
      if (step.window?.length === 2) await ctx.rec.saveCheckpoint('window-selection-debug').catch(() => {});
      const diagnostics = step.window?.length === 2 ? { window: step.window, command: await q(ctx.win, 'cmd()'), history: (await q(ctx.win, 'historySince(0)') || []).slice(-4), canvas: await q(ctx.win, 'canvasRect()') } : null;
      fail(`Không chọn được đối tượng nào tại các điểm đã cho.${diagnostics ? ` Debug=${JSON.stringify(diagnostics)}` : ''}`);
    }
    if (step.window?.length === 2) {
      const pageSelected = (await q(ctx.win, `selectedEntities()`)) || [];
      const ids = new Set(Array.isArray(pageSelected) ? pageSelected.map((entity) => entity?.id) : []);
      ctx.selectedSnapshot = (snapshot || []).filter((entity) => ids.has(entity?.id));
      if (!ctx.selectedSnapshot.length) ctx.selectedSnapshot = pageSelected;
    } else {
      ctx.selectedSnapshot = entitiesAtPoints(snapshot || [], step.points);
    }
    if (ctx.selectedSnapshot?.__error) snapshotOrFail(ctx.selectedSnapshot, 'select window');
    if (!ctx.selectedSnapshot.length) fail('Không xác định được entity hình học tại điểm đã chọn để kiểm tra hậu điều kiện.');
    ctx.lastSelectStep = step;
    await ctx.input.hold(0.3);
    return step.window?.length === 2
      ? `Chọn vùng [${step.window[0]}] – [${step.window[1]}]`
      : `Chọn ${step.points.length} đối tượng`;
  },

  async zoom_to(ctx, step) {
    await zoomToBox(ctx, step.min, step.max, { fill: 0.75, force: true });
    const check = await q(ctx.win, `zoomCheck(${JSON.stringify(step.min)}, ${JSON.stringify(step.max)})`);
    const verification = verifyZoomFraction(check, 0.40);
    return { intent: `Phóng to vùng [${step.min}] – [${step.max}]`, verification: { kind: 'view', ...verification } };
  },

  async zoom_extents(ctx) {
    const btn = await q(ctx.win, 'byTooltip("THU PHÓNG TOÀN CẢNH")');
    if (!btn) fail('Không tìm thấy nút "Thu phóng toàn cảnh" trên giao diện.');
    await clickAt(ctx, btn, { dwell: 0.3, kind: 'chrome' });
    // The result is the whole drawing, so the camera should open up to it.
    addTarget(ctx, await q(ctx.win, 'canvasRect()'), 'chrome');
    await ctx.input.hold(0.5);
    let check = ctx.context?.extents ? await q(ctx.win, `zoomCheck(${JSON.stringify(ctx.context.extents.min)}, ${JSON.stringify(ctx.context.extents.max)})`) : null;
    if (ctx.context?.extents && (!check?.inside || check.fraction < 0.25)) {
      await zoomToBox(ctx, ctx.context.extents.min, ctx.context.extents.max, { fill: 0.72, force: true });
      check = await q(ctx.win, `zoomCheck(${JSON.stringify(ctx.context.extents.min)}, ${JSON.stringify(ctx.context.extents.max)})`);
    }
    if (ctx.context?.extents && (!check?.inside || check.fraction < 0.25)) fail('ZOOM_EXTENTS không hiển thị được toàn bộ extents bản vẽ.');
    return { intent: 'Thu phóng toàn cảnh', verification: { kind: 'view', ...(check || {}), verified: true } };
  },

  async toggle_mode(ctx, step) {
    const mode = MODE_TOGGLES[step.mode];
    if (!mode) fail(`Mode ${step.mode} chưa được hỗ trợ.`);
    if (typeof step.on !== 'boolean') fail(`toggle_mode ${step.mode} thiếu on:true|false.`);
    const read = `(() => { const s = window.store.getState(); return Boolean(${mode.read}); })()`;
    const before = await js(ctx.win, read).catch(() => null);
    if (mode.key) {
      await ctx.input.press(mode.key, { frames: 8 });
    } else {
      const btn = await q(ctx.win, `footer(${JSON.stringify(mode.label)})`);
      if (!btn) fail(`Không tìm thấy nút ${mode.label} ở thanh trạng thái.`);
      await clickAt(ctx, btn, { kind: 'chrome' });
    }
    const started = Date.now();
    let after = before;
    while (Date.now() - started < 2000 && after === before) {
      after = await js(ctx.win, read).catch(() => before);
      await wait(70);
    }
    if (after !== step.on) fail(`Chế độ ${step.mode} kết thúc ở ${after}, cần ${step.on}.`);
    await ctx.input.hold(0.3);
    return { intent: `${after ? 'Bật' : 'Tắt'} ${step.mode}`, verification: { kind: 'mode', mode: step.mode, before, after, target: step.on, verified: true } };
  },

  async click(ctx, step) {
    const target = await q(ctx.win, `findClickable(${JSON.stringify(step.text)})`);
    if (!target) fail(`Không tìm thấy "${step.text}" trên giao diện.`);
    await clickAt(ctx, target, { dwell: 0.2, kind: 'chrome' });
    await ctx.input.hold(0.4);
    return `Bấm "${step.text}"`;
  },

  async pause(ctx, step) {
    await ctx.input.hold(step.seconds || 1);
    return `Giữ khung ${step.seconds || 1}s`;
  },

  async escape(ctx) {
    await ctx.input.press('Escape', { frames: 6 });
    if (!await waitIdle(ctx)) fail('Không huỷ được lệnh đang chạy.');
    return 'Huỷ lệnh';
  },
};

async function runStep(step, ctx) {
  const handler = ACTIONS[step.type];
  if (!handler) fail(`Action "${step.type}" chưa được hỗ trợ.`);
  try {
    const installed = await js(ctx.win, PAGE_HELPERS);
    if (installed !== true) fail('Không cài được bộ helper kiểm tra VinaCAD.');
  } catch (error) {
    fail(`Không cài được bộ helper kiểm tra VinaCAD: ${error?.message || error}`);
  }
  const result = await handler(ctx, step);
  const normalized = typeof result === 'string' ? { intent: result } : (result || {});
  const cleanState = await assertCleanState(ctx, { allowSelection: step.type === 'select' });
  return { ...normalized, cleanState };
}

function planNeedsProminentDemoLayer(plan) {
  const createCmds = new Set(['LINE', 'PLINE', 'RECTANG', 'RECTANGLE', 'CIRCLE', 'MTEXT']);
  const explicitLayerSteps = new Set(['select_layer', 'set_current_layer', 'create_layer', 'rename_layer']);
  for (const scene of plan?.scenes || []) {
    for (const step of scene?.steps || []) {
      if (explicitLayerSteps.has(step?.type)) return false;
      if (step?.type === 'command' && createCmds.has(String(step.name || '').toUpperCase())) {
        return true;
      }
    }
  }
  return false;
}

// Pre-roll setup (not recorded): helpers, idle command line, default Prop panel, prominent demo layer.
async function prepareStage(win, plan = null) {
  await js(win, PAGE_HELPERS).catch(() => {});
  await js(win, `(async () => {
    const app = window.__inWeb;
    try {
      if (app?.commandManager?.currentCmd && app.commandManager.currentCmdName !== 'SELECT') await app.commandManager.cancelCommand();
    } catch (e) {}
    const s = window.store?.getState?.();
    if (s && s.ui && s.ui.structuralElement !== 'Prop') window.store.dispatch({ type: 'ui/setStructuralElement', payload: 'Prop' });
    document.activeElement?.blur?.();
    return true;
  })()`).catch(() => {});
  if (planNeedsProminentDemoLayer(plan)) {
    await js(win, `(() => {
      const inWeb = window.__inWeb || window.__INWEB_INSTANCE__;
      if (!inWeb || !inWeb.Database || !inWeb.CadModule) return false;
      const CadModule = inWeb.CadModule;
      const db = inWeb.Database;
      const openWrite = window.OpenMode ? window.OpenMode.kForWrite : 1;
      const demoName = 'VINACUT-DEMO';
      const layerTableId = db.getLayerTableId();
      const layerTable = CadModule.OdDbLayerTable.cast(layerTableId.safeOpenObject(openWrite, false));
      let recId = null;
      try {
        const sName = new CadModule.OdString(demoName);
        const has = Boolean(layerTable.has1 ? layerTable.has1(sName) : false);
        if (!has) {
          const rec = CadModule.OdDbLayerTableRecord.createObject();
          rec.setName(sName);
          const cm = new CadModule.OdCmColor();
          cm.setRGB(255, 179, 71);
          rec.setColor(cm);
          cm.delete?.();
          recId = layerTable.add(rec);
          rec.delete?.();
        } else {
          recId = layerTable.getAt3 ? layerTable.getAt3(sName, false) : null;
          if (recId && !recId.isNull()) {
            const rec = CadModule.OdDbLayerTableRecord.cast(recId.safeOpenObject(openWrite, false));
            if (rec) {
              const cm = new CadModule.OdCmColor();
              cm.setRGB(255, 179, 71);
              rec.setColor(cm);
              cm.delete?.();
              rec.setIsFrozen(false);
              rec.setIsLocked(false);
              rec.delete?.();
            }
          }
        }
        sName.delete?.();
        if (recId && !recId.isNull()) {
          db.setCLAYER(recId);
        }
      } catch (e) {}
      recId?.delete?.();
      layerTable?.delete?.();
      layerTableId?.delete?.();
      window.dispatchEvent(new Event('ReloadProperties'));
      inWeb.AppCore?.Update?.();
      inWeb.renderNow?.();
      return true;
    })()`).catch(() => {});
    await wait(160);
  }
  const targets = {};
  for (const scene of plan?.scenes || []) {
    for (const step of scene.steps || []) {
      if (step.type === 'toggle_mode' && typeof step.on === 'boolean' && targets[step.mode] === undefined) targets[step.mode] = step.on;
    }
  }
  if (Object.keys(targets).length) {
    await js(win, `(async () => {
      const targets = ${JSON.stringify(targets)};
      const store = window.store;
      const inWeb = window.__inWeb;
      const setting = store?.getState?.()?.settingDialog?.setting || {};
      const dispatch = (type, payload) => store?.dispatch?.({ type, payload });
      for (const [mode, on] of Object.entries(targets)) {
        const target = !on;
        if (mode === 'OSNAP') dispatch('settingDialog/setEnableObjectSnap', target);
        else if (mode === 'OTRACK') dispatch('settingDialog/setEnableObjectSnapTracking', target);
        else if (mode === 'ORTHO') {
          dispatch('settingDialog/setEnableOrtho', target);
          try { inWeb?.setOrthoMode?.(target); } catch {}
        } else if (mode === 'POLAR') dispatch('settingDialog/updateSetting', { section: 'tracking', key: 'polarTracking', value: target });
        else if (mode === 'GRID') dispatch('settingDialog/updateSetting', { section: 'snapAndGrid', key: 'grid', value: target });
      }
      return true;
    })()`).catch(() => {});
    await wait(220);
  }
  await wait(500);
}

// Planning context for user drawings: layers, extents and notable points.
async function readPlanningContext(win) {
  await js(win, PAGE_HELPERS).catch(() => {});
  const context = await js(win, `(() => {
    const app = window.__inWeb;
    const cad = app.CadModule;
    const s = window.store.getState();
    const hex = (c) => c ? '#' + [c.r, c.g, c.b].map((v) => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase() : '#FFFFFF';
    const round = (v) => Math.round(Number(v) * 100) / 100;
    // Plan coordinates live in the input drawing plane (XY in a top view, XZ/YZ otherwise), which
    // is exactly what worldToClient maps when the recorder clicks a point.
    const plane = window.__vcq.planeAxes() || { u: 'x', v: 'y' };
    const uv = (p) => { const out = [round(p[plane.u] ?? 0), round(p[plane.v] ?? 0)]; p.delete?.(); return out; };
    const counts = {};
    const shapes = [];
    const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const grow = (q) => {
      if (!Number.isFinite(q[0]) || !Number.isFinite(q[1]) || Math.abs(q[0]) > 1e12 || Math.abs(q[1]) > 1e12) return;
      box.minX = Math.min(box.minX, q[0]); box.minY = Math.min(box.minY, q[1]);
      box.maxX = Math.max(box.maxX, q[0]); box.maxY = Math.max(box.maxY, q[1]);
    };
    // Per-entity geometric extents work for every entity type, block references included.
    const extentsOf = (ent) => {
      const ext = new cad.OdGeExtents3d();
      let out = null;
      try {
        if (ent.getGeomExtents(ext) === 0) out = [uv(ext.minPoint()), uv(ext.maxPoint())];
      } catch (e) {}
      ext.delete?.();
      return out;
    };
    try {
      const entities = app.databaseManager.getAllEntities() || [];
      entities.forEach((ent, index) => {
        try {
          if (index >= 8000) return;
          const layer = ent.layer().toString();
          counts[layer] = (counts[layer] || 0) + 1;
          const ext = extentsOf(ent);
          if (ext) { grow(ext[0]); grow(ext[1]); }
          const type = ent.isA().name().toString();
          const size = ext ? Math.hypot(ext[1][0] - ext[0][0], ext[1][1] - ext[0][1]) : 0;
          if (type === 'AcDbLine') {
            const line = cad.OdDbLine.cast(ent);
            shapes.push({ size, layer, kind: 'line', a: uv(line.startPoint()), b: uv(line.endPoint()) });
          } else if (type === 'AcDbCircle' || type === 'AcDbArc') {
            const c = type === 'AcDbCircle' ? cad.OdDbCircle.cast(ent) : cad.OdDbArc.cast(ent);
            shapes.push({ size, layer, kind: 'circle', center: uv(c.center()) });
          } else if (type === 'AcDbBlockReference') {
            shapes.push({ size, layer, kind: 'block', at: uv(cad.OdDbBlockReference.cast(ent).position()) });
          } else if (ext) {
            shapes.push({ size, layer, kind: 'box', corners: ext, name: type.replace(/^AcDb/, '') });
          }
        } catch (e) {}
        try { ent.delete?.(); } catch (e) {}
      });
    } catch (e) {}
    const describe = (shape) => {
      const tag = ' (layer ' + shape.layer + ')';
      if (shape.kind === 'line') return [
        { desc: 'Điểm cuối đoạn thẳng' + tag, point: shape.a },
        { desc: 'Trung điểm đoạn thẳng' + tag, point: [round((shape.a[0] + shape.b[0]) / 2), round((shape.a[1] + shape.b[1]) / 2)] },
      ];
      if (shape.kind === 'circle') return [{ desc: 'Tâm đường tròn/cung' + tag, point: shape.center }];
      if (shape.kind === 'block') return [{ desc: 'Điểm chèn block' + tag, point: shape.at }];
      return [
        { desc: 'Góc ' + shape.name + tag, point: shape.corners[0] },
        { desc: 'Góc đối diện ' + shape.name + tag, point: shape.corners[1] },
      ];
    };
    const keyPoints = shapes.sort((p, q) => q.size - p.size).slice(0, 14).flatMap(describe).slice(0, 24);
    const extents = box.maxX > box.minX && box.maxY > box.minY
      ? { min: [round(box.minX), round(box.minY)], max: [round(box.maxX), round(box.maxY)] }
      : null;
    const openAreas = extents
      ? [
          {
            name: 'Vùng trống trung tâm bản vẽ',
            min: [round(box.minX + (box.maxX - box.minX) * 0.25), round(box.minY + (box.maxY - box.minY) * 0.25)],
            max: [round(box.minX + (box.maxX - box.minX) * 0.75), round(box.minY + (box.maxY - box.minY) * 0.75)],
            center: [round((box.minX + box.maxX) / 2), round((box.minY + box.maxY) / 2)],
          },
        ]
      : [];
    const layers = (s.layers?.layers || []).map((l) => ({ name: l.name, color: hex(l.colorRGB), locked: Boolean(l.isLocked),
      frozen: Boolean(l.isFrozen), entityCount: counts[l.name] || 0 }));
    return {
      activePanel: s.ui?.structuralElement || '',
      currentLayer: s.layers?.selectedLayer || '0',
      plane: plane.u.toUpperCase() + plane.v.toUpperCase(),
      layers,
      extents,
      openAreas,
      keyPoints,
      entityTotal: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  })()`);
  if (!context || context.__error || !Array.isArray(context.layers)) return context;
  const layers = await Promise.all(context.layers.map(async (layer) => {
    if (!layer.entityCount) return { ...layer, colorEffect: { canChangeVisible: false, basis: 'empty-layer' } };
    const api = await q(win, `entityLayerColors(${JSON.stringify(layer.name)})`);
    const pixels = await sampleLayerPixels({ win }, layer.name).catch((error) => {
      if (error instanceof ActionFailure) throw error;
      return { samples: [], entityCount: layer.entityCount };
    });
    const visibleSamples = (pixels.samples || []).filter((sample) => sample.rgb && Math.max(sample.rgb.r, sample.rgb.g, sample.rgb.b) > 35).length;
    const blockSafe = !api?.blockRefs || (api.blockInternalsChecked && !api.blockExplicit);
    const canChangeVisible = Boolean(api?.byLayer > 0 && visibleSamples > 0 && blockSafe);
    return {
      ...layer,
      colorEffect: {
        canChangeVisible,
        basis: canChangeVisible ? 'ByLayer entity + canvas pixel sample' : (!blockSafe ? 'block internals have explicit/unknown colors' : api?.byLayer ? 'ByLayer entity not visible at sampled points' : 'explicit color; do not promise layer-color effect'),
        byLayer: api?.byLayer || 0,
        explicit: api?.explicit || 0,
        visibleSamples,
        blockInternalsChecked: Boolean(api?.blockInternalsChecked),
      },
    };
  }));
  return { ...context, layers };
}

module.exports = {
  runStep,
  prepareStage,
  readPlanningContext,
  ActionFailure,
  PAGE_HELPERS,
  assertCleanState,
  assertCleanStateSnapshot,
  verifyCommand,
  verifyCommandVisibility,
  collinearOverlapStats,
  verifyZoomFraction,
  pixelTowardTarget,
  closeEnough,
  queryPage: q,
  settleSnapPoint,
};
