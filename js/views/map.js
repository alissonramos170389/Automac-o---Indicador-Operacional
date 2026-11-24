/* ==========================================================================
   TELA 2 — MAPA DE OCORRÊNCIAS (Leaflet + OpenStreetMap, sem chave de API)
   ========================================================================== */
IOA.views.mapa = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui, D = IOA.details;

  const LAYERS = [
    { id: 'partners', label: 'Conveniados Abastece', color: '#0E9F6E' },
    { id: 'telecom_movel', label: 'Conectividade móvel', color: '#2563EB' },
    { id: 'telecom_fixa', label: 'Conectividade Fibra/ADSL', color: '#0891B2' },
    { id: 'energia', label: 'Quedas de energia', color: '#D97706' },
    { id: 'clima', label: 'Chuva e tempestades', color: '#7C3AED' },
    { id: 'incidents', label: 'Incidentes ServiceNow', color: '#16284A' },
    { id: 'affected', label: 'Potencialmente afetados', color: '#D92D20' }
  ];
  const local = {
    on: { partners: true, telecom_movel: true, telecom_fixa: true, energia: true, clima: true, incidents: true, affected: true },
    status: { online: true, degradado: true, offline: true },
    clusterPx: 50, nearKm: 0, onlyNear: false
  };
  let map = null, groups = {}, lastFitKey = null;

  function statusColor(s) { return s === 'offline' ? '#D92D20' : s === 'degradado' ? '#C27803' : '#0E9F6E'; }

  function partnerIcon(p, affected) {
    return L.divIcon({ className: '', html: `<div class="pin ${p.operational_status} ${affected ? 'affected' : ''}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
  }

  function clusterIcon(cluster) {
    const ms = cluster.getAllChildMarkers();
    const off = ms.filter((m) => m.options.status === 'offline').length;
    const deg = ms.filter((m) => m.options.status === 'degradado').length;
    const n = ms.length;
    const color = off >= 3 || off / n > 0.3 ? '#D92D20' : off || deg ? '#C27803' : '#0E9F6E';
    const size = n < 10 ? 30 : n < 50 ? 36 : 44;
    return L.divIcon({ className: '', html: `<div class="mc" style="width:${size}px;height:${size}px;background:${color}" title="${n} conveniados · ${off} offline">${n}</div>`, iconSize: [size, size] });
  }

  function render(el, params) {
    if (params && params.onlyOffline) { local.status = { online: false, degradado: true, offline: true }; }
    el.innerHTML = `
      <div class="map-layout">
        <div class="card map-panel">
          <div class="card-head"><h3>Camadas</h3><span class="badge sim" style="margin-left:auto">simulado</span></div>
          <div class="card-body" id="layerBox"></div>
          <div class="card-head" style="border-top:1px solid var(--border)"><h3>Status dos conveniados</h3></div>
          <div class="card-body" id="statusBox"></div>
          <div class="card-head" style="border-top:1px solid var(--border)"><h3>Distância e agrupamento</h3></div>
          <div class="card-body">
            <label class="small muted">Agrupar conveniados num raio de <b id="clusterVal">${local.clusterPx}</b> px</label>
            <div class="range-row"><input type="range" id="clusterPx" min="0" max="120" step="10" value="${local.clusterPx}"></div>
            <label class="small muted" style="margin-top:6px">Tolerância além do raio do evento: <b id="nearVal">${local.nearKm}</b> km</label>
            <div class="range-row"><input type="range" id="nearKm" min="0" max="50" step="5" value="${local.nearKm}"></div>
            <label class="toggle" style="margin-top:4px"><input type="checkbox" id="onlyNear" ${local.onlyNear ? 'checked' : ''}> Só conveniados dentro da área de eventos ativos</label>
          </div>
          <div class="card-body" id="mapStats" style="border-top:1px solid var(--border)"></div>
        </div>
        <div class="map-wrap">
          <div id="map"></div>
          <div class="map-sim">${ui.sim('DADOS SIMULADOS')}</div>
          <div class="map-legend">
            <div><i style="background:#0E9F6E"></i>Online <i style="background:#C27803;margin-left:8px"></i>Degradado <i style="background:#D92D20;margin-left:8px"></i>Offline</div>
            <div><i style="background:#2563EB33;border:1.5px solid #2563EB"></i>Móvel <i style="background:#0891B233;border:1.5px solid #0891B2;margin-left:8px"></i>Fixa <i style="background:#D9770633;border:1.5px solid #D97706;margin-left:8px"></i>Energia <i style="background:#7C3AED33;border:1.5px solid #7C3AED;margin-left:8px"></i>Clima</div>
            <div class="muted">Contorno tracejado = previsão (não observado)</div>
          </div>
        </div>
      </div>`;

    if (!window.L) { el.querySelector('.map-wrap').innerHTML = ui.empty('Mapa indisponível', 'A biblioteca Leaflet não foi carregada.', 'alert'); return; }
    map = L.map('map', { zoomControl: true, preferCanvas: false, minZoom: 3 }).setView([-14.5, -51], 4);
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, subdomains: 'abc', attribution: '&copy; colaboradores do OpenStreetMap' }).addTo(map);
    let tileErr = 0;
    tiles.on('tileerror', () => { if (++tileErr === 4) ui.toast('Sem acesso aos mapas do OpenStreetMap: marcadores continuam funcionando.'); });
    lastFitKey = null;

    el.querySelector('#clusterPx').addEventListener('input', (e) => { local.clusterPx = +e.target.value; el.querySelector('#clusterVal').textContent = local.clusterPx; });
    el.querySelector('#clusterPx').addEventListener('change', () => draw(el));
    el.querySelector('#nearKm').addEventListener('input', (e) => { local.nearKm = +e.target.value; el.querySelector('#nearVal').textContent = local.nearKm; });
    el.querySelector('#nearKm').addEventListener('change', () => draw(el));
    el.querySelector('#onlyNear').addEventListener('change', (e) => { local.onlyNear = e.target.checked; draw(el); });
    draw(el);
    setTimeout(() => map && map.invalidateSize(), 50);
  }

  function draw(el) {
    const v = S.view();
    Object.values(groups).forEach((g) => map.removeLayer(g));
    groups = {};

    const now = S.state.data.now;
    const evs = v.events.filter((e) => e.realtime !== false && (e.event_status !== 'resolvido' || Date.parse(e.end_time) > now - 12 * 3600000));
    const activeEvs = evs.filter((e) => e.event_status !== 'resolvido' && e.evidence_type !== 'previsao');
    const affectedSet = new Set(evs.flatMap((e) => S.impact(e.event_id).affected));
    v.occurrences.filter((o) => o.regional && o.rule !== 'R5' && o.status !== 'resolvido').forEach((o) => o.partners.forEach((c) => affectedSet.add(c)));
    const nearActive = (p) => activeEvs.some((e) => U.haversineKm(p.latitude, p.longitude, e.latitude, e.longitude) <= e.affected_radius + local.nearKm);
    const parts = v.partners.filter((p) => local.status[p.operational_status] && (!local.onlyNear || nearActive(p)));

    // 1. Conveniados (cluster)
    const cl = L.markerClusterGroup({ maxClusterRadius: Math.max(1, local.clusterPx), disableClusteringAtZoom: local.clusterPx === 0 ? 1 : 15, iconCreateFunction: clusterIcon, showCoverageOnHover: false, spiderfyOnMaxZoom: true, chunkedLoading: true });
    parts.forEach((p) => {
      const m = L.marker([p.latitude, p.longitude], { icon: partnerIcon(p, affectedSet.has(p.partner_code) && local.on.affected), status: p.operational_status, title: p.partner_code + ' · ' + p.partner_name });
      m.on('click', () => D.openPartner(p.partner_code));
      m.bindTooltip(`<b>${p.partner_code}</b> ${U.esc(p.partner_name)}<br>${U.esc(p.city)}/${p.state} · ${p.telecom_operator} ${p.connectivity_type}`, { direction: 'top', offset: [0, -6] });
      cl.addLayer(m);
    });
    groups.partners = cl;

    // 2–5. Eventos externos
    ['telecom_movel', 'telecom_fixa', 'energia', 'clima'].forEach((cat) => {
      const g = L.layerGroup();
      evs.filter((e) => e.category === cat).forEach((e) => {
        const color = ui.CAT_COLOR[cat];
        const forecast = e.evidence_type === 'previsao';
        const resolved = e.event_status === 'resolvido';
        const c = L.circle([e.latitude, e.longitude], { radius: e.affected_radius * 1000, color, weight: forecast ? 1.5 : 2, dashArray: forecast || resolved ? '6 5' : null, fillColor: color, fillOpacity: resolved ? 0.04 : forecast ? 0.05 : 0.14, opacity: resolved ? 0.5 : 1 });
        c.bindTooltip(`<b>${U.esc(e.title)}</b><br>${R.EVIDENCE[e.evidence_type].label} · ${R.SEVERITIES[e.severity].label}${resolved ? ' · resolvido' : ''}<br><span style="color:#8A5A00">SIMULADO</span>`, { sticky: true });
        c.on('click', (ev) => { L.DomEvent.stopPropagation(ev); D.openEvent(e.event_id); });
        g.addLayer(c);
        g.addLayer(L.circleMarker([e.latitude, e.longitude], { radius: 4, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 1 }).on('click', () => D.openEvent(e.event_id)));
      });
      groups[cat] = g;
    });

    // 6. Incidentes ServiceNow abertos
    const gi = L.layerGroup();
    const openInc = U.groupBy(v.incidents.filter((i) => i.status !== 'resolvido'), (i) => i.partner_code);
    openInc.forEach((list, code) => {
      const p = S.partner(code);
      if (!local.status[p.operational_status]) return;
      const m = L.marker([p.latitude, p.longitude], { icon: L.divIcon({ className: '', html: `<div class="inc-pin" title="${list.length} incidente(s)">${list.length}</div>`, iconSize: [16, 16], iconAnchor: [-2, 18] }), zIndexOffset: 500 });
      m.bindTooltip(`${list.length} incidente(s) aberto(s) — ${code}<br>${list.map((i) => i.incident_id + ' · ' + U.esc(i.sn_class)).join('<br>')}`);
      m.on('click', () => D.openPartner(code));
      gi.addLayer(m);
    });
    groups.incidents = gi;

    // 7. Potencialmente afetados (halo)
    const ga = L.layerGroup();
    parts.filter((p) => affectedSet.has(p.partner_code)).forEach((p) => {
      ga.addLayer(L.circleMarker([p.latitude, p.longitude], { radius: 13, color: '#D92D20', weight: 1.5, fillColor: '#D92D20', fillOpacity: 0.08, interactive: false }));
    });
    groups.affected = ga;

    Object.entries(groups).forEach(([k, g]) => { if (local.on[k]) g.addTo(map); });

    // painel de camadas
    const counts = { partners: parts.length, telecom_movel: evs.filter((e) => e.category === 'telecom_movel').length, telecom_fixa: evs.filter((e) => e.category === 'telecom_fixa').length, energia: evs.filter((e) => e.category === 'energia').length, clima: evs.filter((e) => e.category === 'clima').length, incidents: openInc.size, affected: parts.filter((p) => affectedSet.has(p.partner_code)).length };
    el.querySelector('#layerBox').innerHTML = LAYERS.map((l) => `<label class="layer"><input type="checkbox" data-layer="${l.id}" ${local.on[l.id] ? 'checked' : ''}><span class="sw" style="background:${l.color}"></span>${l.label}<span class="n">${counts[l.id]}</span></label>`).join('');
    el.querySelectorAll('[data-layer]').forEach((c) => c.addEventListener('change', () => {
      local.on[c.dataset.layer] = c.checked;
      const g = groups[c.dataset.layer];
      if (c.checked) g.addTo(map); else map.removeLayer(g);
    }));
    const sc = U.groupCount(v.partners, (p) => p.operational_status);
    const sn = (k) => (sc.find((x) => x[0] === k) || [0, 0])[1];
    el.querySelector('#statusBox').innerHTML = [['online', 'Online'], ['degradado', 'Degradado'], ['offline', 'Offline']].map(([k, l]) => `<label class="layer"><input type="checkbox" data-st="${k}" ${local.status[k] ? 'checked' : ''}><span class="sw" style="background:${statusColor(k)}"></span>${l}<span class="n">${sn(k)}</span></label>`).join('');
    el.querySelectorAll('[data-st]').forEach((c) => c.addEventListener('change', () => { local.status[c.dataset.st] = c.checked; draw(el); }));
    el.querySelector('#mapStats').innerHTML = `<div class="small muted">Exibindo <b>${parts.length}</b> de ${v.partners.length} conveniados filtrados · ${evs.length} eventos externos (inclui resolvidos nas últimas 12 h e previsões). ${parts.length === 0 ? '<br><b>Nenhum conveniado</b> com os filtros atuais.' : ''}</div>`;

    // enquadramento conforme filtro geográfico
    const f = S.state.filters;
    const fitKey = [f.uf, f.city, f.partner_code, f.partner_name, f.operator, f.technology].join('|');
    if (fitKey !== lastFitKey) {
      lastFitKey = fitKey;
      if (fitKey.replace(/\|/g, '') && parts.length) map.fitBounds(L.latLngBounds(parts.map((p) => [p.latitude, p.longitude])).pad(0.25), { maxZoom: 12 });
      else if (!fitKey.replace(/\|/g, '')) map.setView([-14.5, -51], 4);
    }
  }

  function update(el) { if (map && el.querySelector('#map')) draw(el); else render(el, {}); }
  function destroy() { if (map) { map.remove(); map = null; groups = {}; } }

  return { subtitle: 'Conveniados, eventos externos e áreas afetadas no território', render, update, destroy };
})();
