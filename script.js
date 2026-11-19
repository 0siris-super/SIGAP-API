/* ===== Konfigurasi ===== */
const CONFIG = {
  mode: 'demo',            // 'demo' = data simulasi, 'api' = ambil data dari server
  apiUrl: '/api/houses',   // harus mengembalikan [{code:'SA-001', temp:30, smoke:90, flame:false, ts:1767000000000}, ...]
                           // ts (opsional tapi disarankan) = waktu data terakhir dari alat, dalam milidetik atau detik
  ackUrl: '',              // opsional: alamat POST untuk memberi tahu server saat status bahaya dimatikan, mis. '/api/ack'
  pollMs: 3000,
  offlineMs: 15000,        // alat dianggap offline kalau tidak ada data baru selama sekian milidetik
  T: { tw: 40, tf: 60, sw: 300, sf: 600 } // batas waspada/kebakaran: suhu (°C) dan asap
};

/* ===== Data rumah: kode unik + posisi di denah ===== */
const houses = [
  { code:'SA-001', name:'Rumah 1', addr:'Blok A', x:170, y:92 },
  { code:'SA-002', name:'Rumah 2', addr:'Blok A', x:600, y:92 },
  { code:'SA-003', name:'Rumah 3', addr:'Blok B', x:115, y:405 },
  { code:'SA-004', name:'Rumah 4', addr:'Blok C', x:650, y:268 },
  { code:'SA-005', name:'Rumah 5', addr:'Blok C', x:430, y:340 },
  { code:'SA-006', name:'Rumah 6', addr:'Blok D', x:600, y:488 }
].map(h => ({ ...h, temp:28, smoke:80, flame:false, lastSeen:0, ack:false }));

const $ = s => document.querySelector(s);
const get = c => houses.find(h => h.code === c);
const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
const clock = ms => new Date(ms).toLocaleTimeString('id-ID');
const label = { safe:'Aman', warn:'Waspada', fire:'Kebakaran', ack:'Ditangani' };

/* status dasar dari data TERAKHIR (tetap dipakai walau alat offline) */
const status = h => (h.flame || h.smoke >= CONFIG.T.sf || h.temp >= CONFIG.T.tf) ? 'fire'
  : (h.smoke >= CONFIG.T.sw || h.temp >= CONFIG.T.tw) ? 'warn' : 'safe';
/* status yang ditampilkan: kebakaran yang sudah dimatikan dari web tampil sebagai "Ditangani" */
const shown = h => { const s = status(h); return (s === 'fire' && h.ack) ? 'ack' : s; };
const online = h => h.lastSeen > 0 && Date.now() - h.lastSeen <= CONFIG.offlineMs;
const connText = h => online(h) ? 'Online' : (h.lastSeen ? 'Offline · ' + clock(h.lastSeen) : 'Belum ada data');
const activeFires = () => houses.filter(h => status(h) === 'fire' && !h.ack);
let selected = null;

/* ===== Bangun denah (biru) ===== */
const blocks = [[30,30,740,125],[30,195,170,335],[250,195,520,205],[250,435,520,95]];
$('#map').innerHTML =
  blocks.map(b => `<rect class="block" x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="6"/>`).join('') +
  houses.map(h => `<g class="house" data-code="${h.code}" tabindex="0" role="button" aria-label="${h.name}, kode ${h.code}" transform="translate(${h.x} ${h.y})">
    <circle class="halo" cy="-34" r="11"/><circle class="lamp" cy="-34" r="8"/>
    <path class="roof" d="M-26 -4L0 -24L26 -4Z"/><rect class="body" x="-20" y="-4" width="40" height="28"/>
    <text class="off" y="-52">OFFLINE</text>
    <text y="42">${h.name}</text><text class="code" y="55">${h.code}</text></g>`).join('');

/* ===== Bangun daftar rumah (merah) ===== */
$('#houseList').innerHTML = houses.map(h => `<li><button class="item" data-code="${h.code}">
  <span class="ico"></span>
  <span class="meta"><b>${h.name}</b><small>${h.code}, ${h.addr}</small>
  <span class="vals">Suhu <i data-t></i> &nbsp; Asap <i data-s></i></span></span>
  <span class="stat"><em class="badge"></em><small class="conn"></small></span></button></li>`).join('');
$('#simHouse').innerHTML = houses.map(h => `<option value="${h.code}">${h.name} (${h.code})</option>`).join('');

