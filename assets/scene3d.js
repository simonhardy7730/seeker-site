/* =====================================================================
   SEEKER — « Une alerte, en cinq temps », en 3D.

   Une seule scène, cinq états. Chaque étape de la liste fixe une cible
   (caméra, téléphones, carte, liaisons) et la scène y glisse doucement :
   il n'y a pas de coupe, seulement un mouvement amorti.

     0  le déclenchement   le téléphone, l'appui, l'écran d'alerte active
     1  l'envoi            une onde part du téléphone
     2  la réception       le téléphone du proche, la notification, le SMS
     3  la position        la carte en relief, le point, la liaison
     4  le suivi           tout ensemble, et l'heure qui s'écoule

   Les écrans sont les vraies captures (accueil, page de suivi) ; l'écran
   d'alerte active et la notification reprennent les libellés exacts de
   l'application. Rien n'est envoyé : c'est une illustration.

   Chargé à la demande, quand la section approche de l'écran. La boucle
   s'arrête dès que la scène n'est plus visible.
   ===================================================================== */
export async function start({canvas, host, timer, labels}){
  const THREE = await import('https://unpkg.com/three@0.160.0/build/three.module.js');
  const small = matchMedia('(max-width:900px)').matches;

  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070c14, 6.2, 12.5);
  const camera = new THREE.PerspectiveCamera(32, 1.25, 0.1, 40);

  const GOLD = 0xc9a961, GOLD_BRIGHT = 0xe4c77a, GOLD_PALE = 0xf0dca0;

  /* ---------- lumière : une clé chaude, un contre-jour doré, et un ciel
     dessiné qui donne leurs reflets aux téléphones ---------- */
  (function(){
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#1b2740'); g.addColorStop(0.5, '#0a1120'); g.addColorStop(1, '#04070d');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    const w = x.createRadialGradient(60, 30, 2, 60, 30, 70);
    w.addColorStop(0, 'rgba(255,236,190,0.95)'); w.addColorStop(1, 'rgba(255,236,190,0)');
    x.fillStyle = w; x.fillRect(0, 0, 256, 128);
    const k = x.createRadialGradient(190, 44, 2, 190, 44, 50);
    k.addColorStop(0, 'rgba(160,185,235,0.55)'); k.addColorStop(1, 'rgba(160,185,235,0)');
    x.fillStyle = k; x.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
    scene.environment = t;
  })();
  scene.add(new THREE.HemisphereLight(0x8fa3c8, 0x05080f, 0.5));
  const key = new THREE.DirectionalLight(0xfff0d0, 1.7); key.position.set(-3, 4.5, 5); scene.add(key);
  const rim = new THREE.PointLight(GOLD_BRIGHT, 9, 14); rim.position.set(2.8, 1.6, 2.2); scene.add(rim);

  /* ---------- écrans ---------- */
  const SCR_W = 540, SCR_H = 1096;
  const INK = '#eef1f6', SILVER = '#aab3c2', DIM = '#8b93a3', LINE = 'rgba(238,241,246,0.11)';
  const SANS = '"Inter",system-ui,sans-serif', MONO = '"IBM Plex Mono",ui-monospace,monospace';
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  function screenTex(draw){
    const c = document.createElement('canvas'); c.width = SCR_W; c.height = SCR_H;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    const paint = () => { draw(c.getContext('2d')); t.needsUpdate = true; };
    paint();
    return {t, paint};
  }
  const img = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  function rr(x, a, b, w, h, r){ x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function wrap(x, text, a, b, max, lh){
    let line = '', y = b;
    text.split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if(x.measureText(t).width > max && line){ x.fillText(line, a, y); line = w; y += lh; } else line = t; });
    if(line) x.fillText(line, a, y);
    return y;
  }
  const spaced = (x, v) => { try{ x.letterSpacing = v; }catch(e){} };

  const [imgHome, imgTrack, imgLogo] = await Promise.all([img('assets/app-alerte.jpg'), img('assets/app-suivi.jpg'), img('assets/logo-512.png')]);

  const tHome = screenTex(x => {
    x.fillStyle = '#070c14'; x.fillRect(0, 0, SCR_W, SCR_H);
    if(imgHome) x.drawImage(imgHome, 0, imgHome.height - SCR_H * imgHome.width / SCR_W, imgHome.width, SCR_H * imgHome.width / SCR_W, 0, 0, SCR_W, SCR_H);
  });
  const tTrack = screenTex(x => {
    x.fillStyle = '#070b13'; x.fillRect(0, 0, SCR_W, SCR_H);
    if(imgTrack) x.drawImage(imgTrack, 0, 0, SCR_W, SCR_W * imgTrack.height / imgTrack.width);
  });
  const tOff = screenTex(x => { x.fillStyle = '#05080f'; x.fillRect(0, 0, SCR_W, SCR_H); });
  /* L'écran d'alerte active : mêmes libellés que dans l'application. */
  const tAlert = screenTex(x => {
    x.fillStyle = '#070c14'; x.fillRect(0, 0, SCR_W, SCR_H);
    x.textBaseline = 'middle';
    x.fillStyle = '#e4c77a'; x.beginPath(); x.arc(44, 180, 7, 0, 6.283); x.fill();
    x.font = '600 19px ' + MONO; spaced(x, '2.5px'); x.textAlign = 'left'; x.fillText('ALERTE ACTIVE', 64, 181);
    spaced(x, '0px'); x.font = '22px ' + MONO; x.fillStyle = INK; x.textAlign = 'right'; x.fillText('00:59:48', 504, 181);
    x.fillStyle = LINE; x.fillRect(36, 218, 468, 1);
    [['Mes protecteurs', '1', INK, 264], ['Position partagée', 'En direct', '#e4c77a', 340]].forEach(m => {
      x.font = '21px ' + SANS; x.fillStyle = SILVER; x.textAlign = 'left'; x.fillText(m[0], 36, m[3]);
      x.font = '20px ' + MONO; x.fillStyle = m[2]; x.textAlign = 'right'; x.fillText(m[1], 504, m[3]);
      x.fillStyle = 'rgba(238,241,246,0.06)'; x.fillRect(36, m[3] + 36, 468, 1);
    });
    x.font = '17px ' + SANS; x.fillStyle = DIM; x.textAlign = 'left';
    wrap(x, 'Envoyez le SMS ci-dessous pour prévenir vos proches et leur transmettre votre lien de suivi.', 36, 418, 468, 26);
    [['ENVOYER MA POSITION PAR SMS', '#e4c77a', '#1a1408', 816, false],
     ['PROLONGER DE 30 MIN', '#101a2e', INK, 894, true],
     ['JE SUIS EN SÉCURITÉ — TERMINER', '#c9a961', '#1a1408', 972, false]].forEach(b => {
      rr(x, 36, b[3], 468, 62, 3); x.fillStyle = b[1]; x.fill();
      if(b[4]){ x.strokeStyle = LINE; x.lineWidth = 1; x.stroke(); }
      x.font = '600 15px ' + MONO; spaced(x, '1.2px'); x.fillStyle = b[2]; x.textAlign = 'center'; x.fillText(b[0], 270, b[3] + 32);
      spaced(x, '0px');
    });
  });
  /* Ce que reçoit un proche : la notification (titre et texte réels), ou le
     SMS que l'on envoie depuis l'écran d'alerte, avec le lien de suivi. */
  const tNotif = screenTex(x => {
    x.fillStyle = '#05080f'; x.fillRect(0, 0, SCR_W, SCR_H);
    x.textBaseline = 'middle'; x.textAlign = 'left';
    rr(x, 28, 250, 484, 152, 22); x.fillStyle = '#141d30'; x.fill(); x.strokeStyle = LINE; x.lineWidth = 1; x.stroke();
    if(imgLogo) x.drawImage(imgLogo, 50, 272, 28, 28);
    x.font = '14px ' + SANS; spaced(x, '1.4px'); x.fillStyle = DIM; x.fillText('SEEKER', 88, 287);
    spaced(x, '0px'); x.textAlign = 'right'; x.fillText('maintenant', 490, 287);
    x.textAlign = 'left'; x.font = '600 21px ' + SANS; x.fillStyle = INK; x.fillText('🔴 Simon est en danger', 50, 334);
    x.font = '17.5px ' + SANS; x.fillStyle = SILVER; x.fillText('Ouvrez Seeker pour suivre sa position en direct.', 50, 368);
    x.font = '13px ' + MONO; spaced(x, '2px'); x.fillStyle = DIM; x.textAlign = 'center'; x.fillText("OU, SANS L'APPLICATION", 270, 478);
    spaced(x, '0px'); x.textAlign = 'left';
    rr(x, 28, 514, 440, 168, 24); x.fillStyle = '#1b2640'; x.fill();
    x.font = '18px ' + SANS; x.fillStyle = INK;
    const y = wrap(x, "🔴 Alerte Seeker : j'ai besoin que tu saches où je suis. Suis ma position en direct :", 50, 548, 396, 27);
    x.fillStyle = '#e4c77a'; x.fillText('myseekerapp.be/track', 50, y + 27);
    x.fillRect(50, y + 39, x.measureText('myseekerapp.be/track').width, 1);
  });
  /* Les polices du site arrivent parfois après la scène : on repeint alors. */
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { tAlert.paint(); tNotif.paint(); });

  /* ---------- téléphones ---------- */
  function rrShape(w, h, r){
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const SW = 0.93, SH = SW * SCR_H / SCR_W, BW = 1.0, BH = SH + 0.07;
  const bodyGeo = new THREE.ExtrudeGeometry(rrShape(BW, BH, 0.15), {depth:0.07, bevelEnabled:true, bevelThickness:0.014, bevelSize:0.014, bevelSegments:4, curveSegments:18});
  bodyGeo.translate(0, 0, -0.035);
  const scrGeo = new THREE.ShapeGeometry(rrShape(SW, SH, 0.115), 18);
  (function(){ const p = scrGeo.attributes.position, uv = scrGeo.attributes.uv;
    for(let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + SW / 2) / SW, (p.getY(i) + SH / 2) / SH); uv.needsUpdate = true; })();
  const bodyMat = new THREE.MeshStandardMaterial({color:0x1c2538, metalness:0.9, roughness:0.3, envMapIntensity:1.25});
  const glassMat = new THREE.MeshStandardMaterial({color:0xffffff, metalness:1, roughness:0.06, transparent:true, opacity:0.07, envMapIntensity:2.2, depthWrite:false});

  function makePhone(first){
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, bodyMat));
    const base = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({map:first, toneMapped:false}));
    base.position.z = 0.0495; g.add(base);
    const top = new THREE.Mesh(scrGeo, new THREE.MeshBasicMaterial({map:first, toneMapped:false, transparent:true, opacity:0, depthWrite:false}));
    top.position.z = 0.0502; g.add(top);
    const glass = new THREE.Mesh(scrGeo, glassMat); glass.position.z = 0.0509; g.add(glass);
    const api = {group:g, cur:first, fade:0, fading:false,
      show(t, instant){
        if(api.cur === t) return; api.cur = t;
        if(instant){ base.material.map = t; top.material.opacity = 0; api.fading = false; return; }
        top.material.map = t; api.fade = 0; api.fading = true;
      },
      tick(dt){
        if(!api.fading) return;
        api.fade = Math.min(1, api.fade + dt / 0.75);
        top.material.opacity = api.fade * api.fade * (3 - 2 * api.fade);
        if(api.fade >= 1){ base.material.map = top.material.map; top.material.opacity = 0; api.fading = false; }
      }};
    return api;
  }
  const A = makePhone(tHome.t), B = makePhone(tOff.t);
  scene.add(A.group, B.group);

  /* l'appui sur le bouton d'alerte, à son emplacement réel dans la capture */
  const press = new THREE.Mesh(new THREE.RingGeometry(0.168, 0.182, 56), new THREE.MeshBasicMaterial({color:GOLD_BRIGHT, transparent:true, opacity:0, depthWrite:false, toneMapped:false}));
  press.position.set(0, SH / 2 - 0.256 * SH, 0.052); A.group.add(press);

  /* ---------- la carte en relief ---------- */
  const map = new THREE.Group(); map.position.y = -1.35; scene.add(map);
  const MW = 10, MD = 6.6;
  const hgt = (x, z) => 0.13 * Math.sin(x * 0.9 + 0.6) * Math.cos(z * 1.15 - 0.3) + 0.06 * Math.sin(x * 2.3 + z * 1.7) + 0.05 * Math.cos(z * 2.9 - x * 0.7);
  const mapMats = [];
  const fadeMat = m => { m.transparent = true; m.userData.o = m.opacity; mapMats.push(m); return m; };

  const terr = new THREE.PlaneGeometry(MW, MD, small ? 44 : 72, small ? 30 : 48); terr.rotateX(-Math.PI / 2);
  (function(){ const p = terr.attributes.position; for(let i = 0; i < p.count; i++) p.setY(i, hgt(p.getX(i), p.getZ(i))); terr.computeVertexNormals(); })();
  map.add(new THREE.Mesh(terr, fadeMat(new THREE.MeshStandardMaterial({color:0x0f1a33, roughness:0.92, metalness:0.05, flatShading:true, envMapIntensity:0.35}))));
  const grid = new THREE.LineSegments(new THREE.WireframeGeometry(terr), fadeMat(new THREE.LineBasicMaterial({color:GOLD_BRIGHT, opacity:0.035})));
  grid.position.y = 0.002; map.add(grid);

  const roadPts = [];
  function road(pts, major){
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], 0, p[1])));
    const n = 90, arr = [];
    for(let i = 0; i <= n; i++){ const v = curve.getPoint(i / n); v.y = hgt(v.x, v.z) + 0.014; arr.push(v); roadPts.push(v); }
    const c3 = new THREE.CatmullRomCurve3(arr);
    if(major) map.add(new THREE.Mesh(new THREE.TubeGeometry(c3, 90, 0.024, 5), fadeMat(new THREE.MeshStandardMaterial({color:0x3a4868, roughness:0.7, emissive:0x1a2238, emissiveIntensity:0.6}))));
    else map.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr), fadeMat(new THREE.LineBasicMaterial({color:0x4a5878, opacity:0.75}))));
  }
  road([[-5, -0.7], [-2.4, -0.25], [0, 0.3], [2.2, 0.05], [5, -0.9]], true);
  road([[-1.3, -3.3], [-0.7, -1.3], [0, 0.3], [0.55, 1.7], [0.3, 3.3]], true);
  road([[-5, 1.7], [-2.6, 1.35], [-1.1, 0.95], [0, 0.3]], false);
  road([[2.5, -3.3], [1.9, -1.6], [2.2, 0.05]], false);
  road([[1.9, 3.3], [2.5, 1.5], [5, 1.05]], false);
  road([[-3.4, -3.3], [-3.0, -1.6], [-2.4, -0.25]], false);
  (function(){ const pts = []; for(let i = 0; i <= 40; i++){ const a = i / 40 * 6.283, x = Math.cos(a) * 0.24, z = 0.3 + Math.sin(a) * 0.24; pts.push(new THREE.Vector3(x, hgt(x, z) + 0.016, z)); }
    map.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), fadeMat(new THREE.LineBasicMaterial({color:0x6a789a, opacity:0.9})))); })();

  const PIN = new THREE.Vector3(-1.1, 0, 0.95); PIN.y = hgt(PIN.x, PIN.z);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  (function(){
    const N = small ? 90 : 190, box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(box, fadeMat(new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.75, metalness:0.15, envMapIntensity:0.5})), N);
    const d = new THREE.Object3D(), col = new THREE.Color(); let k = 0, guard = 0;
    while(k < N && guard++ < 6000){
      const x = (rnd() - 0.5) * (MW - 0.8), z = (rnd() - 0.5) * (MD - 0.6);
      if(roadPts.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 0.05)) continue;
      if((PIN.x - x) ** 2 + (PIN.z - z) ** 2 < 0.12) continue;
      d.position.set(x, hgt(x, z) - 0.02, z);
      d.scale.set(0.12 + rnd() * 0.2, 0.05 + rnd() * rnd() * 0.42, 0.12 + rnd() * 0.2);
      d.rotation.y = (rnd() - 0.5) * 0.7; d.updateMatrix(); mesh.setMatrixAt(k, d.matrix);
      mesh.setColorAt(k, col.set(rnd() < 0.07 ? 0x5a4c2c : 0x16223f)); k++;
    }
    mesh.count = k; map.add(mesh);
    const lp = []; for(let i = 0; i < (small ? 26 : 46); i++){ const p = roadPts[Math.floor(rnd() * roadPts.length)]; lp.push(p.x + (rnd() - 0.5) * 0.1, p.y + 0.03, p.z + (rnd() - 0.5) * 0.1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    map.add(new THREE.Points(g, fadeMat(new THREE.PointsMaterial({color:GOLD_PALE, size:0.05, opacity:0.85, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}))));
  })();

  /* le point : la personne qui a déclenché l'alerte */
  const pin = new THREE.Group(); pin.position.copy(PIN); map.add(pin);
  const pinDot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), new THREE.MeshBasicMaterial({color:0xfff3cf, transparent:true, toneMapped:false}));
  pinDot.position.y = 0.07; pin.add(pinDot);
  const pinRings = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 56), new THREE.MeshBasicMaterial({color:GOLD_BRIGHT, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, toneMapped:false}));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.03; pin.add(r); return r; });
  const hourRing = new THREE.Mesh(new THREE.RingGeometry(0.50, 0.52, 72, 1, 0, 6.283), new THREE.MeshBasicMaterial({color:GOLD, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, toneMapped:false}));
  hourRing.rotation.x = -Math.PI / 2; hourRing.position.y = 0.035; pin.add(hourRing);

  /* ---------- liaisons lumineuses ---------- */
  function makeLink(){
    const N = 48, pos = new Float32Array((N + 1) * 3), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({color:GOLD_BRIGHT, transparent:true, opacity:0, depthTest:false, toneMapped:false}));
    line.frustumCulled = false; line.renderOrder = 5; scene.add(line);
    const dots = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshBasicMaterial({color:0xfff3cf, transparent:true, opacity:0, depthTest:false, toneMapped:false}));
      m.renderOrder = 6; scene.add(m); return m; });
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()), v = new THREE.Vector3();
    return {s:0, set(a, b, lift, t){
      curve.v0.copy(a); curve.v2.copy(b); curve.v1.copy(a).add(b).multiplyScalar(0.5); curve.v1.y += lift; curve.v1.z += 0.3;
      for(let i = 0; i <= N; i++){ curve.getPoint(i / N, v); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; }
      g.attributes.position.needsUpdate = true;
      line.material.opacity = this.s * 0.75; line.visible = this.s > 0.01;
      dots.forEach((d, k) => { const p = (t * 0.33 + k / 3) % 1; curve.getPoint(p, d.position); d.material.opacity = this.s * Math.sin(p * Math.PI); d.visible = this.s > 0.01; });
    }};
  }
  const linkAB = makeLink(), linkPB = makeLink();

  /* l'onde de l'envoi */
  const waves = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), new THREE.MeshBasicMaterial({color:GOLD_BRIGHT, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, toneMapped:false}));
    scene.add(m); return m; });

  /* ---------- les cinq états ---------- */
  let aspect = 1.25, portrait = false;
  function target(i){
    const kx = portrait ? 0.6 : 1, kz = portrait ? 0.74 : 1;
    const S = [
      {cam:[0, 0.22, 4.25], look:[0, 0.12, 0], a:[0, 0.12, 0, 0.05, -0.34, 1], b:[2.9, 0.25, -1.6, 0, -0.9, 0.001], map:0.2, mapY:-1.55, ab:0, pb:0, wave:0, pin:0},
      {cam:[0, 0.3, 5.1], look:[0, 0.12, 0], a:[0, 0.12, 0, 0.03, -0.16, 1], b:[2.9, 0.25, -1.6, 0, -0.9, 0.001], map:0.26, mapY:-1.5, ab:0, pb:0, wave:1, pin:0},
      {cam:[0, 0.34, 5.7], look:[0, 0.12, 0], a:[-1.27 * kx, 0.12, 0, 0.03, 0.4, 1], b:[1.27 * kx, 0.12, 0, 0.03, -0.4, 1], map:0.3, mapY:-1.45, ab:1, pb:0, wave:0, pin:0},
      {cam:[0.1, 2.5, 5.7], look:[0, -0.62, 0.1], a:[-1.1 * kx - (portrait ? 0.35 : 0), 0.72, 0.6, -0.3, 0.3, 0.6], b:[1.55 * kx, 0.42, 0.75, -0.26, -0.44, 0.95], map:1, mapY:-1.35, ab:0, pb:1, wave:0, pin:1},
      {cam:[0, 1.85, 6.5], look:[0, -0.3, 0], a:[-1.4 * kx, 0.6, 0.35, -0.2, 0.36, 0.74], b:[1.5 * kx, 0.5, 0.5, -0.2, -0.42, 0.9], map:1, mapY:-1.35, ab:0.55, pb:1, wave:0, pin:1}
    ][i];
    return Object.assign({}, S, {cam:[S.cam[0], S.cam[1], S.cam[2] * kz]});
  }
  let step = 0, since = 0, cur = target(0), tgt = cur;
  const lookV = new THREE.Vector3(...cur.look);
  const mix = (a, b, k) => a + (b - a) * k;
  function blend(k){
    ['cam', 'look', 'a', 'b'].forEach(n => { cur[n] = cur[n].map((v, i) => mix(v, tgt[n][i], k)); });
    ['map', 'mapY', 'ab', 'pb', 'wave', 'pin'].forEach(n => { cur[n] = mix(cur[n], tgt[n], k); });
  }
  function screens(instant){
    /* étape 0 : la capture d'accueil d'abord, l'alerte active après l'appui */
    A.show(step === 0 && since < 2.6 ? tHome.t : tAlert.t, instant);
    B.show(step < 2 ? tOff.t : (step === 2 ? (since > 1.3 ? tNotif.t : tOff.t) : tTrack.t), instant);
  }
  function go(i){
    step = Math.max(0, Math.min(4, i | 0)); since = 0; tgt = target(step);
    if(step === 0) A.show(tHome.t);
    if(timer){ timer.classList.toggle('on', step === 4); left = 3600; paintTimer(); }
  }
  let left = 3600;
  function paintTimer(){ if(!timer) return; const b = timer.querySelector('b'); if(b) b.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(Math.floor(left % 60)).padStart(2, '0'); }

  /* ---------- taille ---------- */
  const box = canvas.parentElement;
  function resize(){
    const w = box.clientWidth, h = box.clientHeight; if(!w || !h) return;
    renderer.setSize(w, h, false);
    aspect = w / h; portrait = aspect < 1;
    camera.aspect = aspect;
    /* le champ horizontal est constant : la scène tient en largeur sur tous les écrans */
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) / aspect));
    camera.updateProjectionMatrix();
    tgt = target(step);
  }
  if('ResizeObserver' in window) new ResizeObserver(resize).observe(box); else addEventListener('resize', resize);
  resize(); cur = target(step); tgt = cur;

  /* ---------- un très léger parallaxe à la souris ---------- */
  let px = 0, py = 0, mx = 0, my = 0;
  if(matchMedia('(hover: hover) and (pointer: fine)').matches){
    box.addEventListener('pointermove', e => { const r = box.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; });
    box.addEventListener('pointerleave', () => { mx = 0; my = 0; });
  }

  /* ---------- étiquettes « Vous » / « Votre proche » ---------- */
  const pv = new THREE.Vector3();
  function label(el, phone, sc, show){
    if(!el) return;
    pv.set(0, -BH / 2 - 0.16, 0).multiplyScalar(sc).add(phone.group.position).project(camera);
    el.style.transform = 'translate(-50%,0) translate(' + ((pv.x * 0.5 + 0.5) * box.clientWidth).toFixed(1) + 'px,' + ((-pv.y * 0.5 + 0.5) * box.clientHeight).toFixed(1) + 'px)';
    el.style.opacity = show ? 1 : 0;
  }

  /* ---------- la boucle ---------- */
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  let running = false, raf = 0, last = 0, time = 0;
  function frame(now){
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; time += dt; since += dt;
    blend(1 - Math.exp(-dt * 2.6));
    screens(false); A.tick(dt); B.tick(dt);

    px = mix(px, mx, 0.05); py = mix(py, my, 0.05);
    camera.position.set(cur.cam[0] + Math.sin(time * 0.23) * 0.07 + px * 0.35, cur.cam[1] + Math.cos(time * 0.19) * 0.04 - py * 0.2, cur.cam[2]);
    lookV.set(cur.look[0], cur.look[1], cur.look[2]); camera.lookAt(lookV);

    A.group.position.set(cur.a[0], cur.a[1] + Math.sin(time * 0.8) * 0.012, cur.a[2]); A.group.rotation.set(cur.a[3], cur.a[4], 0); A.group.scale.setScalar(cur.a[5]);
    B.group.position.set(cur.b[0], cur.b[1] + Math.sin(time * 0.8 + 1.7) * 0.012, cur.b[2]); B.group.rotation.set(cur.b[3], cur.b[4], 0); B.group.scale.setScalar(cur.b[5]);
    B.group.visible = cur.b[5] > 0.02;

    /* l'appui : deux pulsations, puis l'écran d'alerte */
    if(step === 0 && since < 2.5){ const p = (since % 1.25) / 1.25; press.scale.setScalar(0.9 + p * 0.6); press.material.opacity = (1 - p) * 0.95; } else press.material.opacity = 0;

    map.position.y = cur.mapY;
    mapMats.forEach(m => { m.opacity = m.userData.o * cur.map; });
    pinDot.material.opacity = cur.pin; pinDot.scale.setScalar(0.6 + cur.pin * 0.4);
    pinRings.forEach((r, k) => { const p = (time * 0.42 + k / 2) % 1; r.scale.setScalar(0.08 + p * 0.62); r.material.opacity = cur.pin * (1 - p) * 0.8; });
    hourRing.material.opacity = (step === 4 ? cur.pin : 0) * 0.9;

    waves.forEach((w, k) => { const p = (time * 0.36 + k / 3) % 1; w.position.set(cur.a[0], cur.a[1], cur.a[2] - 0.25); w.quaternion.copy(camera.quaternion); w.scale.setScalar(0.75 + p * 3.1); w.material.opacity = cur.wave * Math.pow(1 - p, 1.6) * 0.75; w.visible = cur.wave > 0.01; });

    linkAB.s = cur.ab * (B.group.visible ? 1 : 0); linkPB.s = cur.pb;
    /* la liaison part du bord d'un téléphone et arrive au bord de l'autre : elle ne masque pas les écrans */
    const dir = cur.b[0] >= cur.a[0] ? 1 : -1;
    va.copy(A.group.position); va.x += dir * 0.46 * cur.a[5]; vb.copy(B.group.position); vb.x -= dir * 0.46 * cur.b[5]; linkAB.set(va, vb, 0.95, time);
    va.copy(PIN).add(map.position); va.y += 0.08; vb.copy(B.group.position); vb.y -= BH / 2 * cur.b[5] * 0.82; linkPB.set(va, vb, 1.05, time + 0.4);

    if(step === 4 && timer){ const before = Math.floor(left); left = Math.max(0, left - dt); if(Math.floor(left) !== before) paintTimer(); }
    if(labels){ label(labels[0], A, cur.a[5], true); label(labels[1], B, cur.b[5], cur.b[5] > 0.5); }

    renderer.render(scene, camera);
    if(running) raf = requestAnimationFrame(frame);
  }
  function setRunning(on){
    on = on && !document.hidden;
    if(on === running) return; running = on;
    if(on){ last = performance.now(); if(!raf) raf = requestAnimationFrame(frame); }
  }
  let visible = false;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; setRunning(visible); }, {rootMargin:'80px'}).observe(box);
  document.addEventListener('visibilitychange', () => setRunning(visible));
  document.addEventListener('seeker:step', e => go(e.detail));

  go(parseInt(host.getAttribute('data-at') || '0', 10)); cur = target(step); screens(true);
  last = performance.now(); frame(last);   /* une première image, avant d'afficher la scène */
  /* pour les contrôles : avancer la scène de n secondes sans attendre l'horloge */
  window.__seekerScene = {advance(sec){ const keep = running; running = false; for(let i = 0, n = Math.round(sec * 30); i < n; i++) frame(last + 33.3); running = keep; if(keep && !raf) raf = requestAnimationFrame(frame); }};
  return true;
}
