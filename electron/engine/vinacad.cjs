const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { wait } = require('./capture.cjs');

const VINACAD_URL = 'https://web.vina-cad.com/vi';
const SAMPLE_ID = '__BUILTIN_SAMPLE__';

const isSamplePath = (p) => !p || p === SAMPLE_ID || /Sample_FloorPlan_ISO\.(dwg|dxf)$/i.test(String(p));

// Static knowledge of the built-in sample so plans can be made without opening VinaCAD first.
const SAMPLE_CONTEXT = {
  drawingName: 'Sample_FloorPlan_ISO.dwg',
  activePanel: 'Prop',
  currentLayer: '0',
  extents: { min: [-200, -2000], max: [13800, 9900] },
  layers: [
    { name: '0', color: '#FFFFFF', entityCount: 0 },
    { name: 'A-DIMS', color: '#808080', entityCount: 17 },
    { name: 'A-DOORS', color: '#52B788', entityCount: 8 },
    { name: 'A-FURNITURE', color: '#8C8C8C', entityCount: 55 },
    { name: 'A-NOTES', color: '#FFFF00', entityCount: 6 },
    { name: 'A-WALLS', color: '#FFFFFF', entityCount: 30 },
    { name: 'A-WINDOWS', color: '#00FFFF', entityCount: 10 },
    { name: 'TEMP-EMPTY', color: '#FF00FF', entityCount: 0 },
  ],
  regions: [
    { name: 'BEDROOM 01', min: [200, 4550], max: [6900, 7800] },
    { name: 'BEDROOM 02', min: [7100, 3950], max: [11800, 7800] },
    { name: 'LIVING ROOM', min: [200, 200], max: [6900, 4400] },
    { name: 'KITCHEN / DINING', min: [7100, 200], max: [11800, 3800] },
  ],
  // Per 4.4, only the sofa multi-line object is kept in hand-authored objects (bounds + general multi-entity hint, no pre-baked selectWindow/safeMoveTarget).
  objects: [
    { name: 'Sofa phòng khách', layer: 'A-FURNITURE', kind: '6 đường Line tạo một vật thể (cần quét cửa sổ bao ngoài min..max cộng biên ~100)', min: [900, 600], max: [3500, 1500] },
  ],
  openAreas: [
    {
      name: 'Vùng sàn trống giữa phòng khách (phía trên)',
      min: [3600, 2400],
      max: [6600, 4100],
      center: [5100, 3250],
    },
    {
      name: 'Vùng sàn trống phòng khách (bên phải sofa)',
      min: [3800, 600],
      max: [6600, 1750],
      center: [5200, 1175],
    },
    {
      name: 'Vùng sàn trống phòng ngủ 01',
      min: [3700, 4800],
      max: [6600, 6000],
      center: [5150, 5400],
    },
    {
      name: 'Vùng sàn trống dọc mép trên tường trong phía dưới phòng khách (y=300..900)',
      min: [600, 300],
      max: [6500, 900],
      center: [2100, 500],
    },
  ],
  keyPoints: [
    { desc: 'Góc ngoài tường dưới-trái (endpoint)', point: [0, 0] },
    { desc: 'Góc ngoài tường dưới-phải (endpoint)', point: [12000, 0] },
    { desc: 'Góc ngoài tường trên-phải (endpoint)', point: [12000, 8000] },
    { desc: 'Góc ngoài tường trên-trái (endpoint)', point: [0, 8000] },
    { desc: 'Điểm giữa đoạn tường trong phía dưới phòng khách (dùng cho OFFSET vào lòng phòng tại [2100, 500])', point: [2100, 200] },
    { desc: 'Trung điểm tường ngoài bên trái (midpoint)', point: [0, 4000] },
    { desc: 'Trung điểm tường ngoài phía trên (midpoint)', point: [6000, 8000] },
    { desc: 'Góc trong tường dưới-trái (endpoint)', point: [200, 200] },
    { desc: 'Góc trong tường trên-phải (endpoint)', point: [11800, 7800] },
    { desc: 'Đầu tường ngăn giữa phòng khách và bếp (endpoint)', point: [6900, 3200] },
    { desc: 'Đầu tường ngăn phòng ngủ 02 (endpoint)', point: [8500, 3800] },
    { desc: 'Tâm vùng trống giữa phòng khách (dùng cho CIRCLE / hình mới)', point: [5100, 3250] },
    { desc: 'Trung điểm cửa sổ phòng ngủ 01 (midpoint)', point: [2400, 7925] },
    { desc: 'Bản lề cửa phòng ngủ 01 (endpoint)', point: [4900, 4550] },
    { desc: 'Bản lề cửa ra vào chính (endpoint)', point: [9000, 200] },
  ],
};

