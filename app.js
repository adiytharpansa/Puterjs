/* Puter.js Studio — vanilla JS, neutral UI */
const $ = (s) => document.querySelector(s);
const toast = (msg) => {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
};
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/* ---------- tabs ---------- */
document.querySelectorAll('#tabs .tab').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#tabs .tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    document.querySelector('#panel-' + b.dataset.tab)?.classList.add('active');
  });
});

$('#btn-copy-tag')?.addEventListener('click', async () => {
  const t = '<script src="https://js.puter.com/v2/"></scr' + 'ipt>';
  try { await navigator.clipboard.writeText(t); toast('Script tag disalin'); }
  catch { toast(t); }
});

/* ---------- auth ---------- */
const btnAuth = $('#btn-auth');
const authStatus = $('#auth-status');
let user = null;

async function refreshAuth() {
  try {
    const signed = await puter.auth.isSignedIn();
    if (signed) {
      user = await puter.auth.getUser();
      authStatus.textContent = '@' + (user?.username || 'user');
      authStatus.classList.add('ok');
      btnAuth.textContent = 'Keluar';
    } else {
      user = null;
      authStatus.textContent = 'belum masuk (tamu)';
      authStatus.classList.remove('ok');
      btnAuth.textContent = 'Masuk';
    }
  } catch (e) {
    authStatus.textContent = 'auth tidak tersedia (offline?)';
  }
}
btnAuth.addEventListener('click', async () => {
  try {
    if (await puter.auth.isSignedIn()) {
      await puter.auth.signOut();
      toast('Berhasil keluar');
    } else {
      await puter.auth.signIn();
      toast('Berhasil masuk');
    }
    refreshAuth();
    if (document.querySelector('#panel-fs.active')) loadFiles();
  } catch (e) { toast('Auth dibatalkan / gagal: ' + (e?.message || e)); }
});

/* ---------- AI chat ---------- */
const chatLog = $('#chat-log');
function addMsg(role, html) {
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  d.innerHTML = html;
  chatLog.appendChild(d);
  chatLog.scrollTop = chatLog.scrollHeight;
  return d;
}
$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  const model = $('#ai-model').value;
  const imageUrl = $('#ai-image').value.trim();
  const stream = $('#ai-stream').checked;
  input.value = '';
  addMsg('user', esc(text));
  const typing = addMsg('assistant', '<span class="muted">mengetik…</span>');
  $('#btn-send').disabled = true;
  try {
    if (stream) {
      const args = imageUrl ? [text, imageUrl, { model, stream: true }] : [text, { model, stream: true }];
      const resp = await puter.ai.chat(...args);
      let full = '';
      typing.innerHTML = '';
      for await (const part of resp) {
        const t = part?.text || '';
        full += t;
        typing.innerHTML = esc(full).replaceAll('\n', '<br>');
        chatLog.scrollTop = chatLog.scrollHeight;
      }
      if (!full) typing.innerHTML = '<span class="muted">(respons kosong)</span>';
    } else {
      const args = imageUrl ? [text, imageUrl, { model }] : [text, { model }];
      const resp = await puter.ai.chat(...args);
      const out = resp?.message?.content?.[0]?.text || resp?.text || resp?.toString?.() || JSON.stringify(resp);
      typing.innerHTML = esc(out).replaceAll('\n', '<br>');
    }
  } catch (err) {
    typing.innerHTML = '<span class="muted">Gagal: ' + esc(err?.message || err) + '</span>';
  } finally {
    $('#btn-send').disabled = false;
  }
});

/* ---------- txt2img ---------- */
$('#img-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('#img-out');
  out.innerHTML = '<span class="muted small">Membuat gambar…</span>';
  try {
    const img = await puter.ai.txt2img($('#img-prompt').value, $('#img-test').checked);
    out.innerHTML = '';
    out.appendChild(img);
  } catch (err) { out.innerHTML = '<span class="muted small">Gagal: ' + esc(err?.message || err) + '</span>'; }
});

