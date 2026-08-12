// אשף 5 שלבים — state, ולידציה, שמירה אוטומטית, קריאות API אמיתיות.

const STEPS = ['לכידה', 'הפקה', 'סינתזה', 'ארגון', 'עתיד'];
const LS_KEY = 'klb-state-v1';

const state = load() || {
  step: 0,
  title: '',
  sources: [],            // ['youtube'...]
  url: '',
  transcript: null,       // {text, segments}
  model: 'claude-sonnet-4-6',
  summary: null,
  platform: '',
  leadMagnet: false,
  storage: '',
  savedPaths: null,
};

const $ = (s) => document.querySelector(s);
const wizard = $('#wizard');
const statusMsg = $('#status-msg');

// ---------- ולידציה: האם אפשר להתקדם משלב ----------
function stepComplete(i) {
  switch (i) {
    case 0: return state.sources.length > 0 && state.title.trim() !== '';
    case 1: return !!state.transcript;
    case 2: return !!state.summary;
    case 3: return state.platform !== '';
    case 4: return !!state.savedPaths;
    default: return false;
  }
}

// ---------- רנדור לפי שלב ----------
function render() {
  renderProgress();
  const i = state.step;
  if (i === 0) renderCapture();
  else if (i === 1) renderProduce();
  else if (i === 2) renderSynthesize();
  else if (i === 3) renderOrganize();
  else if (i === 4) renderFuture();
  $('#back').disabled = i === 0;
  $('#next').disabled = !stepComplete(i) || i === STEPS.length - 1;
  $('#next').textContent = i === STEPS.length - 1 ? 'הסתיים' : 'המשך';
  setStatus('');
}

function renderProgress() {
  const nav = $('#progress');
  nav.innerHTML = '';
  STEPS.forEach((label, i) => {
    const b = document.createElement('button');
    b.textContent = `0${i + 1} · ${label}`;
    if (i === state.step) b.classList.add('active');
    else if (stepComplete(i)) b.classList.add('done');
    // ניווט מותר רק לשלבים שכבר הושלמו או לשלב הנוכחי.
    b.disabled = i > state.step && !stepComplete(i - 1);
    b.onclick = () => { if (!b.disabled) { state.step = i; persist(); render(); } };
    nav.appendChild(b);
  });
}