/* ===== Gauge ===== */
function gauge(id, max, zones) {
  const pt = (f, r) => { const a = Math.PI * (1 + f); return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
  const arc = (f0, f1) => { const [x0,y0] = pt(f0,80), [x1,y1] = pt(f1,80); return `M${x0} ${y0}A80 80 0 0 1 ${x1} ${y1}`; };
  return `<svg viewBox="0 0 200 125" class="gauge" aria-hidden="true">
    ${zones.map(z => `<path d="${arc(z[0]/max, z[1]/max)}" stroke="${z[2]}"/>`).join('')}
    <g id="${id}" class="needle"><path d="M20 100L100 95L100 105Z"/></g><circle cx="100" cy="100" r="7"/>
    <text x="20" y="120">0</text><text x="180" y="120">${max}</text></svg>`;
}

/* ===== Detail rumah (gambar kedua) ===== */
function openDetail(code) {
  selected = code; const h = get(code);
  $('#detail').innerHTML = `<button class="back">Kembali ke daftar</button>
    <div class="dhead"><h2>${h.name}</h2><p>Kode alat ${h.code}, ${h.addr}</p></div>
    <div class="ackbox" id="ackBox" hidden><p id="ackMsg"></p>
      <button class="ack-btn" id="ackBtn" type="button" data-ack="${h.code}">Matikan status bahaya</button></div>
    <section class="card"><h3>Koneksi alat</h3>
      <p class="read"><b id="vC"></b></p><small id="vCt"></small></section>
    <section class="card"><h3>Suhu (DHT22)</h3>${gauge('nT',100,[[0,40,'#2F8F5B'],[40,60,'#D98A0B'],[60,100,'#D62839']])}
      <p class="read"><b id="vT"></b> °C</p></section>
    <section class="card"><h3>Asap (MQ-2)</h3>${gauge('nS',1000,[[0,300,'#2F8F5B'],[300,600,'#D98A0B'],[600,1000,'#D62839']])}
      <p class="read"><b id="vS"></b></p></section>
    <section class="card alarm" id="alarm">
      <svg viewBox="0 0 100 80"><path class="dome" d="M22 62V44a28 28 0 0 1 56 0v18Z"/><rect x="14" y="62" width="72" height="10" rx="3" fill="#1B2430"/>
      <path class="ray" d="M50 6V-2M18 18l-6-6M82 18l6-6M6 44H-2M94 44h8"/></svg>
      <div><h3>Sensor api</h3><p id="vF"></p></div></section>`;
  $('#listView').hidden = true; $('#detail').hidden = false; render();
}
function closeDetail() { selected = null; $('#detail').hidden = true; $('#listView').hidden = false; render(); }

/* ===== Matikan status bahaya dari web ===== */
function ackFire(codes) {
  const targets = codes.map(get).filter(h => h && status(h) === 'fire' && !h.ack);
  if (!targets.length) return;
  const names = targets.map(h => h.name).join(', ');
  if (!confirm(`Matikan status bahaya untuk ${names}?\nStatus akan aktif lagi otomatis kalau terjadi kebakaran baru.`)) return;
  targets.forEach(h => {
    h.ack = true;
    if (CONFIG.mode === 'api' && CONFIG.ackUrl)
      fetch(CONFIG.ackUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code:h.code }) }).catch(() => {});
  });
  render();
}