/* ---------- fs ---------- */
async function loadFiles() {
  const ul = $('#fs-list');
  try {
    const items = await puter.fs.readdir('/');
    ul.innerHTML = '';
    if (!items?.length) ul.innerHTML = '<li class="muted small">Kosong — tulis file pertama di atas.</li>';
    items.slice(0, 60).forEach((f) => {
      const li = document.createElement('li');
      const name = f.path?.split('/').pop() || f.name || f.path;
      li.innerHTML = '<span class="mono">' + esc(name) + '</span>';
      const wrap = document.createElement('span');
      const bRead = document.createElement('button'); bRead.textContent = 'Baca';
      bRead.onclick = async (ev) => { ev.stopPropagation(); await readFile(f.path); };
      const bDel = document.createElement('button'); bDel.textContent = 'Hapus';
      bDel.onclick = async (ev) => {
        ev.stopPropagation();
        if (!confirm('Hapus ' + f.path + '?')) return;
        await puter.fs.delete(f.path); toast('Dihapus: ' + name); loadFiles();
      };
      wrap.append(bRead, bDel);
      li.appendChild(wrap);
      li.onclick = () => readFile(f.path);
      ul.appendChild(li);
    });
  } catch (err) {
    ul.innerHTML = '<li class="muted small">Perlu masuk dulu / gagal: ' + esc(err?.message || err) + '</li>';
  }
}
async function readFile(path) {
  try {
    const blob = await puter.fs.read(path);
    const text = await blob.text();
    $('#fs-read').textContent = '— ' + path + ' —\n\n' + text.slice(0, 4000);
  } catch (err) { $('#fs-read').textContent = 'Gagal membaca: ' + (err?.message || err); }
}
$('#fs-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const file = await puter.fs.write($('#fs-name').value.trim() || (puter.randName() + '.txt'), $('#fs-content').value);
    toast('Tersimpan: ' + file.path);
    loadFiles();
  } catch (err) { toast('Gagal menyimpan: ' + (err?.message || err)); }
});
$('#btn-fs-refresh').addEventListener('click', loadFiles);

/* ---------- kv ---------- */
$('#kv-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await puter.kv.set($('#kv-key').value.trim(), $('#kv-val').value);
    $('#kv-out').textContent = "OK: set('" + $('#kv-key').value + "')";
    toast('KV tersimpan');
  } catch (err) { $('#kv-out').textContent = 'Gagal: ' + (err?.message || err); }
});
$('#btn-kv-get').addEventListener('click', async () => {
  try {
    const v = await puter.kv.get($('#kv-key').value.trim());
    $('#kv-out').textContent = 'get(' + $('#kv-key').value + ') = ' + JSON.stringify(v);
  } catch (err) { $('#kv-out').textContent = 'Gagal: ' + (err?.message || err); }
});
$('#btn-kv-del').addEventListener('click', async () => {
  try {
    await puter.kv.del($('#kv-key').value.trim());
    $('#kv-out').textContent = 'deleted: ' + $('#kv-key').value;
  } catch (err) { $('#kv-out').textContent = 'Gagal: ' + (err?.message || err); }
});
$('#btn-kv-list').addEventListener('click', async () => {
  try {
    const keys = await puter.kv.list('*', true);
    $('#kv-out').textContent = 'keys (' + keys.length + '):\n' + keys.slice(0, 30).map((k) => (typeof k === 'string' ? k : k.key || JSON.stringify(k))).join('\n');
  } catch (err) { $('#kv-out').textContent = 'Gagal: ' + (err?.message || err); }
});

/* ---------- hosting ---------- */
$('#host-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('#host-out');
  out.textContent = 'Mempublish… (buat folder → tulis index.html → hosting.create)';
  try {
    const dir = puter.randName();
    await puter.fs.mkdir(dir);
    await puter.fs.write(dir + '/index.html', $('#host-html').value);
    const sub = puter.randName();
    const site = await puter.hosting.create(sub, dir);
    out.innerHTML = '';
    out.textContent = 'Live di: https://' + site.subdomain + '.puter.site';
  } catch (err) { out.textContent = 'Gagal: ' + (err?.message || err); }
});

/* ---------- networking ---------- */
$('#net-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('#net-out');
  out.textContent = 'Memuat ' + $('#net-url').value + ' …';
  try {
    const res = await puter.net.fetch($('#net-url').value);
    const body = await res.text();
    out.textContent = 'HTTP ' + res.status + ' · ' + body.length + ' chars\n\n' + body.slice(0, 3000);
  } catch (err) { out.textContent = 'Gagal: ' + (err?.message || err); }
});

/* init */
refreshAuth();
loadFiles();
