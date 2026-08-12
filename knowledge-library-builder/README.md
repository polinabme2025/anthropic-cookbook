# בונה ספריית ידע (Knowledge Library Builder)

אשף 5 שלבים בעברית (RTL) לבניית פריטי ספרייה מתוכן לימודי:

1. **לכידה** — בחירת סוג מקור (YouTube / PDF / טקסט) וכותרת
2. **הפקה** — תמלול אוטומטי מכתוביות YouTube
3. **סינתזה** — כרטיס מדריך מובנה עם Claude או GPT (מסמן `[INCOMPLETE]` כשמידע חסר)
4. **ארגון** — בחירת פלטפורמת יעד + תצוגה מקדימה + מגנט לידים
5. **עתיד** — שמירה לספרייה (JSON + Markdown + דף HTML עצמאי)

המצב נשמר אוטומטית ב-localStorage — אפשר לסגור את הדפדפן ולהמשיך מאותה נקודה.

## התקנה והפעלה

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # נדרש לסינתזה עם Claude
export OPENAI_API_KEY=sk-...          # אופציונלי: GPT-4o / Whisper
npm start
```

פתחו את http://localhost:3000

ב-Windows PowerShell:

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm start
```

## API

| נתיב | קלט | פלט |
|------|-----|-----|
| `POST /api/transcribe` | `{url}` | `{text, segments, lang}` — כתוביות YouTube (עברית → אנגלית → ראשונה) |
| `POST /api/synthesize` | `{transcript, title, model}` | `{summary, model}` — Claude (ברירת מחדל) או GPT |
| `POST /api/save` | `{source, transcript, summary, model, platform, leadMagnet}` | `{id, htmlPath, summaryPath, transcriptPath}` |

## מבנה פריט שמור

```
library/<slug>-<timestamp>/
├── item.json        # מטא-דאטה
├── transcript.md    # התמלול המלא
├── summary.md       # כרטיס המדריך
└── index.html       # דף שיעור עצמאי (כולל מגנט לידים אם הופעל)
```

## הערות

- קריאות Claude משתמשות ב-prompt caching (`cache_control: ephemeral`) — תמלולים ארוכים שנשלחים שוב עולים פחות.
- תמלול Whisper לסרטונים ללא כתוביות דורש הורדת אודיו (למשל עם `yt-dlp`) — לא ממומש כרגע; ה-API מחזיר הודעה מתאימה.
- שמירה ל-Google Drive דרך MCP מסומנת בממשק אך נשמרת מקומית בשלב זה.
