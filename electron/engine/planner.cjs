// Turns a marketing brief into a validated, executable shot plan for the VinaCAD recorder.
const { setTimeout: retryDelay } = require('node:timers/promises');

// Commands verified to run in VinaCAD Web (see VinaCAD-E2E-Bug-Report.md). Anything else is rejected.
const SUPPORTED_COMMANDS = new Set([
  'LINE', 'PLINE', 'RECTANG', 'RECTANGLE', 'CIRCLE', 'MTEXT',
  'MOVE', 'COPY', 'ROTATE', 'ERASE', 'OFFSET',
]);
const UNSUPPORTED_HINT = 'RAY, BHATCH, GRADIENT, DONUT, WIPEOUT, LEADER, DIMANGULAR, DIMRADIUS, DIMDIAMETER, TABLE, '
  + 'ARRAYRECT, ARRAYPOLAR, DELETE, LENGTHEN, ID, LIST, OVERKILL, UNDO';

const PANELS = ['Prop', 'Layers', 'Blocks', 'XREF', 'Traces', 'Activity'];
const FOCUS = ['auto', 'full', 'left', 'center', 'right'];
const MODES = ['OSNAP', 'ORTHO', 'POLAR', 'GRID', 'OTRACK'];
const KEYS = ['Enter', 'Escape'];

// Shared schema passed to providers that support structured JSON. The loose parser remains the
// compatibility path for proxies and older models that reject a schema parameter.
const PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string' },
          caption: { type: 'string' },
          description: { type: 'string' },
          focus: { type: 'string', enum: FOCUS },
          hold: { type: 'number' },
          steps: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['label', 'caption', 'focus', 'hold', 'steps'],
      },
    },
  },
  required: ['title', 'scenes'],
};

const ACTION_DOCS = [
  '{ "type": "open_panel", "panel": "Layers" }  // panel ∈ Prop | Layers | Blocks | XREF | Traces | Activity',
  '{ "type": "select_layer", "layer": "A-WALLS" }  // click dòng layer: chọn VÀ đặt làm layer hiện hành, hiện Thuộc tính lớp',
  '{ "type": "rename_layer", "layer": "A-WALLS", "to": "A-WALLS-MAIN" }  // double-click tên; layer đó cũng trở thành layer hiện hành',
  '{ "type": "set_layer_color", "layer": "A-WALLS-MAIN", "color": "#FFB347" }  // đổi màu qua bảng chọn màu, bản vẽ đổi màu thật',
  '{ "type": "toggle_layer", "layer": "A-FURNITURE", "property": "visible" }  // visible = tắt/bật hiển thị (đóng băng), không áp dụng cho layer hiện hành; locked = khoá/mở khoá',
  '{ "type": "create_layer", "name": "A-NEW" }  // tạo layer mới bằng nút + và đặt tên (name tuỳ chọn)',
  '{ "type": "delete_layer", "layer": "TEMP-EMPTY" }  // chỉ layer trống (không chứa đối tượng), không phải layer 0',
  '{ "type": "command", "name": "RECTANG", "inputs": [ { "point": [1500, 5600], "hover": 1.0 }, { "point": [3300, 7300], "hover": 1.0 } ] }  // trọn vẹn trong 1 bước command gồm 2 góc đối diện; KHÔNG thêm key Enter',
    '   // inputs: { "point": [x, y] } = click đúng toạ độ bản vẽ (có bắt điểm thật);',
  '   //         { "value": "500" } = gõ giá trị/lựa chọn rồi Enter; { "key": "Enter" | "Escape" }',
  '{ "type": "command", "name": "CIRCLE", "inputs": [ { "point": [9300, 2350] }, { "value": "350" } ] }  // tâm và bán kính; value tự nhấn Enter kết thúc lệnh, KHÔNG thêm key Enter',
  '{ "type": "command", "name": "MOVE", "inputs": [ { "point": [4500, 0] }, { "point": [4700, 200] } ] }  // sau action select, không Enter đầu vào và không thêm key Enter cuối',
  '{ "type": "command", "name": "COPY", "inputs": [ { "point": [4500, 0] }, { "point": [5200, 300] }, { "key": "Enter" } ] }  // kết thúc COPY bằng Enter',
  '{ "type": "command", "name": "ROTATE", "inputs": [ { "point": [4500, 0] }, { "value": "45" } ] }  // góc xoay nhập bằng bàn phím; tự kết thúc sau value, KHÔNG thêm key Enter',
  '{ "type": "command", "name": "OFFSET", "inputs": [ { "value": "200" }, { "point": [2100, 200] }, { "point": [2100, 500] }, { "key": "Escape" } ] }  // trọn vẹn 1 bước gồm khoảng cách, điểm giữa đoạn Line nguồn, phía offset, Escape',
  '{ "type": "hover", "point": [9000, 0], "seconds": 1.2 }  // rê chuột tới điểm để hiện marker bắt điểm (Osnap) trong lúc lệnh đang chờ điểm',
  '{ "type": "select", "points": [[1200, 5400]] }  // click chọn đối tượng tại các điểm (khi không có lệnh)',
  '{ "type": "select", "window": [[800, 500], [3600, 1600]] }  // kéo khung trái→phải để chọn trọn một vật thể (mảng 2 điểm số [[x1, y1], [x2, y2]], không bọc chuỗi)',
  '{ "type": "zoom_extents" }  // bấm nút Thu phóng toàn cảnh',
  '{ "type": "zoom_to", "min": [6500, 2800], "max": [9500, 4500] }  // lăn chuột phóng to đúng vùng bản vẽ (hệ thống cũng tự phóng to khi hình cần vẽ quá nhỏ)',
  '{ "type": "toggle_mode", "mode": "OSNAP", "on": true }  // mode ∈ OSNAP | ORTHO | POLAR | GRID | OTRACK; on bắt buộc',
  '{ "type": "click", "text": "Thuộc tính" }  // chỉ dùng cho nhãn giao diện công cụ (vd Thuộc tính); CẤM dùng click cho lệnh CAD, nhóm ribbon Vẽ/Chỉnh sửa, hoặc nút tệp/tài khoản (Lưu, Mở, Xuất, Chia sẻ, Đăng nhập, In...)',
  '{ "type": "pause", "seconds": 1.5 }  // giữ khung hình để người xem đọc',
  '{ "type": "escape" }  // huỷ lệnh đang chạy',
];

