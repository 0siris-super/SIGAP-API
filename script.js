/* ===== Konfigurasi ===== */
const CONFIG = {
  mode: 'demo',            // 'demo' = data simulasi, 'api' = ambil data dari server
  apiUrl: '/api/houses',   // harus mengembalikan [{code:'SA-001', temp:30, smoke:90, flame:false}, ...]
  pollMs: 3000,
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
].map(h => ({ ...h, temp:28, smoke:80, flame:false }));

const $ = s => document.querySelector(s);
const get = c => houses.find(h => h.code === c);
const label = { safe:'Aman', warn:'Waspada', fire:'Kebakaran' };
const status = h => (h.flame || h.smoke >= CONFIG.T.sf || h.temp >= CONFIG.T.tf) ? 'fire'
  : (h.smoke >= CONFIG.T.sw || h.temp >= CONFIG.T.tw) ? 'warn' : 'safe';
let selected = null;

/* ===== Bangun denah (biru) ===== */
const blocks = [[30,30,740,125],[30,195,170,335],[250,195,520,205],[250,435,520,95]];
$('#map').innerHTML =
  blocks.map(b => `<rect class="block" x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="6"/>`).join('') +
  houses.map(h => `<g class="house" data-code="${h.code}" tabindex="0" role="button" aria-label="${h.name}, kode ${h.code}" transform="translate(${h.x} ${h.y})">
    <circle class="halo" cy="-34" r="11"/><circle class="lamp" cy="-34" r="8"/>
    <path class="roof" d="M-26 -4L0 -24L26 -4Z"/><rect class="body" x="-20" y="-4" width="40" height="28"/>
    <text y="42">${h.name}</text><text class="code" y="55">${h.code}</text></g>`).join('');

/* ===== Bangun daftar rumah (merah) ===== */
$('#houseList').innerHTML = houses.map(h => `<li><button class="item" data-code="${h.code}">
  <span class="ico"></span>
  <span class="meta"><b>${h.name}</b><small>${h.code}, ${h.addr}</small>
  <span class="vals">Suhu <i data-t></i> &nbsp; Asap <i data-s></i></span></span>
  <em class="badge"></em></button></li>`).join('');
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
    <section class="card"><h3>Suhu (DHT11)</h3>${gauge('nT',100,[[0,40,'#2F8F5B'],[40,60,'#D98A0B'],[60,100,'#D62839']])}
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

/* ===== Render semua tampilan ===== */
function render() {
  houses.forEach(h => {
    const s = status(h), g = $(`.house[data-code="${h.code}"]`), it = $(`.item[data-code="${h.code}"]`);
    g.dataset.s = s; g.classList.toggle('sel', h.code === selected);
    it.dataset.s = s; it.querySelector('[data-t]').textContent = h.temp.toFixed(0) + '°C';
    it.querySelector('[data-s]').textContent = h.smoke.toFixed(0); it.querySelector('.badge').textContent = label[s];
  });
  const fires = houses.filter(h => status(h) === 'fire');
  document.body.classList.toggle('has-fire', fires.length > 0);
  const msg = 'Kebakaran terdeteksi di ' + fires.map(h => `${h.name} (${h.code})`).join(', ');
  ['#alertTop', '#alertBottom'].forEach(id => { $(id).hidden = !fires.length; $(id + ' span').textContent = msg; });
  if (selected) {
    const h = get(selected);
    $('#nT').style.transform = `rotate(${Math.min(Math.max(h.temp / 100, 0), 1) * 180}deg)`;
    $('#nS').style.transform = `rotate(${Math.min(Math.max(h.smoke / 1000, 0), 1) * 180}deg)`;
    $('#vT').textContent = h.temp.toFixed(1); $('#vS').textContent = h.smoke.toFixed(0);
    $('#alarm').classList.toggle('on', h.flame);
    $('#vF').textContent = h.flame ? 'Api terdeteksi' : 'Tidak terdeteksi api';
  }
}

/* ===== Interaksi ===== */
document.addEventListener('click', e => {
  const t = e.target.closest('.house, .item');
  if (t) return openDetail(t.dataset.code);
  if (e.target.closest('.back')) return closeDetail();
  if (e.target.closest('.alert')) { const f = houses.find(h => status(h) === 'fire'); if (f) openDetail(f.code); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList?.contains('house')) openDetail(e.target.dataset.code);
});

/* Dipanggil dari WebSocket/MQTT/Firebase: updateHouse('SA-002', {temp:70, smoke:800, flame:true}) */
function updateHouse(code, data) { const h = get(code); if (h) { Object.assign(h, data); render(); } }
window.updateHouse = updateHouse;

/* ===== Mode demo ===== */
const burning = new Set();
function setConn(t) { $('#conn').textContent = t; }
function tick() {
  houses.forEach(h => {
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
$('#simReset').onclick = () => burning.clear();

/* ===== Mode API ===== */
async function poll() {
  try {
    const data = await (await fetch(CONFIG.apiUrl)).json();
    data.forEach(d => { const h = get(d.code); if (h) Object.assign(h, d); });
    setConn('Terhubung, diperbarui ' + new Date().toLocaleTimeString('id-ID'));
  } catch { setConn('Koneksi terputus, mencoba lagi...'); }
  render();
}

if (CONFIG.mode === 'api') { $('#simBox').hidden = true; poll(); setInterval(poll, CONFIG.pollMs); }
else { setConn('Mode demo: data simulasi'); tick(); setInterval(tick, 2000); }