async function waitForEditorReady(win, maxWaitMs = 60000, signal) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (signal?.aborted) throw new Error('Đã dừng tác vụ.');
    if (win.isDestroyed()) throw new Error('Cửa sổ VinaCAD đã bị đóng.');
    const state = await win.webContents.executeJavaScript(`
      (() => {
        try {
          localStorage.setItem('drive_terms_accepted', 'true');
          window.onbeforeunload = null;
        } catch {}
        const agree = Array.from(document.querySelectorAll('[role="dialog"] button, [aria-modal="true"] button'))
          .find((b) => /^(đồng ý|agree|chấp nhận)$/i.test((b.innerText || '').trim()));
        if (agree) agree.click();
        const s = window.store && window.store.getState ? window.store.getState() : null;
        const inWeb = window.__inWeb || window.__INWEB_INSTANCE__;
        const hasInWeb = Boolean(inWeb && inWeb.Database && inWeb.CadModule && inWeb.AppCore && inWeb.View);
        return hasInWeb && Boolean(s && s.drawing && s.drawing.initSuccess && s.ui && s.ui.isLoadedFont
          && s.loadingDrawing && !s.loadingDrawing.isLoading);
      })()
    `).catch(() => false);
    if (state) {
      await wait(700);
      return true;
    }
    await wait(400);
  }
  return false;
}

