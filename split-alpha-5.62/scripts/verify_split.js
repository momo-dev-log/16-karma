const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const info = JSON.parse(fs.readFileSync(path.join(root, 'verification.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'));
assert.equal(html.length, info.html_bytes);
assert.equal(info.images.length, 9);
const source = html.toString('utf8');
for (const item of info.images) {
  const file = fs.readFileSync(path.join(root, 'assets', item.name));
  assert.equal(file.length, item.bytes, item.name);
  assert.equal(crypto.createHash('sha256').update(file).digest('hex'), item.sha256, item.name);
  assert.equal(source.split('assets/' + item.name).length - 1, 1, item.name);
  assert.equal(file.subarray(0,8).toString('hex'), '89504e470d0a1a0a', item.name);
}
const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)].map(m => m[1]);
assert.equal(scripts.length, 4);
for (const script of scripts) new (require('node:vm').Script)(script);
assert.match(source, /const CURSE_DAMAGE=Object\.freeze\(\{0:0,1:2,2:5,3:9\}\)/);
assert.match(source, /function applyCurseOnCard\(/);
assert.match(source, /function isElectroBlocked\(/);
assert.match(source, /function tickStatuses\(/);
console.log('PASS: HTML size, 9 PNG sizes/hashes/references, 4 JS syntax checks, core status functions');
