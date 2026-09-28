// Encrypts an HTML page behind a password so only ciphertext is committed.
// Usage: node scripts/lock-page.mjs <plain.html> <out/index.html> <password> [title]
// The plaintext page never goes in the repo. AES-GCM, key from PBKDF2-SHA256.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const [src, out, password, title = 'Private page'] = process.argv.slice(2);
if (!src || !out || !password) {
  console.error('Usage: node scripts/lock-page.mjs <plain.html> <out/index.html> <password> [title]');
  process.exit(1);
}

const ITER = 600000;
const b64 = (u8) => Buffer.from(u8).toString('base64');
const plain = new TextEncoder().encode(readFileSync(src, 'utf8'));
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
:root { --bg: #E9EAE6; --surface: #F5F6F3; --ink: #1B2025; --muted: #59626A; --line: #C4C8C1; --accent: #D4470C; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #111417; --surface: #181C20; --ink: #E4E6E1; --muted: #99A1A8; --line: #2C3237; --accent: #FF7B3A; color-scheme: dark; } }
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; display: grid; place-items: center; padding-inline: 16px; }
form { width: min(100%, 360px); display: grid; gap: 12px; background: var(--surface); border: 1px solid var(--line); border-top: 4px solid var(--accent); border-radius: 4px; padding: 24px; }
h1 { margin: 0; font-size: 20px; letter-spacing: .01em; }
label { font-size: 13px; color: var(--muted); }
input { font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 3px; background: var(--bg); color: var(--ink); }
button { font: 600 14px/1 system-ui, sans-serif; padding: 12px; border: 0; border-radius: 3px; background: var(--ink); color: var(--bg); cursor: pointer; }
button:hover { background: var(--accent); color: #fff; }
input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#msg { min-height: 1.4em; margin: 0; font-size: 13px; color: var(--accent); }
</style>
</head>
<body>
<form id="gate" autocomplete="off">
  <h1>${esc(title)}</h1>
  <label for="pw">Password</label>
  <input id="pw" type="password" autofocus required>
  <button type="submit">Open</button>
  <p id="msg" role="status"></p>
</form>
<script>
(function () {
  var D = { salt: "${b64(salt)}", iv: "${b64(iv)}", ct: "${b64(ct)}", iter: ${ITER} };
  var u8 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var KEY = "lock:" + location.pathname;
  async function open(pw) {
    var enc = new TextEncoder();
    var base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: u8(D.salt), iterations: D.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: u8(D.iv) }, key, u8(D.ct));
    return new TextDecoder().decode(pt);
  }
  function show(html) { document.open(); document.write(html); document.close(); }
  var saved = null;
  try { saved = sessionStorage.getItem(KEY); } catch (e) {}
  if (saved) open(saved).then(show).catch(function () { try { sessionStorage.removeItem(KEY); } catch (e) {} });
  document.getElementById("gate").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = document.getElementById("pw").value, msg = document.getElementById("msg");
    msg.textContent = "Checking…";
    open(pw).then(function (html) {
      try { sessionStorage.setItem(KEY, pw); } catch (e) {}
      show(html);
    }).catch(function () { msg.textContent = "That password didn't work. Try again."; });
  });
})();
</script>
</body>
</html>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log('Wrote', out, '(' + page.length + ' bytes)');