// Builds the sample floor plan directly in the (fresh, dedicated) recorder session.
async function buildSampleDrawing(win) {
  const built = await win.webContents.executeJavaScript(`
    (async () => {
      const inWeb = window.__inWeb || window.__INWEB_INSTANCE__;
      if (!inWeb || !inWeb.Database || !inWeb.CadModule) return false;
      const CadModule = inWeb.CadModule;
      const db = inWeb.Database;
      const openWrite = window.OpenMode ? window.OpenMode.kForWrite : 1;
      const msId = db.getModelSpaceId();
      const ms = CadModule.OdDbBlockTableRecord.cast(msId.safeOpenObject(openWrite, false));
      try {
        const iter = ms.newIterator(true, false, false);
        for (iter.start(true, true); !iter.done(); iter.step(true, true)) {
          try {
            const ent = iter.entity(openWrite, false);
            if (ent) {
              ent.erase(true);
              ent.delete?.();
            }
          } catch (e) {}
        }
        iter.delete?.();
      } catch (e) {}

      const layerDefs = [
        { name: 'A-DIMS', r: 128, g: 128, b: 128 },
        { name: 'A-DOORS', r: 82, g: 183, b: 136 },
        { name: 'A-FURNITURE', r: 140, g: 140, b: 140 },
        { name: 'A-NOTES', r: 255, g: 255, b: 0 },
        { name: 'A-WALLS', r: 255, g: 255, b: 255 },
        { name: 'A-WINDOWS', r: 0, g: 255, b: 255 },
        { name: 'TEMP-EMPTY', r: 255, g: 0, b: 255 },
      ];
      const layerTableId = db.getLayerTableId();
      const layerTable = CadModule.OdDbLayerTable.cast(layerTableId.safeOpenObject(openWrite, false));
      for (const def of layerDefs) {
        let hasLayer = false;
        try {
          const sName = new CadModule.OdString(def.name);
          hasLayer = Boolean(layerTable.has1 ? layerTable.has1(sName) : false);
          sName.delete?.();
        } catch (e) {}
        if (!hasLayer) {
          try {
            const rec = CadModule.OdDbLayerTableRecord.createObject();
            rec.setName(new CadModule.OdString(def.name));
            layerTable.add(rec);
            rec.delete?.();
          } catch (e) {}
        }
      }
      try {
        const it = layerTable.newIterator(true, true);
        while (!it.done()) {
          const recId = it.getRecordId();
          const rec = CadModule.OdDbLayerTableRecord.cast(recId.safeOpenObject(openWrite, false));
          if (rec) {
            const found = layerDefs.find((d) => d.name === rec.getName().toString());
            if (found) {
              const cmColor = new CadModule.OdCmColor();
              cmColor.setRGB(found.r, found.g, found.b);
              rec.setColor(cmColor);
              cmColor.delete?.();
            }
            rec.setIsFrozen(false);
            rec.setIsLocked(false);
            rec.delete?.();
          }
          recId.delete?.();
          it.step(true, true);
        }
        it.delete?.();
      } catch (e) {}
      layerTable.delete?.();
      layerTableId.delete?.();

      const addLine = (layer, x1, y1, x2, y2) => {
        const line = CadModule.OdDbLine.createObject();
        line.setDatabaseDefaults(db, false);
        line.setStartPoint(new CadModule.OdGePoint3d(x1, y1, 0));
        line.setEndPoint(new CadModule.OdGePoint3d(x2, y2, 0));
        line.setLayer(new CadModule.OdString(layer), true, true);
        ms.appendOdDbEntity(line);
        line.delete?.();
      };
      const addRect = (layer, x1, y1, x2, y2) => {
        addLine(layer, x1, y1, x2, y1);
        addLine(layer, x2, y1, x2, y2);
        addLine(layer, x2, y2, x1, y2);
        addLine(layer, x1, y2, x1, y1);
      };
      const addCircle = (layer, cx, cy, r) => {
        const c = CadModule.OdDbCircle.createObject();
        c.setDatabaseDefaults(db, false);
        c.setCenter(new CadModule.OdGePoint3d(cx, cy, 0));
        c.setRadius(r);
        c.setLayer(new CadModule.OdString(layer), true, true);
        ms.appendOdDbEntity(c);
        c.delete?.();
      };
      const addArc = (layer, cx, cy, r, startDeg, endDeg) => {
        const a = CadModule.OdDbArc.createObject();
        a.setDatabaseDefaults(db, false);
        a.setCenter(new CadModule.OdGePoint3d(cx, cy, 0));
        a.setRadius(r);
        a.setStartAngle((startDeg * Math.PI) / 180);
        a.setEndAngle((endDeg * Math.PI) / 180);
        a.setLayer(new CadModule.OdString(layer), true, true);
        ms.appendOdDbEntity(a);
        a.delete?.();
      };
      const addText = (layer, x, y, height, str) => {
        const t = CadModule.OdDbText.createObject();
        t.setDatabaseDefaults(db, true);
        t.setTextString(new CadModule.OdString(str));
        const pt = new CadModule.OdGePoint3d(x, y, 0);
        t.setPosition(pt);
        t.setAlignmentPoint(pt);
        t.setHeight(height);
        t.setLayer(new CadModule.OdString(layer), true, true);
        ms.appendOdDbEntity(t);
        t.delete?.();
      };

      addLine('A-WALLS', 0, 0, 9000, 0);
      addLine('A-WALLS', 10000, 0, 12000, 0);
      addLine('A-WALLS', 12000, 0, 12000, 8000);
      addLine('A-WALLS', 12000, 8000, 0, 8000);
      addLine('A-WALLS', 0, 8000, 0, 0);
      addLine('A-WALLS', 200, 200, 9000, 200);
      addLine('A-WALLS', 10000, 200, 11800, 200);
      addLine('A-WALLS', 11800, 200, 11800, 7800);
      addLine('A-WALLS', 11800, 7800, 200, 7800);
      addLine('A-WALLS', 200, 7800, 200, 200);
      addLine('A-WALLS', 9000, 0, 9000, 200);
      addLine('A-WALLS', 10000, 0, 10000, 200);
      addLine('A-WALLS', 6900, 200, 6900, 3200);
      addLine('A-WALLS', 7100, 200, 7100, 3200);
      addLine('A-WALLS', 6900, 3200, 7100, 3200);
      addLine('A-WALLS', 6900, 4200, 6900, 7800);
      addLine('A-WALLS', 7100, 4200, 7100, 7800);
      addLine('A-WALLS', 6900, 4200, 7100, 4200);
      addLine('A-WALLS', 200, 4400, 4900, 4400);
      addLine('A-WALLS', 200, 4550, 4900, 4550);
      addLine('A-WALLS', 4900, 4400, 4900, 4550);
      addLine('A-WALLS', 5900, 4400, 6900, 4400);
      addLine('A-WALLS', 5900, 4550, 6900, 4550);
      addLine('A-WALLS', 5900, 4400, 5900, 4550);
      addLine('A-WALLS', 7100, 3800, 8500, 3800);
      addLine('A-WALLS', 7100, 3950, 8500, 3950);
      addLine('A-WALLS', 8500, 3800, 8500, 3950);
      addLine('A-WALLS', 9400, 3800, 11800, 3800);
      addLine('A-WALLS', 9400, 3950, 11800, 3950);
      addLine('A-WALLS', 9400, 3800, 9400, 3950);

      addRect('A-WINDOWS', 1200, 7800, 3600, 8050);
      addLine('A-WINDOWS', 1200, 7925, 3600, 7925);
      addRect('A-WINDOWS', 7600, 7800, 10000, 8050);
      addLine('A-WINDOWS', 7600, 7925, 10000, 7925);

      addLine('A-DOORS', 4900, 4550, 4900, 5550);
      addArc('A-DOORS', 4900, 4550, 1000, 0, 90);
      addLine('A-DOORS', 5900, 4200, 6900, 4200);
      addArc('A-DOORS', 6900, 4200, 1000, 180, 270);
      addLine('A-DOORS', 9400, 3950, 9400, 4850);
      addArc('A-DOORS', 9400, 3950, 900, 90, 180);
      addLine('A-DOORS', 9000, 200, 9000, 1200);
      addArc('A-DOORS', 9000, 200, 1000, 0, 90);

      addRect('A-FURNITURE', 1200, 5400, 3400, 7450);
      addRect('A-FURNITURE', 1350, 6900, 2200, 7300);
      addRect('A-FURNITURE', 2400, 6900, 3250, 7300);
      addRect('A-FURNITURE', 7800, 5300, 10000, 7450);
      addRect('A-FURNITURE', 7950, 6900, 8800, 7300);
      addRect('A-FURNITURE', 9000, 6900, 9850, 7300);
      addRect('A-FURNITURE', 10550, 6500, 11550, 7450);
      addRect('A-FURNITURE', 10550, 4450, 11550, 6350);
      addRect('A-FURNITURE', 1500, 2100, 3100, 2950);
      addRect('A-FURNITURE', 900, 600, 3500, 1500);
      addLine('A-FURNITURE', 1300, 600, 1300, 1500);
      addLine('A-FURNITURE', 3100, 600, 3100, 1500);
      addCircle('A-FURNITURE', 9300, 2350, 620);
      addCircle('A-FURNITURE', 9300, 3180, 200);
      addCircle('A-FURNITURE', 9300, 1520, 200);
      addCircle('A-FURNITURE', 8470, 2350, 200);
      addCircle('A-FURNITURE', 10130, 2350, 200);
      addLine('A-FURNITURE', 7500, 400, 11550, 400);
      addLine('A-FURNITURE', 11550, 400, 11550, 2750);
      addLine('A-FURNITURE', 11550, 2750, 10950, 2750);
      addLine('A-FURNITURE', 10950, 2750, 10950, 950);
      addLine('A-FURNITURE', 10950, 950, 7500, 950);
      addLine('A-FURNITURE', 7500, 950, 7500, 400);
      addCircle('A-FURNITURE', 7950, 675, 140);
      addCircle('A-FURNITURE', 8450, 675, 140);

      addText('A-NOTES', 0, 9450, 420, 'SAMPLE FLOOR PLAN');
      addText('A-NOTES', 0, 8850, 175, 'VINACAD WEB  /  LAYER DEMO  /  DRAWING SAMPLE');
      addText('A-NOTES', 3900, 6250, 220, 'BEDROOM 01');
      addText('A-NOTES', 7650, 4550, 220, 'BEDROOM 02');
      addText('A-NOTES', 3900, 1950, 220, 'LIVING ROOM');
      addText('A-NOTES', 7550, 1200, 220, 'KITCHEN / DINING');

      addLine('A-DIMS', 0, -250, 0, -1800);
      addLine('A-DIMS', 7000, -250, 7000, -1100);
      addLine('A-DIMS', 12000, -250, 12000, -1800);
      addLine('A-DIMS', 0, -900, 12000, -900);
      addLine('A-DIMS', 0, -1600, 12000, -1600);
      addLine('A-DIMS', -100, -1000, 100, -800);
      addLine('A-DIMS', 6900, -1000, 7100, -800);
      addLine('A-DIMS', 11900, -1000, 12100, -800);
      addText('A-DIMS', 3200, -780, 180, '7000');
      addText('A-DIMS', 9200, -780, 180, '5000');
      addText('A-DIMS', 2900, -1950, 170, 'DIMENSIONS FOR DEMO / OVERALL W 12000MM');
      addLine('A-DIMS', 12250, 0, 13100, 0);
      addLine('A-DIMS', 12250, 8000, 13100, 8000);
      addLine('A-DIMS', 12900, 0, 12900, 8000);
      addLine('A-DIMS', 12800, -100, 13000, 100);
      addLine('A-DIMS', 12800, 7900, 13000, 8100);
      addText('A-DIMS', 13150, 3900, 180, '8000');

      ms.delete?.();
      msId.delete?.();
      if (window.store) window.store.dispatch({ type: 'drawing/setFileName', payload: 'Sample_FloorPlan_ISO.dwg' });
      window.dispatchEvent(new Event('ReloadProperties'));
      try {
        inWeb.setGridMode?.(false);
        inWeb.drawGridInCanvas?.(false);
        inWeb.updateGrid?.();
      } catch (e) {}
      const view = inWeb.View;
      if (view && typeof view.zoomExtents === 'function') {
        const minPt = new CadModule.OdGePoint3d(-1600, -2500, 0);
        const maxPt = new CadModule.OdGePoint3d(14900, 10700, 0);
        view.zoomExtents(minPt, maxPt);
        minPt.delete?.();
        maxPt.delete?.();
      }
      inWeb.AppCore.Update();
      inWeb.renderNow?.();
      return true;
    })()
  `).catch(() => false);
  if (!built) throw new Error('Không thể tạo bản vẽ mẫu trong VinaCAD.');
  await wait(800);
  return SAMPLE_CONTEXT.drawingName;
}