// ---------- שלב 01 — לכידה ----------
function renderCapture() {
  const opts = [['youtube', 'YouTube'], ['pdf', 'PDF'], ['text', 'טקסט']];
  wizard.innerHTML = `<div class="card">
    <h2><span class="step-num">01</span>לכידה</h2>
    <p>בחרי סוג מקור (לפחות אחד) ותני כותרת.</p>
    <div class="chips">${opts.map(([v, l]) =>
      `<button class="chip ${state.sources.includes(v) ? 'sel' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <label>כותרת הפריט
      <input type="text" id="title" value="${esc(state.title)}" placeholder="למשל: תרמודינמיקה — הרצאה 3">
    </label>
  </div>`;
  wizard.querySelectorAll('.chip').forEach((c) => c.onclick = () => {
    const v = c.dataset.v;
    state.sources = state.sources.includes(v) ? state.sources.filter((x) => x !== v) : [...state.sources, v];
    persist(); render();
  });
  $('#title').oninput = (e) => { state.title = e.target.value; persist(); $('#next').disabled = !stepComplete(0); renderProgress(); };
}

// ---------- שלב 02 — הפקה (תמלול) ----------
function renderProduce() {
  wizard.innerHTML = `<div class="card">
    <h2><span class="step-num">02</span>הפקה</h2>
    <p>הדביקי קישור YouTube — נמשוך כתוביות, ובהיעדרן נשתמש ב-Whisper (בצד השרת).</p>
    <label>קישור YouTube
      <input type="url" id="url" value="${esc(state.url)}" placeholder="https://youtube.com/watch?v=...">
    </label>
    <button class="btn primary inline" id="do-transcribe">צור תמלול</button>
    ${state.transcript ? `<div class="output">${esc(state.transcript.text.slice(0, 1500))}${state.transcript.text.length > 1500 ? '…' : ''}</div>` : ''}
  </div>`;
  $('#url').oninput = (e) => { state.url = e.target.value; persist(); };
  $('#do-transcribe').onclick = doTranscribe;
}

async function doTranscribe() {
  if (!isYouTube(state.url)) return setStatus('קישור YouTube לא תקין', 'err');
  loading('#do-transcribe', 'מתמלל…');
  try {
    const r = await api('/api/transcribe', { url: state.url });
    state.transcript = { text: r.text, segments: r.segments || [] };
    persist(); render(); setStatus('תמלול הושלם', 'ok');
  } catch (e) { setStatus(e.message, 'err'); unloading('#do-transcribe', 'צור תמלול'); }
}

// ---------- שלב 03 — סינתזה ----------
function renderSynthesize() {
  const models = [['claude-sonnet-4-6', 'Claude'], ['gpt-4o', 'GPT-4o']];
  wizard.innerHTML = `<div class="card">
    <h2><span class="step-num">03</span>סינתזה</h2>
    <p>בחרי מודל וצרי כרטיס מדריך מובנה. המודל מסמן [INCOMPLETE] כשמידע חסר.</p>
    <div class="chips">${models.map(([v, l]) =>
      `<button class="chip ${state.model === v ? 'sel' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <button class="btn primary inline" id="do-syn">צור סיכום</button>
    ${state.summary ? `<div class="output">${esc(state.summary)}</div>` : ''}
  </div>`;
  wizard.querySelectorAll('.chip').forEach((c) => c.onclick = () => { state.model = c.dataset.v; persist(); render(); });
  $('#do-syn').onclick = doSynthesize;
}

async function doSynthesize() {
  loading('#do-syn', 'מסכם…');
  try {
    const r = await api('/api/synthesize', { transcript: state.transcript.text, title: state.title, model: state.model });
    state.summary = r.summary; state.model = r.model;
    persist(); render(); setStatus('סיכום מוכן', 'ok');
  } catch (e) { setStatus(e.message, 'err'); unloading('#do-syn', 'צור סיכום'); }
}

// ---------- שלב 04 — ארגון ----------
function renderOrganize() {
  const plats = [['html', 'דף HTML עצמאי'], ['drive', 'Google Drive'], ['notebooklm', 'NotebookLM']];
  wizard.innerHTML = `<div class="card">
    <h2><span class="step-num">04</span>ארגון</h2>
    <p>בחרי פלטפורמת יעד ותצוגה מקדימה חיה של דף השיעור.</p>
    <div class="chips">${plats.map(([v, l]) =>
      `<button class="chip ${state.platform === v ? 'sel' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="toggle"><input type="checkbox" id="lead" ${state.leadMagnet ? 'checked' : ''}><label for="lead" style="margin:0">מגנט לידים</label></div>
    <div class="output" id="preview"></div>
  </div>`;
  wizard.querySelectorAll('.chip').forEach((c) => c.onclick = () => { state.platform = c.dataset.v; persist(); render(); });
  $('#lead').onchange = (e) => { state.leadMagnet = e.target.checked; persist(); updatePreview(); };
  updatePreview();
}

function updatePreview() {
  const el = $('#preview'); if (!el) return;
  const lead = state.leadMagnet ? '\n\n--- מגנט לידים: השאירי פרטים לחבילת החזרה המלאה ---' : '';
  el.textContent = `# ${state.title}\n\n${(state.summary || '').slice(0, 800)}${lead}`;
}

// ---------- שלב 05 — עתיד ----------
function renderFuture() {
  if (state.savedPaths) return renderSuccess();
  const stores = [['local', 'מקומי (library/)'], ['drive', 'Drive דרך MCP']];
  wizard.innerHTML = `<div class="card">
    <h2><span class="step-num">05</span>עתיד</h2>
    <p>בחרי אחסון ושמרי לספרייה. לאחר מכן סוכן Claude יוכל לקרוא ולענות ממנה (דרך MCP).</p>
    <div class="chips">${stores.map(([v, l]) =>
      `<button class="chip ${state.storage === v ? 'sel' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <button class="btn primary inline" id="do-save" ${state.storage ? '' : 'disabled'}>שמור לספרייה</button>
  </div>`;
  wizard.querySelectorAll('.chip').forEach((c) => c.onclick = () => { state.storage = c.dataset.v; persist(); render(); });
  $('#do-save').onclick = doSave;
}

async function doSave() {
  loading('#do-save', 'שומר…');
  try {
    const r = await api('/api/save', {
      source: { id: null, type: state.sources[0], title: state.title },
      transcript: state.transcript, summary: state.summary, model: state.model,
      platform: state.platform, leadMagnet: state.leadMagnet,
    });
    state.savedPaths = r; persist(); render();
  } catch (e) { setStatus(e.message, 'err'); unloading('#do-save', 'שמור לספרייה'); }
}

function renderSuccess() {
  wizard.innerHTML = `<div class="card success">
    <div class="check">✓</div>
    <h2>נבנה פריט ספרייה!</h2>
    <p>"${esc(state.title)}" נשמר.</p>
    <p><a href="/${state.savedPaths.htmlPath}" target="_blank">צפייה בדף השיעור</a></p>
    <button class="btn ghost inline" id="restart">פריט חדש</button>
  </div>`;
  $('#restart').onclick = () => { localStorage.removeItem(LS_KEY); location.reload(); };
}

// ---------- ניווט ----------
$('#next').onclick = () => { if (stepComplete(state.step) && state.step < STEPS.length - 1) { state.step++; persist(); render(); } };
$('#back').onclick = () => { if (state.step > 0) { state.step--; persist(); render(); } };

// ---------- Tweaks ----------
$('#accent').oninput = (e) => { document.documentElement.style.setProperty('--accent', e.target.value); localStorage.setItem('klb-accent', e.target.value); };
$('#font').onchange = (e) => { document.documentElement.style.setProperty('--font-head', e.target.value); localStorage.setItem('klb-font', e.target.value); };
(function restoreTweaks() {
  const a = localStorage.getItem('klb-accent'); if (a) { $('#accent').value = a; document.documentElement.style.setProperty('--accent', a); }
  const f = localStorage.getItem('klb-font'); if (f) { $('#font').value = f; document.documentElement.style.setProperty('--font-head', f); }
})();

// ---------- עזרי שירות ----------
async function api(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאת שרת');
  return data;
}
function setStatus(msg, kind = '') { statusMsg.textContent = msg; statusMsg.className = 'status-msg ' + kind; }
function loading(sel, txt) { const b = $(sel); if (b) { b.disabled = true; b.innerHTML = `<span class="spinner"></span> ${txt}`; } }
function unloading(sel, txt) { const b = $(sel); if (b) { b.disabled = false; b.textContent = txt; } }
function persist() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function load() { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }
function isYouTube(u = '') { return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/.test(u.trim()); }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

render();
