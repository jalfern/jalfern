// LLM-backed banksman: sends live lift state + the operator's words to Claude and
// gets back a short spoken radio call plus an optional action. Falls back to a
// rule-based responder when no API key is configured.
const MODEL_DEFAULT = 'claude-haiku-4-5-20251001';

const SYSTEM = `You are an experienced dogman/banksman (rigger) directing a crane operator over the radio in a realistic training simulator. You are on the ground; you can see the load and the landing area. Speak in short, natural radio calls — one or two sentences, calm and authoritative, using real crane terminology (slew, luff, trolley in/out, hoist up/down, take the strain, dog it off, all stop, cushion it down). Use the LIVE STATE (positions are in metres, in the operator's frame) to answer questions and give precise, correct guidance. Never invent positions — read them from the state. Keep the operator safe.

Reply with ONLY compact JSON, no prose, no code fences:
{"say":"<what you say over the radio>","action":"<one of: none, hook_on, unhook, hold, steady, status>"}
- hook_on: the operator wants you to hook the load onto the descended hook (only when a load is under the hook).
- unhook: the operator wants it set down / unhooked and it is on the mark.
- hold / steady: tell them to stop / you're steadying the load.
- status / none: you're just talking; no action.`;

export class BanksmanAI {
  constructor() {
    // Web build: the page can't reach api.anthropic.com, so the AI banksman stays
    // off and the built-in rule-based banksman answers.
    this.key = '';
    this.model = MODEL_DEFAULT;
    this.history = [];
  }
  get enabled() { return !!this.key; }
  setKey(k) { this.key = (k || '').trim(); }
  setModel(m) { this.model = m || MODEL_DEFAULT; }
  reset() { this.history = []; }

  async respond(ctx, userText) {
    this.history.push({ role: 'user', content: `LIVE STATE: ${JSON.stringify(ctx)}\nOPERATOR: "${userText}"` });
    if (this.history.length > 10) this.history = this.history.slice(-10);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: this.model, max_tokens: 220, system: SYSTEM, messages: this.history }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`${res.status} ${t.slice(0, 140)}`);
    }
    const data = await res.json();
    const text = (data.content || []).map((c) => c.text || '').join('').trim();
    this.history.push({ role: 'assistant', content: text });
    return parseReply(text);
  }
}

function parseReply(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const o = JSON.parse(cleaned);
    return { say: o.say || '', action: o.action || 'none' };
  } catch {
    return { say: text, action: 'none' };
  }
}

// Rule-based banksman for when no API key is set. Understands common phrasings and
// still answers with real guidance from the live state.
export function ruleFallback(ctx, textRaw) {
  const t = (textRaw || '').toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));

  if (has('hook on', 'hook up', 'hook it', 'dog', 'take it', 'take the strain', 'connect')) {
    return { say: 'Righto — hooking you on. Take the strain, hoist up slow.', action: 'hook_on' };
  }
  if (has('unhook', 'set it', 'set her', 'land it', 'drop it', 'let go', 'release', 'dog off', 'set down')) {
    return { say: 'Setting down and unhooking — hold it steady.', action: 'unhook' };
  }
  if (has('stop', 'hold', 'wait', 'whoa', 'all stop')) {
    return { say: 'All stop. Hold what you\'ve got.', action: 'hold' };
  }
  if (has('steady', 'swing', 'sway', 'settle')) {
    return { say: 'Ease off and let her settle — I\'ve got a hand on the tag line.', action: 'steady' };
  }
  if (has('wind')) {
    return { say: `Wind\'s about ${ctx.wind_ms} metres a second. Anticipate the swing.`, action: 'status' };
  }
  if (has('how', 'where', 'status', 'am i', 'clear', 'good', 'position', 'over')) {
    const m = ctx.to_mark;
    if (ctx.over_mark) return { say: 'You\'re right over the mark — kill the swing and come down slow.', action: 'status' };
    const parts = [];
    if (Math.abs(m.toward_you_m) > 0.5) parts.push(m.toward_you_m > 0 ? `${m.toward_you_m.toFixed(0)} toward me` : `${(-m.toward_you_m).toFixed(0)} back`);
    if (Math.abs(m.right_m) > 0.5) parts.push(m.right_m > 0 ? `${m.right_m.toFixed(0)} to your right` : `${(-m.right_m).toFixed(0)} to your left`);
    return { say: parts.length ? `Bring it ${parts.join(' and ')}.` : 'Steady as you go, you\'re nearly there.', action: 'status' };
  }
  return { say: 'Copy that.', action: 'none' };
}