async function loadDrawingFile(win, filePath) {
  if (!fsSync.existsSync(filePath)) throw new Error(`Không tìm thấy bản vẽ đã chọn: ${filePath}`);
  const fileName = path.basename(filePath);
  const buffer = await fs.readFile(filePath);
  await win.webContents.executeJavaScript(`
    (async () => {
      const b64 = ${JSON.stringify(buffer.toString('base64'))};
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], ${JSON.stringify(fileName)}, { type: 'application/octet-stream' }));
      window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise((r) => setTimeout(r, 350));
      const confirmBtn = Array.from(document.querySelectorAll('[role="dialog"] button'))
        .find((b) => /tiếp tục|không lưu|discard|continue|mở|open|đồng ý/i.test(b.innerText || ''));
      if (confirmBtn) confirmBtn.click();
      return true;
    })()
  `);
  await wait(1000);
  const maxWait = buffer.byteLength > 1024 * 1024 ? 60000 : 30000;
  const started = Date.now();
  while (Date.now() - started < maxWait) {
    const busy = await win.webContents.executeJavaScript(`
      (() => {
        const s = window.store && window.store.getState ? window.store.getState() : null;
        return Boolean(!s || !s.loadingDrawing || s.loadingDrawing.isLoading || !s.ui?.isLoadedFont);
      })()
    `).catch(() => true);
    if (!busy) {
      await wait(900);
      return fileName;
    }
    await wait(500);
  }
  throw new Error(`VinaCAD chưa nạp xong bản vẽ ${fileName} sau ${Math.round(maxWait / 1000)} giây.`);
}

// VinaCAD does not always frame a freshly opened DWG (see the E2E report), so fit it before recording.
async function zoomExtents(win) {
  await win.webContents.executeJavaScript(`(() => {
    const app = window.__inWeb;
    try { app.editorInput.zoomExtents(); } catch (e) { try { app.AppCore.ZoomExtents(); } catch (err) {} }
    try { app.AppCore.Update(); app.renderNow?.(); } catch (e) {}
    return true;
  })()`).catch(() => {});
  await wait(700);
}

async function loadDrawing(win, drawingPath) {
  if (isSamplePath(drawingPath)) return buildSampleDrawing(win);
  const name = await loadDrawingFile(win, drawingPath);
  await zoomExtents(win);
  return name;
}

module.exports = {
  VINACAD_URL,
  SAMPLE_ID,
  SAMPLE_CONTEXT,
  isSamplePath,
  waitForEditorReady,
  buildSampleDrawing,
  loadDrawingFile,
  loadDrawing,
  zoomExtents,
};