/* ===== Render semua tampilan ===== */
function render() {
  /* status bahaya yang sudah dimatikan aktif kembali otomatis begitu kondisinya sempat normal */
  houses.forEach(h => { if (h.ack && status(h) !== 'fire') h.ack = false; });

  houses.forEach(h => {
    const s = shown(h), o = online(h) ? 'on' : 'off';
    const g = $(`.house[data-code="${h.code}"]`), it = $(`.item[data-code="${h.code}"]`), c = it.querySelector('.conn');
    g.dataset.s = s; g.dataset.o = o; g.classList.toggle('sel', h.code === selected);
    it.dataset.s = s; it.dataset.o = o; c.dataset.o = o;
    setText(it.querySelector('[data-t]'), h.temp.toFixed(0) + '°C');
    setText(it.querySelector('[data-s]'), h.smoke.toFixed(0));
    setText(it.querySelector('.badge'), label[s]);
    setText(c, connText(h));
  });

  const fires = activeFires();
  document.body.classList.toggle('has-fire', fires.length > 0);
  const msg = 'Kebakaran terdeteksi di ' + fires.map(h => `${h.name} (${h.code})` +
    (online(h) ? '' : ' - ALAT OFFLINE' + (h.lastSeen ? ', data terakhir ' + clock(h.lastSeen) : ''))).join(', ');
  ['#alertTop', '#alertBottom'].forEach(id => { $(id).hidden = !fires.length; setText($(id + ' span'), msg); });

  const off = houses.filter(h => !online(h)).length;
  setText($('#offInfo'), off ? `${off} alat offline` : '');

  if (selected) {
    const h = get(selected), on = online(h), st = status(h);
    $('#nT').style.transform = `rotate(${Math.min(Math.max(h.temp / 100, 0), 1) * 180}deg)`;
    $('#nS').style.transform = `rotate(${Math.min(Math.max(h.smoke / 1000, 0), 1) * 180}deg)`;
    setText($('#vT'), h.temp.toFixed(1)); setText($('#vS'), h.smoke.toFixed(0));
    $('#alarm').classList.toggle('on', h.flame);
    setText($('#vF'), (h.flame ? 'Api terdeteksi' : 'Tidak terdeteksi api') + (on ? '' : ' (data terakhir)'));
    $('#vC').dataset.o = on ? 'on' : 'off'; setText($('#vC'), on ? 'Online' : 'Offline');
    setText($('#vCt'), h.lastSeen ? 'Data terakhir diterima ' + clock(h.lastSeen) : 'Belum ada data dari alat');
    $('#ackBox').hidden = st !== 'fire';
    $('#ackBox').classList.toggle('done', h.ack);
    $('#ackBtn').hidden = h.ack;
    setText($('#ackMsg'), h.ack
      ? 'Status bahaya dimatikan. Akan aktif lagi otomatis kalau terjadi kebakaran baru.'
      : 'Status bahaya aktif' + (on ? '.' : '. Alat offline, ini data terakhir sebelum alat terputus.'));
  }
}

/* ===== Interaksi ===== */
document.addEventListener('click', e => {
  const a = e.target.closest('.ack-btn');
  if (a) return ackFire(a.dataset.ack ? [a.dataset.ack] : activeFires().map(h => h.code));
  const t = e.target.closest('.house, .item');
  if (t) return openDetail(t.dataset.code);
  if (e.target.closest('.back')) return closeDetail();
  if (e.target.closest('.alert')) { const f = activeFires()[0]; if (f) openDetail(f.code); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('house')) { e.preventDefault(); openDetail(e.target.dataset.code); }
});

/* Dipanggil dari WebSocket/MQTT/Firebase: updateHouse('SA-002', {temp:70, smoke:800, flame:true}) */
function updateHouse(code, data) {
  const h = get(code); if (!h) return;
  const { ts, ...vals } = data;
  Object.assign(h, vals);
  h.lastSeen = ts ? (ts < 1e12 ? ts * 1000 : ts) : Date.now();
  render();
}
window.updateHouse = updateHouse;

/* ===== Mode demo ===== */
const burning = new Set(), dead = new Set();
function setConn(t) { $('#conn').textContent = t; }
function tick() {
  const now = Date.now();
  houses.forEach(h => {
    if (dead.has(h.code)) return;          // alat "mati": data berhenti, nilai terakhir tetap
    h.lastSeen = now;
    if (burning.has(h.code)) {
      h.temp = Math.min(98, h.temp + 3 + Math.random() * 3);
      h.smoke = Math.min(980, h.smoke + 60 + Math.random() * 60);
      h.flame = h.temp > 55;
    } else {
      h.temp += (28 - h.temp) * .3 + (Math.random() - .5);
      h.smoke += (80 - h.smoke) * .3 + (Math.random() - .5) * 10; h.flame = false;
    }
  });
  render();
}
$('#simFire').onclick = () => burning.add($('#simHouse').value);
$('#simOff').onclick = () => dead.add($('#simHouse').value);
$('#simOn').onclick = () => dead.delete($('#simHouse').value);
$('#simReset').onclick = () => { burning.clear(); dead.clear(); };

/* ===== Mode API ===== */
async function poll() {
  try {
    const data = await (await fetch(CONFIG.apiUrl)).json();
    data.forEach(d => {
      const h = get(d.code); if (!h) return;
      const { ts, ...vals } = d;
      Object.assign(h, vals);
      h.lastSeen = ts ? (ts < 1e12 ? ts * 1000 : ts) : Date.now();
    });
    setConn('Server terhubung, diperbarui ' + clock(Date.now()));
  } catch { setConn('Server terputus, mencoba lagi...'); }
  render();
}

if (CONFIG.mode === 'api') { $('#simBox').hidden = true; poll(); setInterval(poll, CONFIG.pollMs); }
else { setConn('Mode demo: data simulasi'); tick(); setInterval(tick, 2000); }

/* cek status online/offline tiap detik, supaya alat yang berhenti kirim data langsung terdeteksi */
setInterval(render, 1000);