function buildSystemPrompt() {
  return [
    'Bạn là đạo diễn video marketing kiêm người thao tác CAD cho VinaCAD Web (giao diện tiếng Việt, khung 1920x1080).',
    'Nhiệm vụ: biến BRIEF của người dùng thành kịch bản quay gồm các phân cảnh, mỗi phân cảnh có phụ đề tiếng Việt và các bước thao tác THẬT trên VinaCAD.',
    'Trả về DUY NHẤT một JSON hợp lệ (không markdown, không giải thích) theo schema:',
    '{ "title": "tên video", "scenes": [ { "label": "tên cảnh ≤ 40 ký tự", "caption": "phụ đề tiếng Việt ≤ 90 ký tự",',
    '  "focus": "auto", "hold": 1.5, "steps": [ ...action ] } ] }',
    'Danh mục action được phép (không được bịa action khác):',
    ...ACTION_DOCS,
    'Quy tắc bắt buộc:',
    '- 3 đến 6 cảnh, mỗi cảnh 1–10 bước, tổng thời lượng mục tiêu bám theo brief (mặc định 30–40 giây).',
    '- Làm ĐÚNG những gì brief yêu cầu, theo đúng thứ tự; không thêm thao tác thừa không phục vụ thông điệp.',
    '- Phụ đề mô tả đúng điều đang diễn ra trên màn hình ở cảnh đó; không hứa hẹn điều không quay.',
    '- Chỉ dùng tên layer có trong UI_STATE.layers (hoặc tên mới đã tạo/đổi ở bước trước).',
    '- Khi kịch bản có lệnh tạo hình mới (LINE, PLINE, RECTANG, CIRCLE, MTEXT) mà không yêu cầu chọn layer cụ thể trước đó, hệ thống sẽ tự đặt layer nổi bật VINACUT-DEMO (màu cam #FFB347) làm layer hiện hành để nét mới tương phản rõ với đường trắng có sẵn.',
    '- MỌI HÌNH MỚI TẠO (LINE, PLINE, RECTANG, CIRCLE, MTEXT, OFFSET) BẮT BUỘC ĐẶT TRONG VÙNG TRỐNG (ưu tiên OPEN_AREAS ở giữa các phòng), TUYỆT ĐỐI KHÔNG vẽ đè dọc theo đoạn tường/đường có sẵn. Ví dụ với PLINE hoặc RECTANG trong phòng khách, hãy dùng các điểm trong OPEN_AREAS (như suggestedPolyline [[3800, 2600], [6300, 2600], [6300, 3800]] hoặc suggestedRect [[3800, 2500], [6400, 3900]]), KHÔNG nối các góc tường bao [200,200]–[6900,200]–[6900,3200].',
    '- Với OFFSET khoảng cách 200 trên bản vẽ mẫu: hãy chọn đoạn tường trong tại [2100, 200] và điểm phía offset vào lòng phòng tại [2100, 500] (để nét mới tạo tại y=400 trong vùng trống); TUYỆT ĐỐI KHÔNG offset tường ngoài y=0 vào trong 200 vì sẽ trùng khít lên tường trong y=200.',
    '- Toạ độ "point" là toạ độ bản vẽ (đơn vị bản vẽ), phải nằm trong DRAWING.extents; ưu tiên dùng OPEN_AREAS cho hình vẽ mới và KEY_POINTS khi cần bắt điểm.',
    '- MỖI LỆNH CAD PHẢI HOÀN TẤT TRỌN VẸN TRONG DUY NHẤT 1 BƯỚC command (TUYỆT ĐỐI KHÔNG tách 1 lệnh ra 2 cảnh hoặc 2 bước command như gọi lệnh rỗng/nhập khoảng cách ở cảnh trước rồi mới nhập điểm ở cảnh sau).',
    '- Lệnh vẽ/sửa được phép chỉ gồm LINE, PLINE, RECTANG, CIRCLE, MTEXT, MOVE, COPY, ROTATE, ERASE và OFFSET. Quy tắc kết thúc lệnh: LINE và PLINE bắt buộc kết thúc bằng { "key": "Enter" }; COPY kết thúc bằng { "key": "Enter" } sau điểm đích; OFFSET gồm đủ [value, point nguồn, point phía offset, { "key": "Escape" }]; RECTANG và MOVE tự kết thúc ngay sau điểm thứ 2 (KHÔNG thêm key Enter ở cuối); CIRCLE và ROTATE tự kết thúc ngay sau input { "value": "..." } (KHÔNG thêm key Enter ở cuối); ERASE tự kết thúc sau khi gọi (khi đã select trước).',
    '- KHÔNG dùng action "click" cho tên lệnh CAD (LINE, RECTANG, CIRCLE...) hoặc tiêu đề nhóm ribbon ("Vẽ", "Chỉnh sửa", "Chú thích"); action "command" đã tự động bấm nút công cụ trên thanh ribbon.',
    '- CẤM dùng action "click" vào các nút tệp/tài khoản/hệ thống: Lưu, Save, Mở, Open, Xuất, Export, Chia sẻ, Share, Đăng nhập, Login, Sign in, Tải xuống, Download, In, Print, Mới, New.',
    '- Mỗi lệnh MOVE, COPY, ROTATE, ERASE đều tiêu thụ và xoá vùng chọn sau khi chạy xong. Do đó: (1) BẮT BUỘC có một bước { "type": "select", ... } ngay trước MỖI lệnh MOVE, COPY, ROTATE, ERASE (không đặt toggle_mode hay open_panel xen giữa select và lệnh); (2) Nếu thực hiện MOVE một vật thể rồi tiếp tục COPY/MOVE/ROTATE chính vật thể đó ở bước/cảnh sau, BẮT BUỘC thêm bước { "type": "select" } mới với toạ độ/window ĐÃ DỊCH CHUYỂN theo vector vừa MOVE (ví dụ sofa [[800, 500], [3600, 1600]] sau khi MOVE lên [0, 200] thì bước select trước COPY phải dùng window [[800, 700], [3600, 1800]] và điểm gốc trong vùng mới).',
    '- Chỉ dùng MTEXT (không dùng TEXT): click điểm bắt đầu, click điểm đối diện để mở trình soạn thảo thật, gõ nội dung qua input value; luôn truyền trường "height" dương (ví dụ 180 trên bản vẽ mẫu) và hệ thống bấm Apply text để commit, không gửi Enter để đóng editor.',
    '- OFFSET hiện chỉ kiểm chứng với đường Line, không dùng trên cung, circle hay polyline. Khi chọn điểm trên đoạn tường cho OFFSET, hãy chọn điểm nằm giữa đoạn tường (ví dụ [2100, 200]), tránh chọn đúng đỉnh góc giao của 2 bức tường.',
    '- Nếu brief cần MOVE/COPY đúng khoảng dịch trong vùng trống và không yêu cầu bắt điểm, có thể dùng toggle_mode OSNAP on:false TRƯỚC bước select và lệnh, ghi rõ phụ đề tắt bắt điểm để nhập chính xác. Không âm thầm đổi trạng thái trái với brief.',
    '- Muốn khoe bắt điểm (Osnap): thêm trường "hover" (giây) vào input point của command, ví dụ',
    '  { "type": "command", "name": "LINE", "inputs": [ { "point": [0, 0], "hover": 1.0 }, { "point": [9000, 0], "hover": 1.0 }, { "key": "Enter" } ] }',
    '  — chuột sẽ dừng ở điểm đó cho thấy marker bắt điểm rồi mới click. Action "hover" riêng chỉ dùng khi không cần click.',
    `- KHÔNG dùng các lệnh chưa được VinaCAD hỗ trợ: ${UNSUPPORTED_HINT}.`,
    '- delete_layer chỉ áp dụng cho layer trống; nếu đó là layer hiện hành, hệ thống sẽ tự chuyển sang layer 0 trước khi xoá.',
    '- focus: "auto" để camera tự lấy khung đúng vùng thao tác (khuyến nghị); "full" cho cảnh toàn cảnh mở đầu/kết thúc.',
    '- hold: số giây giữ khung cuối cảnh cho người xem đọc phụ đề (1–3).',
  ].join('\n');
}

