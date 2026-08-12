// שרת Express — תמלול YouTube, סינתזה עם Claude/GPT, שמירה לספרייה.
// הפעלה: npm install && npm start (ראו README לקונפיגורציית מפתחות).

const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/library', express.static(path.join(__dirname, 'library')));

const PORT = process.env.PORT || 3000;
const LIB_DIR = path.join(__dirname, 'library');

// ---------- /api/transcribe — כתוביות YouTube, ואם אין: Whisper ----------
app.post('/api/transcribe', async (req, res) => {
  const { url } = req.body || {};
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'קישור YouTube לא תקין' });

  try {
    const captions = await fetchYouTubeCaptions(videoId);
    if (captions) return res.json(captions);

    if (process.env.OPENAI_API_KEY) {
      return res.status(501).json({
        error: 'אין כתוביות לסרטון. תמלול Whisper דורש הורדת אודיו (yt-dlp) — ראו README.',
      });
    }
    return res.status(404).json({ error: 'לא נמצאו כתוביות לסרטון, ואין מפתח OpenAI ל-Whisper.' });
  } catch (e) {
    console.error('transcribe error:', e);
    return res.status(502).json({ error: 'שגיאה במשיכת התמלול: ' + e.message });
  }
});

function extractVideoId(u = '') {
  const m = String(u).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

// משיכת כתוביות דרך ממשק timedtext הציבורי של YouTube.
async function fetchYouTubeCaptions(videoId) {
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'user-agent': 'Mozilla/5.0' },
  });
  const html = await watchRes.text();
  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) return null;

  let tracks;
  try { tracks = JSON.parse(m[1]); } catch { return null; }
  if (!tracks.length) return null;

  // עדיפות לעברית, אחרת אנגלית, אחרת הרצועה הראשונה.
  const track =
    tracks.find((t) => t.languageCode === 'he') ||
    tracks.find((t) => t.languageCode === 'en') ||
    tracks[0];

  const xmlRes = await fetch(track.baseUrl);
  const xml = await xmlRes.text();
  const segments = [...xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)].map((s) => ({
    start: parseFloat(s[1]),
    text: decodeXml(s[2]),
  }));
  if (!segments.length) return null;

  return { text: segments.map((s) => s.text).join(' '), segments, lang: track.languageCode };
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '').trim();
}

// ---------- /api/synthesize — סיכום מובנה עם Claude או GPT ----------
const SYNTH_PROMPT = (title, transcript) => `אתה עוזר לימודי. צור "כרטיס מדריך" מובנה בעברית עבור השיעור "${title}" מתוך התמלול הבא.

מבנה חובה:
## תקציר (2-3 משפטים)
## מושגי מפתח (רשימה, כל מושג + הגדרה קצרה)
## נקודות עיקריות (ממוספרות)
## שאלות לחזרה (3-5)

כלל חשוב: אם מידע חסר או לא ברור בתמלול — סמן [INCOMPLETE] במקום להמציא.

תמלול:
${transcript.slice(0, 60000)}`;

app.post('/api/synthesize', async (req, res) => {
  const { transcript, title, model } = req.body || {};
  if (!transcript) return res.status(400).json({ error: 'חסר תמלול' });

  try {
    if (model && model.startsWith('gpt')) {
      if (!process.env.OPENAI_API_KEY) return res.status(400).json({ error: 'חסר OPENAI_API_KEY בסביבה' });
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          max_tokens: 2000,
          messages: [{ role: 'user', content: SYNTH_PROMPT(title, transcript) }],
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'OpenAI error');
      return res.json({ summary: data.choices[0].message.content, model });
    }

    if (!process.env.ANTHROPIC_API_KEY) return res.status(400).json({ error: 'חסר ANTHROPIC_API_KEY בסביבה' });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: 2000,
        // תמלול ארוך נשלח כבלוק נפרד עם cache_control — חוסך בעלות בקריאות חוזרות.
        system: [{ type: 'text', text: 'אתה עוזר לימודי מדויק. אל תמציא מידע.' }],
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: SYNTH_PROMPT(title, transcript), cache_control: { type: 'ephemeral' } }],
        }],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'Anthropic error');
    return res.json({ summary: data.content.map((b) => b.text || '').join(''), model: data.model });
  } catch (e) {
    console.error('synthesize error:', e);
    return res.status(502).json({ error: 'שגיאה בסינתזה: ' + e.message });
  }
});

// ---------- /api/save — שמירת פריט ספרייה: JSON + Markdown + דף HTML ----------
app.post('/api/save', async (req, res) => {
  const { source, transcript, summary, model, platform, leadMagnet } = req.body || {};
  if (!source?.title || !summary) return res.status(400).json({ error: 'חסרים כותרת או סיכום' });

  try {
    const id = slugify(source.title) + '-' + Date.now().toString(36);
    const dir = path.join(LIB_DIR, id);
    await fs.mkdir(dir, { recursive: true });

    const item = {
      id, title: source.title, sourceType: source.type, model, platform,
      leadMagnet: !!leadMagnet, createdAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(dir, 'item.json'), JSON.stringify(item, null, 2));
    await fs.writeFile(path.join(dir, 'transcript.md'), `# תמלול — ${source.title}\n\n${transcript?.text || ''}`);
    await fs.writeFile(path.join(dir, 'summary.md'), `# ${source.title}\n\n${summary}`);
    await fs.writeFile(path.join(dir, 'index.html'), lessonPageHtml(source.title, summary, leadMagnet));

    return res.json({
      id,
      htmlPath: `library/${id}/index.html`,
      summaryPath: `library/${id}/summary.md`,
      transcriptPath: `library/${id}/transcript.md`,
    });
  } catch (e) {
    console.error('save error:', e);
    return res.status(500).json({ error: 'שגיאה בשמירה: ' + e.message });
  }
});

function slugify(s) {
  return String(s).trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

function lessonPageHtml(title, summary, leadMagnet) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lead = leadMagnet
    ? `<div class="lead"><h3>רוצה את חבילת החזרה המלאה?</h3><p>השאירו פרטים ונשלח אליכם.</p><input placeholder="אימייל"><button>שליחה</button></div>`
    : '';
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:0 auto;padding:32px 20px;line-height:1.7;color:#222}
h1{color:#6c5ce7}
.summary{white-space:pre-wrap;background:#f7f7fb;border:1px solid #e3e3ef;border-radius:12px;padding:20px}
.lead{margin-top:28px;background:#6c5ce7;color:#fff;border-radius:12px;padding:20px;text-align:center}
.lead input{border:none;border-radius:8px;padding:10px;margin-inline-end:8px}
.lead button{border:none;border-radius:8px;padding:10px 18px;background:#fff;color:#6c5ce7;cursor:pointer}
</style></head>
<body><h1>${esc(title)}</h1><div class="summary">${esc(summary)}</div>${lead}</body></html>`;
}

app.listen(PORT, () => console.log(`Knowledge Library Builder → http://localhost:${PORT}`));
