/* run2.js — quick login-screen check: parses+executes the game script and
   confirms the class-selection screen renders with no error. Fast, but NOT
   sufficient on its own — it never enters the world. run3 is the required
   gate; run2 is just for a fast first look while iterating. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const FILE = process.argv[2] || '../runehaven.html';
const html = fs.readFileSync(FILE, 'utf8');
const scripts = html.split('<script');
const gameScript = scripts[scripts.length - 1].split('>').slice(1).join('>').split('</script>')[0];
const bodyHtml = html
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^<]*<\/script>/, '')
  .replace(/<script>[\s\S]*<\/script>/, '');

const dom = new JSDOM(bodyHtml, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.com/" });
const { window } = dom;

const ctx2d = new Proxy({}, {
  get(t, prop) {
    if (prop === 'canvas') return { width: 1280, height: 720 };
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
      return () => ({ addColorStop: () => {} });
    if (prop === 'measureText') return () => ({ width: 10 });
    if (typeof prop === 'string') return () => {};
    return undefined;
  },
  set() { return true; }
});
window.HTMLCanvasElement.prototype.getContext = () => ctx2d;
window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
window.supabase = { createClient: () => ({ from: () => ({}), channel: () => ({ on: () => {}, subscribe: () => {} }), removeChannel: () => {} }) };
let rafQ = [];
window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };

let caught = null;
window.addEventListener('error', e => { if (!caught) caught = e.error || e.message; });

try {
  window.eval(gameScript);
} catch (e) { caught = e; }

const doc = window.document;
console.log('classRow exists:', !!doc.getElementById('classRow'));
console.log('class cards rendered:', doc.querySelectorAll('.class-card')?.length || 0);
console.log('CAUGHT ERROR:', caught ? (caught.stack || caught) : 'none');
process.exit(caught ? 1 : 0);