function parseJsonLoose(text) {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI không trả về JSON.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function parsePoint(p) {
  if (typeof p === 'string') {
    const match = p.trim().match(/^\[?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]?$/);
    if (match) return [Number(match[1]), Number(match[2])];
  }
  if (Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))) {
    return [Number(p[0]), Number(p[1])];
  }
  return null;
}

const isPoint = (p) => parsePoint(p) !== null;
const toPoint = (p) => parsePoint(p);

function withinExtents(point, extents) {
  if (!extents) return true;
  const { min, max } = extents;
  const mx = (max[0] - min[0]) * 0.25 + 1;
  const my = (max[1] - min[1]) * 0.25 + 1;
  return point[0] >= min[0] - mx && point[0] <= max[0] + mx && point[1] >= min[1] - my && point[1] <= max[1] + my;
}

// Normalises the plan and reports every problem, simulating layer changes step by step.
function validatePlan(raw, context = {}) {
  const errors = [];
  const repairs = [];
  const layers = new Map((context.layers || []).map((l) => [String(l.name).toLowerCase(), { ...l }]));
  const extents = context.extents || null;
  const scenesIn = Array.isArray(raw?.scenes) ? raw.scenes : [];
  if (!scenesIn.length) errors.push('Kịch bản không có cảnh nào.');
  if (scenesIn.length > 7) errors.push('Tối đa 7 cảnh.');
  let currentLayer = String(context.currentLayer || '0').toLowerCase();

  const scenes = scenesIn.slice(0, 7).map((scene, si) => {
    const where = `Cảnh ${si + 1}`;
    const stepsIn = Array.isArray(scene?.steps) ? scene.steps : [];
    if (stepsIn.length > 12) errors.push(`${where}: tối đa 12 bước.`);
    const steps = [];
    stepsIn.slice(0, 12).forEach((step, ki) => {
      const at = `${where}, bước ${ki + 1}`;
      const type = String(step?.type || '').toLowerCase();
      const layerRef = (name) => {
        const key = String(name || '').toLowerCase();
        if (!key) {
          errors.push(`${at}: thiếu tên layer.`);
          return null;
        }
        if (!layers.has(key)) {
          errors.push(`${at}: layer "${name}" không tồn tại (hiện có: ${Array.from(layers.values()).map((l) => l.name).join(', ')}).`);
          return null;
        }
        return layers.get(key);
      };
      switch (type) {
        case 'open_panel': {
          const panel = PANELS.find((p) => p.toLowerCase() === String(step.panel || step.target || '').toLowerCase());
          if (!panel) errors.push(`${at}: panel không hợp lệ.`);
          else steps.push({ type, panel });
          break;
        }
        case 'select_layer':
        case 'set_current_layer': {
          const layer = layerRef(step.layer);
          if (layer) {
            steps.push({ type, layer: layer.name });
            // Both variants click the layer row and make it current in VinaCAD.
            if (type === 'select_layer' || type === 'set_current_layer') currentLayer = layer.name.toLowerCase();
          }
          break;
        }
        case 'rename_layer': {
          const layer = layerRef(step.layer);
          const to = String(step.to || step.newName || '').trim();
          if (!to || !/^[A-Za-z0-9_\-$ ]{1,50}$/.test(to)) errors.push(`${at}: tên mới "${to}" không hợp lệ (chỉ chữ không dấu, số, - _).`);
          else if (layers.has(to.toLowerCase())) errors.push(`${at}: layer "${to}" đã tồn tại.`);
          else if (layer) {
            layers.delete(layer.name.toLowerCase());
            layers.set(to.toLowerCase(), { ...layer, name: to });
            // The double-click that opens the rename box also makes the layer current.
            currentLayer = to.toLowerCase();
            steps.push({ type, layer: layer.name, to });
          }
          break;
        }
        case 'set_layer_color':
        case 'color_layer': {
          const layer = layerRef(step.layer);
          const color = String(step.color || step.hex || '').trim();
          if (!/^#?[0-9a-fA-F]{6}$/.test(color)) errors.push(`${at}: màu "${color}" phải dạng #RRGGBB.`);
          else if (layer && layer.colorEffect && layer.colorEffect.canChangeVisible === false) {
            errors.push(`${at}: layer "${layer.name}" không có bằng chứng nét trên canvas đổi theo màu layer (${layer.colorEffect.basis || 'chưa xác minh'}). Hãy chọn layer có colorEffect.canChangeVisible=true hoặc đổi cảnh.`);
          } else if (layer) {
            if (type === 'color_layer') {
              repairs.push({ kind: 'alias_action', scene: si + 1, step: ki + 1, before: 'color_layer', after: 'set_layer_color', reason: 'Chuẩn hoá tên action đồng nghĩa' });
            }
            steps.push({ type: 'set_layer_color', layer: layer.name, color: `#${color.replace('#', '').toUpperCase()}` });
          }
          break;
        }
        case 'toggle_layer': {
          const layer = layerRef(step.layer);
          const property = String(step.property || 'visible').toLowerCase();
          if (!['visible', 'locked'].includes(property)) errors.push(`${at}: property phải là visible hoặc locked.`);
          else if (layer && property === 'visible' && layer.name.toLowerCase() === currentLayer) {
            errors.push(`${at}: không thể tắt hiển thị layer hiện hành "${layer.name}"; hãy chọn layer khác trước.`);
          } else if (layer) steps.push({ type, layer: layer.name, property });
          break;
        }
        case 'create_layer': {
          const name = String(step.name || '').trim();
          if (name && !/^[A-Za-z0-9_\-$ ]{1,50}$/.test(name)) errors.push(`${at}: tên layer mới "${name}" không hợp lệ.`);
          else if (name && layers.has(name.toLowerCase())) errors.push(`${at}: layer "${name}" đã tồn tại.`);
          else {
            if (name) layers.set(name.toLowerCase(), { name, entityCount: 0 });
            steps.push(name ? { type, name } : { type });
          }
          break;
        }
        case 'delete_layer': {
          const layer = layerRef(step.layer);
          if (layer) {
            const key = layer.name.toLowerCase();
            if (key === '0') errors.push(`${at}: không thể xoá layer 0.`);
            else if (layer.entityCount > 0) errors.push(`${at}: layer "${layer.name}" đang chứa đối tượng, chỉ xoá được layer trống.`);
            else {
              // The recorder switches to layer 0 first when the target is current.
              if (currentLayer === key) currentLayer = '0';
              layers.delete(key);
              steps.push({ type, layer: layer.name });
            }
          }
          break;
        }
        case 'command': {
          const rawName = String(step.name || step.command || '').trim().toUpperCase();
          if (!SUPPORTED_COMMANDS.has(rawName)) {
            errors.push(`${at}: lệnh "${rawName}" không nằm trong danh sách VinaCAD hỗ trợ.`);
            break;
          }
          const name = rawName === 'RECTANGLE' ? 'RECTANG' : rawName;
          if (rawName === 'RECTANGLE') {
            repairs.push({ kind: 'alias_command', scene: si + 1, step: ki + 1, before: 'RECTANGLE', after: 'RECTANG', reason: 'Chuẩn hoá tên lệnh đồng nghĩa' });
          }
          const inputs = [];
          for (const input of Array.isArray(step.inputs) ? step.inputs : []) {
            let rawInputWindow = input && (input.window || input.selectionWindow);
            if (typeof rawInputWindow === 'string') {
              try { rawInputWindow = JSON.parse(rawInputWindow); } catch {}
            }
            if (input && isPoint(input.point)) {
              const point = toPoint(input.point);
              if (!withinExtents(point, extents)) errors.push(`${at}: điểm [${point}] nằm ngoài bản vẽ.`);
              inputs.push({ point, hover: Math.min(3, Math.max(0, Number(input.hover) || 0)) });
            } else if (Array.isArray(rawInputWindow) && rawInputWindow.length === 2 && rawInputWindow.every(isPoint)) {
              const window = rawInputWindow.map(toPoint);
              window.forEach((point) => { if (!withinExtents(point, extents)) errors.push(`${at}: window point [${point}] nằm ngoài bản vẽ.`); });
              inputs.push({ window });
            } else if (input && input.value !== undefined && String(input.value).trim()) {
              const value = String(input.value).trim();
              if (value.length > 120) errors.push(`${at}: value dài ${value.length} ký tự; tối đa 120.`);
              else inputs.push({ value });
            } else if (input && KEYS.includes(input.key)) {
              inputs.push({ key: input.key });
            } else {
              errors.push(`${at}: input không hợp lệ ${JSON.stringify(input)}.`);
            }
          }
          const pointInputs = inputs.filter((input) => input.point);
          const valueInputs = inputs.filter((input) => input.value !== undefined);
          const lastKey = inputs[inputs.length - 1]?.key;
          if (name === 'MTEXT') {
            if (pointInputs.length !== 2) errors.push(`${at}: MTEXT cần đúng 2 input point (2 góc khung chữ) trước input value.`);
            if (valueInputs.length !== 1) errors.push(`${at}: MTEXT cần đúng một input value là nội dung.`);
            if (inputs.some((input) => input.key === 'Enter')) errors.push(`${at}: MTEXT được commit bằng Apply text, không dùng key Enter.`);
            const height = step.height === undefined ? null : Number(step.height);
            if (height !== null && (!Number.isFinite(height) || height <= 0)) errors.push(`${at}: height MTEXT phải là số dương.`);
            const shortEdge = extents ? Math.max(1, Math.min(Math.abs(extents.max[0] - extents.min[0]), Math.abs(extents.max[1] - extents.min[1]))) : 100;
            const resolvedHeight = height === null ? Math.max(1, Math.round(shortEdge * 0.025 * 100) / 100) : height;
            if (height === null) {
              repairs.push({ kind: 'default_mtext_height', scene: si + 1, step: ki + 1, before: null, after: resolvedHeight, reason: 'Gán chiều cao chữ mặc định theo tỷ lệ bản vẽ khi thiếu trường height' });
            }
            steps.push({ type, name, inputs, height: resolvedHeight });
          } else {
            const noLeadingEnter = new Set(['MOVE', 'ROTATE', 'SCALE', 'MIRROR', 'TRIM', 'EXTEND', 'FILLET', 'CHAMFER', 'STRETCH', 'ERASE', 'JOIN', 'EXPLODE', 'BREAK', 'MATCHPROP']);
            if (noLeadingEnter.has(name) && inputs[0]?.key === 'Enter') errors.push(`${at}: ${name} bắt đầu bằng base/giá trị sau select, không chèn Enter đầu vào.`);
            const noTrailingEnter = new Set(['CIRCLE', 'RECTANG', 'RECTANGLE', 'MOVE', 'ROTATE']);
            if (noTrailingEnter.has(name) && lastKey === 'Enter') {
              errors.push(`${at}: ${name} tự kết thúc sau khi nhập điểm/giá trị cuối, không thêm key Enter ở cuối.`);
            }
            if ((name === 'LINE' || name === 'PLINE') && (pointInputs.length < 2 || lastKey !== 'Enter')) {
              errors.push(`${at}: ${name} phải hoàn tất trọn vẹn trong 1 bước command với ít nhất 2 input point và kết thúc bằng { "key": "Enter" } (không tách lệnh ra nhiều cảnh).`);
            } else if ((name === 'RECTANG' || name === 'RECTANGLE') && (pointInputs.length !== 2 || valueInputs.length > 0)) {
              errors.push(`${at}: ${name} phải hoàn tất trọn vẹn trong 1 bước command với đúng 2 input point (2 góc đối diện, có thể kèm "hover"), không tách lệnh ra nhiều cảnh.`);
            } else if (name === 'CIRCLE' && (pointInputs.length !== 1 || valueInputs.length !== 1)) {
              errors.push(`${at}: CIRCLE phải hoàn tất trọn vẹn trong 1 bước command với 1 input point (tâm) và 1 input value (bán kính).`);
            } else if (name === 'MOVE' && pointInputs.length !== 2) {
              errors.push(`${at}: MOVE phải hoàn tất trọn vẹn trong 1 bước command (sau bước select) với đúng 2 input point [điểm gốc, điểm đích].`);
            } else if (name === 'COPY' && (pointInputs.length < 2 || lastKey !== 'Enter')) {
              errors.push(`${at}: COPY phải hoàn tất trọn vẹn trong 1 bước command (sau bước select) với ít nhất 2 input point [điểm gốc, điểm đích] và kết thúc bằng { "key": "Enter" }.`);
            } else if (name === 'ROTATE' && (pointInputs.length !== 1 || valueInputs.length !== 1)) {
              errors.push(`${at}: ROTATE phải hoàn tất trọn vẹn trong 1 bước command (sau bước select) với 1 input point (tâm xoay) và 1 input value (góc xoay).`);
            } else if (name === 'OFFSET' && (valueInputs.length !== 1 || pointInputs.length !== 2 || lastKey !== 'Escape')) {
              errors.push(`${at}: OFFSET phải hoàn tất trọn vẹn trong 1 bước command gồm đủ 4 inputs: [{ "value": "khoảng_cách" }, { "point": [x_tường, y_tường] }, { "point": [x_phía_offset, y_phía_offset] }, { "key": "Escape" }] (không tách lệnh ra nhiều cảnh).`);
            }
            steps.push({ type, name, inputs });
          }
          break;
        }
        case 'hover': {
          if (!isPoint(step.point)) errors.push(`${at}: hover cần "point".`);
          else steps.push({ type, point: toPoint(step.point), seconds: Math.min(3, Math.max(0.3, Number(step.seconds) || 1)) });
          break;
        }
        case 'select': {
          let parsedPoints = step.points;
          if (typeof parsedPoints === 'string') {
            try { parsedPoints = JSON.parse(parsedPoints); } catch {}
          }
          const rawPoints = Array.isArray(parsedPoints)
            ? (Array.isArray(parsedPoints[0]) || typeof parsedPoints[0] === 'string' ? parsedPoints : (isPoint(parsedPoints) ? [parsedPoints] : []))
            : (isPoint(step.point) ? [step.point] : []);
          const points = rawPoints.filter(isPoint).map(toPoint);
          let rawWindow = step.window || step.selectionWindow
            || (isPoint(step.min) && isPoint(step.max) ? [step.min, step.max] : null)
            || (isPoint(step.window?.min) && isPoint(step.window?.max) ? [step.window.min, step.window.max] : null);
          if (typeof rawWindow === 'string') {
            try { rawWindow = JSON.parse(rawWindow); } catch {}
          }
          if (Array.isArray(rawWindow) && rawWindow.length === 4 && rawWindow.every((v) => Number.isFinite(Number(v)))) {
            rawWindow = [[rawWindow[0], rawWindow[1]], [rawWindow[2], rawWindow[3]]];
          }
          const windowPoints = (Array.isArray(rawWindow) ? rawWindow : []).filter(isPoint).map(toPoint);
          if (windowPoints.length === 2) {
            windowPoints.forEach((point) => { if (!withinExtents(point, extents)) errors.push(`${at}: window point [${point}] nằm ngoài bản vẽ.`); });
            steps.push({ type, window: windowPoints });
          }
          else if (points.length) steps.push({ type, points });
          else errors.push(`${at}: select cần "points": [[x, y]] hoặc "window": [[x1, y1], [x2, y2]] (nhận được: ${JSON.stringify(step)}).`);
          break;
        }
        case 'zoom_extents':
        case 'escape':
          steps.push({ type });
          break;
        case 'zoom_to': {
          if (!isPoint(step.min) || !isPoint(step.max)) {
            errors.push(`${at}: zoom_to cần "min" và "max".`);
            break;
          }
          const min = toPoint(step.min);
          const max = toPoint(step.max);
          if (max[0] <= min[0] || max[1] <= min[1]) errors.push(`${at}: zoom_to cần min < max.`);
          else if (!withinExtents(min, extents) || !withinExtents(max, extents)) errors.push(`${at}: vùng zoom_to nằm ngoài bản vẽ.`);
          else steps.push({ type, min, max });
          break;
        }
        case 'toggle_mode': {
          const mode = String(step.mode || step.item || '').toUpperCase();
          if (!MODES.includes(mode)) errors.push(`${at}: mode không hợp lệ.`);
          else if (typeof step.on !== 'boolean') errors.push(`${at}: toggle_mode cần on:true hoặc on:false.`);
          else steps.push({ type, mode, on: step.on });
          break;
        }
        case 'click': {
          const text = String(step.text || '').trim();
          const forbiddenClick = SUPPORTED_COMMANDS.has(text.toUpperCase())
            || /^(vẽ|chỉnh sửa|chú thích|sửa|draw|modify|annotate|đường thẳng|đường nối|hình chữ nhật|hình tròn|đa văn bản|di chuyển|sao chép|xoay|xóa|xoá|sao chép song song)$/i.test(text);
          const forbiddenFileOrAccount = /^(lưu|save|lưu bản vẽ|mở|open|mở file|xuất|export|chia sẻ|share|đăng nhập|login|sign in|đăng xuất|logout|tải xuống|download|in|print|mới|new|tạo mới|đóng|close|xoá file|delete file)$/i.test(text)
            || /\b(lưu|save|export|xuất|chia sẻ|share|đăng nhập|login|sign in|download|tải xuống|print)\b/i.test(text);
          if (!text) errors.push(`${at}: click cần "text".`);
          else if (forbiddenClick) errors.push(`${at}: không dùng click cho "${text}"; hãy dùng trực tiếp action "command" (hệ thống tự bấm nút công cụ trên ribbon).`);
          else if (forbiddenFileOrAccount) errors.push(`${at}: cấm click vào nút tệp/tài khoản "${text}" (Lưu/Mở/Xuất/Chia sẻ/Đăng nhập...). Hãy bỏ bước click này khỏi kịch bản.`);
          else steps.push({ type, text: text.slice(0, 60) });
          break;
        }
        case 'pause':
        case 'wait':
          if (type === 'wait') {
            repairs.push({ kind: 'alias_action', scene: si + 1, step: ki + 1, before: 'wait', after: 'pause', reason: 'Chuẩn hoá tên action đồng nghĩa' });
          }
          steps.push({ type: 'pause', seconds: Math.min(4, Math.max(0.3, Number(step.seconds) || (Number(step.ms) || 1200) / 1000)) });
          break;
        default:
          errors.push(`${at}: action "${type}" không được hỗ trợ.`);
      }
    });
    const focus = FOCUS.includes(String(scene?.focus || '').toLowerCase()) ? String(scene.focus).toLowerCase() : 'auto';
    const caption = String(scene?.caption || scene?.description || '').trim();
    if (!caption) errors.push(`${where}: thiếu phụ đề.`);
    return {
      label: String(scene?.label || `Cảnh ${si + 1}`).trim().slice(0, 60),
      description: caption.slice(0, 140),
      focus,
      hold: Math.min(4, Math.max(0.8, Number(scene?.hold) || 1.6)),
      steps,
    };
  });
  let activeSelection = null;
  let lastMovedSelection = null;
  for (let si = 0; si < scenes.length; si++) {
    for (let ki = 0; ki < scenes[si].steps.length; ki++) {
      const step = scenes[si].steps[ki];
      const at = `Cảnh ${si + 1}, bước ${ki + 1}`;
      if (step.type === 'select') {
        if (step.window && lastMovedSelection?.originalWindow
          && JSON.stringify(step.window) === JSON.stringify(lastMovedSelection.originalWindow)) {
          errors.push(`${at}: vật thể đã được MOVE ở bước trước nên không còn nằm tại khung cũ ${JSON.stringify(lastMovedSelection.originalWindow)}; hãy dùng khung mới ${JSON.stringify(lastMovedSelection.movedWindow)} cho bước select này.`);
        }
        activeSelection = step;
      } else if (step.type === 'escape' || step.type === 'toggle_mode' || step.type === 'open_panel') {
        if (activeSelection) {
          const nextCmd = scenes[si].steps.slice(ki + 1).find((s) => s.type === 'command');
          if (nextCmd && ['MOVE', 'COPY', 'ROTATE', 'ERASE'].includes(nextCmd.name)) {
            errors.push(`${at}: bước "${step.type}" đặt sau "select" sẽ làm mất vùng chọn trước khi chạy lệnh ${nextCmd.name}; hãy đặt "${step.type}" trước bước "select".`);
          }
          activeSelection = null;
        }
      } else if (step.type === 'command') {
        const hasInlineWindow = (step.inputs || []).some((input) => input.window);
        if (['MOVE', 'COPY', 'ROTATE', 'ERASE'].includes(step.name) && !activeSelection && !hasInlineWindow) {
          const hint = lastMovedSelection?.movedWindow
            ? ` (lưu ý: vật thể vừa MOVE hiện ở khung mới ${JSON.stringify(lastMovedSelection.movedWindow)}, hãy thêm bước { "type": "select", "window": ${JSON.stringify(lastMovedSelection.movedWindow)} } ngay trước lệnh ${step.name})`
            : '';
          errors.push(`${at}: lệnh ${step.name} cần có bước { "type": "select" } ngay trước nó${hint}.`);
        }
        if (step.name === 'MOVE' && activeSelection) {
          const pts = (step.inputs || []).filter((input) => input.point).map((input) => input.point);
          if (pts.length >= 2) {
            const dx = pts[1][0] - pts[0][0];
            const dy = pts[1][1] - pts[0][1];
            if (activeSelection.window) {
              const movedWindow = activeSelection.window.map((p) => [p[0] + dx, p[1] + dy]);
              lastMovedSelection = {
                originalWindow: structuredClone(activeSelection.window),
                movedWindow,
              };
            }
          }
        }
        activeSelection = null;
      }
    }
  }
  return {
    plan: { title: String(raw?.title || '').trim().slice(0, 80), scenes },
    rawPlan: raw,
    repairs,
    errors,
  };
}

function contextBlock(context) {
  return [
    `UI_STATE: ${JSON.stringify({ activePanel: context.activePanel, currentLayer: context.currentLayer, layers: context.layers })}`,
    `DRAWING: ${JSON.stringify({ file: context.drawingName, plane: context.plane || 'XY', extents: context.extents, regions: context.regions })}`,
    context.plane && context.plane !== 'XY'
      ? `Lưu ý: bản vẽ đang ở góc nhìn mặt phẳng ${context.plane}; toạ độ "point" là [${context.plane[0]}, ${context.plane[1]}] trên mặt phẳng này.`
      : '',
    context.openAreas?.length ? `OPEN_AREAS (vùng sàn trống ưu tiên đặt hình tạo mới để không đè lên tường): ${JSON.stringify(context.openAreas)}` : '',
    context.keyPoints?.length ? `KEY_POINTS: ${JSON.stringify(context.keyPoints)}` : '',
    context.objects?.length ? `OBJECTS (hình học đã xác thực, cập nhật vị trí sau MOVE): ${JSON.stringify(context.objects)}` : '',
  ].filter(Boolean).join('\n');
}

async function planWithAi({ chat, prompt, knowledge, context, screenshotBase64, signal, onStatus }) {
  const system = buildSystemPrompt();
  const base = [
    `BRIEF CỦA NGƯỜI DÙNG:\n${String(prompt).slice(0, 6000)}`,
    contextBlock(context),
    knowledge ? `PLAYBOOK (kiến thức đã xác thực về giao diện VinaCAD):\n${String(knowledge).slice(0, 12000)}` : '',
  ].filter(Boolean).join('\n\n');
  let message = base;
  let lastErrors = [];
  const validationErrors = [];
  const requestErrors = [];
  const rawAttempts = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    onStatus?.(attempt === 0 ? 'AI đang lên kịch bản…' : `AI đang thử lại kịch bản (lượt ${attempt + 1}/3)…`);
    let text;
    try {
      text = await chat({ system, prompt: message, imageBase64: attempt === 0 ? screenshotBase64 : undefined, json: true, schema: PLAN_JSON_SCHEMA, signal });
    } catch (error) {
      requestErrors.push({ attempt: attempt + 1, status: error.status || null, message: error.message });
      if ([429, 502, 503, 504].includes(Number(error.status)) && attempt < 2 && !signal?.aborted) {
        onStatus?.(`Dịch vụ AI đang bận, thử lại sau ${(attempt + 1) * 2} giây…`);
        try {
          await retryDelay((attempt + 1) * 2000, undefined, { signal });
        } catch {
          error.message = 'Đã dừng tác vụ AI.';
          error.attempts = attempt + 1;
          error.validationErrors = validationErrors;
          error.requestErrors = requestErrors;
          error.rawAttempts = rawAttempts;
          throw error;
        }
        continue;
      }
      error.attempts = attempt + 1;
      error.validationErrors = validationErrors;
      error.requestErrors = requestErrors;
      error.rawAttempts = rawAttempts;
      throw error;
    }
    let raw;
    try {
      raw = parseJsonLoose(text);
    } catch (error) {
      lastErrors = [error.message];
      rawAttempts.push({ attempt: attempt + 1, rawText: String(text || '').slice(0, 4000), parseError: error.message });
      validationErrors.push({ attempt: attempt + 1, errors: lastErrors });
      message = `${base}\n\nLần trước bạn trả về nội dung không phải JSON hợp lệ. Hãy trả về đúng JSON theo schema.`;
      continue;
    }
    const { plan, repairs, errors } = validatePlan(raw, context);
    rawAttempts.push({ attempt: attempt + 1, rawPlan: raw, repairs, errors });
    if (!errors.length) return { plan, rawPlan: raw, rawAttempts, repairs, source: 'ai', attempts: attempt + 1, validationErrors, requestErrors };
    lastErrors = errors;
    validationErrors.push({ attempt: attempt + 1, errors, repairs });
    message = `${base}\n\nKịch bản trước của bạn:\n${JSON.stringify(raw)}\n\nCác lỗi cần sửa:\n- ${errors.slice(0, 20).join('\n- ')}\n\nHãy trả về JSON đã sửa hết lỗi.`;
  }
  const error = new Error(`AI chưa tạo được kịch bản hợp lệ: ${lastErrors.slice(0, 4).join(' ')}`);
  error.attempts = 3;
  error.validationErrors = validationErrors;
  error.requestErrors = requestErrors;
  error.rawAttempts = rawAttempts;
  throw error;
}

// Offline plans for the built-in sample drawing, used only when the brief clearly asks for them.
function presetPlan(prompt) {
  // "bản vẽ" (the drawing) must not count as the verb "vẽ" (to draw).
  const text = ` ${String(prompt || '').toLowerCase().replace(/bản vẽ/g, ' ')} `;
  const wantsLayer = /layer|lớp/.test(text);
  const wantsLockHide = wantsLayer && /khoá|khóa|lock|ẩn|tắt hiển thị|đóng băng|freeze/.test(text);
  const wantsEdit = wantsLayer && /đổi tên|đổi màu|màu|xoá|xóa|rename|colou?r|delete/.test(text);
  const wantsDraw = /osnap|bắt điểm|[\s,.:(]vẽ[\s,.:)]|rectang|hình chữ nhật|\bline\b|đường thẳng/.test(text);
  if (wantsLockHide && !wantsEdit && !wantsDraw) {
    return {
      title: 'Kiểm soát Layer: khoá & ẩn',
      scenes: [
        { label: 'Mở bảng Lớp', description: 'Mở bảng Lớp để kiểm soát các lớp của bản vẽ.', focus: 'auto', hold: 1.2,
          steps: [{ type: 'open_panel', panel: 'Layers' }] },
        { label: 'Khoá layer kích thước', description: 'Khoá layer A-DIMS để tránh sửa nhầm kích thước.', focus: 'auto', hold: 1.4,
          steps: [{ type: 'toggle_layer', layer: 'A-DIMS', property: 'locked' }] },
        { label: 'Ẩn layer nội thất', description: 'Tắt hiển thị nội thất chỉ với một click.', focus: 'auto', hold: 1.0,
          steps: [{ type: 'toggle_layer', layer: 'A-FURNITURE', property: 'visible' }] },
        { label: 'Mặt bằng gọn gàng', description: 'Mặt bằng gọn gàng hơn để tập trung vào tường và cửa.', focus: 'full', hold: 1.6,
          steps: [{ type: 'pause', seconds: 0.8 }] },
        { label: 'Hiện lại nội thất', description: 'Bật lại hiển thị bất cứ lúc nào.', focus: 'auto', hold: 1.6,
          steps: [{ type: 'toggle_layer', layer: 'A-FURNITURE', property: 'visible' }] },
      ],
    };
  }
  if (wantsEdit && !wantsDraw) {
    return {
      title: 'Quản lý Layer trên VinaCAD Web',
      scenes: [
        { label: 'Mở bảng Layer', description: 'Mở bảng Layer để xem và quản lý các lớp trong bản vẽ.', focus: 'auto', hold: 1.2,
          steps: [{ type: 'open_panel', panel: 'Layers' }] },
        { label: 'Đổi tên Layer', description: 'Chọn Layer và đổi tên ngay trong danh sách.', focus: 'auto', hold: 1.4,
          steps: [{ type: 'select_layer', layer: 'A-WALLS' }, { type: 'rename_layer', layer: 'A-WALLS', to: 'A-WALLS-MAIN' }] },
        { label: 'Đổi màu Layer', description: 'Đổi màu Layer, tường trên bản vẽ cập nhật ngay lập tức.', focus: 'auto', hold: 1.2,
          steps: [{ type: 'set_layer_color', layer: 'A-WALLS-MAIN', color: '#FFB347' }] },
        { label: 'Kiểm tra toàn cảnh', description: 'Kiểm tra các lớp bằng màu sắc trên toàn bộ mặt bằng.', focus: 'full', hold: 1.6,
          steps: [{ type: 'pause', seconds: 1.0 }] },
        { label: 'Dọn Layer trống', description: 'Xoá Layer trống khi không còn sử dụng.', focus: 'auto', hold: 1.6,
          steps: [{ type: 'delete_layer', layer: 'TEMP-EMPTY' }] },
      ],
    };
  }
  if (wantsDraw) {
    return {
      title: 'Vẽ nhanh với bắt điểm trên VinaCAD Web',
      scenes: [
        { label: 'Toàn cảnh bản vẽ', description: 'Mặt bằng kỹ thuật mở ngay trên trình duyệt với VinaCAD Web.', focus: 'full', hold: 1.4,
          steps: [{ type: 'pause', seconds: 0.8 }] },
        { label: 'Vẽ tủ bếp bằng RECTANG', description: 'Vẽ hình chữ nhật, bắt điểm góc tường chính xác tuyệt đối.', focus: 'auto', hold: 1.4,
          steps: [{ type: 'command', name: 'RECTANG', inputs: [{ point: [7100, 3800], hover: 1.0 }, { point: [8300, 3200] }] }] },
        { label: 'Vẽ đường bằng LINE', description: 'Bắt trung điểm và điểm cuối để vẽ đường thẳng nhanh, đúng kích thước.', focus: 'auto', hold: 1.4,
          steps: [{ type: 'command', name: 'LINE', inputs: [{ point: [200, 2300], hover: 0.9 }, { point: [6900, 2300], hover: 0.9 }, { key: 'Enter' }] }] },
        { label: 'Kết quả', description: 'Bản vẽ cập nhật tức thì, sẵn sàng chia sẻ cho cả nhóm.', focus: 'full', hold: 1.8,
          steps: [{ type: 'zoom_extents' }, { type: 'pause', seconds: 0.6 }] },
      ],
    };
  }
  return null;
}

module.exports = {
  SUPPORTED_COMMANDS,
  buildSystemPrompt,
  parseJsonLoose,
  PLAN_JSON_SCHEMA,
  validatePlan,
  planWithAi,
  presetPlan,
};
