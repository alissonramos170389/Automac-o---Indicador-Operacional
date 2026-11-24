/* ==========================================================================
   Shell da aplicação: sidebar, cabeçalho, filtros globais, busca,
   notificações, relógio e roteamento por hash.
   ========================================================================== */
IOA.views = IOA.views || {};

IOA.app = (function () {
  const U = IOA.utils, R = IOA.ref, S = IOA.store, ui = IOA.ui;

  const NAV = [
    { id: 'executiva', label: 'Visão Executiva', icon: 'dashboard', section: 'Monitoramento' },
    { id: 'mapa', label: 'Mapa de Ocorrências', icon: 'map' },
    { id: 'conectividade', label: 'Conectividade', icon: 'antenna', section: 'Domínios' },
    { id: 'energia', label: 'Energia', icon: 'bolt' },
    { id: 'clima', label: 'Eventos Climáticos', icon: 'cloud' },
    { id: 'correlacao', label: 'Correlação de Incidentes', icon: 'link', section: 'Inteligência' },
    { id: 'historico', label: 'Histórico e Relatórios', icon: 'history' },
    { id: 'config', label: 'Configurações e Integrações', icon: 'settings', section: 'Administração' }
  ];

  let current = null, currentId = null, params = {};
  const $ = (s, r) => (r || document).querySelector(s);

  /* ---------------- Montagem do shell ---------------- */
  function shell() {
    const collapsed = (() => { try { return localStorage.getItem('ioa.sidebar') === '1'; } catch (e) { return false; } })();
    document.getElementById('root').innerHTML = `
    <div class="app ${collapsed ? 'collapsed' : ''}" id="app">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">${ui.icon('target')}</div><div class="brand-text"><strong>Inteligência Operacional</strong><span>Abastece · V0 protótipo</span></div></div>
        <nav class="nav" id="nav">${NAV.map((n) => `${n.section ? `<div class="nav-section">${n.section}</div>` : ''}<a href="#/${n.id}" data-nav="${n.id}" title="${n.label}">${ui.icon(n.icon)}<span>${n.label}</span><b class="count hidden" data-count="${n.id}"></b></a>`).join('')}</nav>
        <div class="sidebar-foot"><button class="collapse-btn" id="collapse">${ui.icon('chevron')}<span>Recolher menu</span></button><div class="foot-text" style="margin-top:6px">Fuso: America/Sao_Paulo</div></div>
      </aside>
      <div class="main">
        <header class="header">
          <div class="header-row">
            <div class="page-title"><h1 id="pageTitle">—</h1><span id="pageSub">Eventos externos, conectividade e infraestrutura</span></div>
            <span class="demo-badge" title="Todos os dados exibidos são simulados para demonstração">DEMO · DADOS SIMULADOS</span>
            <div class="header-spacer"></div>
            <div class="search">${ui.icon('search')}<input id="search" type="search" placeholder="Buscar conveniado, cidade, evento, incidente…" autocomplete="off"><div class="search-results hidden" id="searchResults"></div></div>
            <div class="clock"><strong id="clock">--:--:--</strong><span id="today">—</span></div>
            <div class="clock" title="Horário da última carga dos adapters (simulados)"><strong style="font-size:12px"><span class="fresh-dot"></span><span id="lastUpdate">—</span></strong><span>Última atualização</span></div>
            <button class="icon-btn filters-toggle" id="filtersToggle" title="Filtros">${ui.icon('filter')}</button>
            <div style="position:relative"><button class="icon-btn" id="bell" title="Notificações">${ui.icon('bell')}<span class="dot hidden" id="bellDot"></span></button><div class="popover hidden" id="notifPop"></div></div>
            <div class="profile"><div class="avatar">CO</div><div class="profile-text">Operador CCO<span>Perfil demonstração</span></div></div>
          </div>
          <div class="filters collapsed-mobile" id="filters"></div>
        </header>
        <main class="content" id="view"></main>
      </div>
    </div>`;
    $('#collapse').addEventListener('click', () => {
      const app = $('#app'); app.classList.toggle('collapsed');
      try { localStorage.setItem('ioa.sidebar', app.classList.contains('collapsed') ? '1' : '0'); } catch (e) { /* ignore */ }
      setTimeout(() => window.dispatchEvent(new Event('resize')), 220);
    });
    $('#filtersToggle').addEventListener('click', () => $('#filters').classList.toggle('collapsed-mobile'));
    setupSearch();
    setupNotifications();
    tick(); setInterval(tick, 1000);
  }

  function tick() {
    const now = Date.now();
    $('#clock').textContent = U.time(now);
    $('#today').textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: U.TZ, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(now);
    if (S.state.lastUpdate) $('#lastUpdate').textContent = U.hm(S.state.lastUpdate) + ' · ' + U.ago(S.state.lastUpdate, now);
  }

  /* ---------------- Filtros globais ---------------- */
  function renderFilters() {
    const f = S.state.filters, d = S.state.data;
    const ufs = U.uniq(d.partners.map((p) => p.state)).sort();
    const cities = U.uniq(d.partners.filter((p) => !f.uf || p.state === f.uf).map((p) => p.city)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const opt = (v, l, sel) => `<option value="${U.esc(v)}" ${sel === v ? 'selected' : ''}>${U.esc(l)}</option>`;
    const sel = (name, label, options, all) => `<div class="f"><label>${label}</label><select data-f="${name}">${opt('', all || 'Todos', f[name])}${options.map((o) => (Array.isArray(o) ? opt(o[0], o[1], f[name]) : opt(o, o, f[name]))).join('')}</select></div>`;
    const active = Object.keys(S.DEFAULT_FILTERS).filter((k) => f[k] !== S.DEFAULT_FILTERS[k]).length;
    $('#filters').className = 'filters ' + ($('#filters').classList.contains('collapsed-mobile') ? 'collapsed-mobile' : '');
    $('#filters').innerHTML = `
      ${sel('uf', 'UF', ufs.map((u) => [u, u + ' — ' + R.UF_NAMES[u]]), 'Todas')}
      ${sel('city', 'Cidade', cities, 'Todas')}
      <div class="f f-code"><label>Código</label><input data-f="partner_code" value="${U.esc(f.partner_code)}" placeholder="ex.: 02032" inputmode="numeric"></div>
      <div class="f f-name"><label>Conveniado</label><input data-f="partner_name" value="${U.esc(f.partner_name)}" placeholder="Nome"></div>
      ${sel('technology', 'Tecnologia', R.TECHNOLOGIES, 'Todas')}
      ${sel('operator', 'Operadora', R.OPERATORS, 'Todas')}
      ${sel('category', 'Categoria de evento', Object.entries(R.EVENT_CATEGORIES).map(([k, v]) => [k, v.label]), 'Todas')}
      ${sel('severity', 'Severidade', Object.entries(R.SEVERITIES).map(([k, v]) => [k, v.label]), 'Todas')}
      ${sel('inc_status', 'Status do incidente', Object.entries(R.INCIDENT_STATUS).map(([k, v]) => [k, v]), 'Todos')}
      <div class="f"><label>Período</label><select data-f="date_preset">${[['24h', 'Últimas 24 h'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['90d', 'Últimos 90 dias'], ['12m', 'Últimos 12 meses'], ['custom', 'Personalizado']].map((o) => opt(o[0], o[1], f.date_preset)).join('')}</select></div>
      ${f.date_preset === 'custom' ? `<div class="f"><label>De</label><input type="date" data-f="date_from" value="${f.date_from}"></div><div class="f"><label>Até</label><input type="date" data-f="date_to" value="${f.date_to}"></div>` : ''}
      <div class="f f-actions">${active ? `<span class="active-count">${active} filtro(s) ativo(s)</span>` : ''}<button class="btn-ghost-dark" id="clearFilters">Limpar</button></div>`;
    $('#filters').querySelectorAll('select[data-f]').forEach((s) => s.addEventListener('change', () => {
      const patch = { [s.dataset.f]: s.value };
      if (s.dataset.f === 'date_preset' && s.value === 'custom' && !f.date_from) { patch.date_from = U.isoDateSP(d.now - 7 * 86400000); patch.date_to = U.isoDateSP(d.now); }
      S.setFilters(patch);
    }));
    $('#filters').querySelectorAll('input[data-f]').forEach((i) => {
      const apply = () => S.setFilters({ [i.dataset.f]: i.value });
      if (i.type === 'date') i.addEventListener('change', apply);
      else i.addEventListener('input', U.debounce(apply, 350));
    });
    $('#clearFilters').addEventListener('click', () => S.resetFilters());
  }

  /* ---------------- Busca global ---------------- */
  function setupSearch() {
    const input = $('#search'), box = $('#searchResults');
    let items = [], selIdx = -1;
    const run = U.debounce(() => {
      const q = U.norm(input.value.trim());
      if (q.length < 2) { box.classList.add('hidden'); return; }
      const d = S.state.data;
      const partners = d.partners.filter((p) => p.partner_code.includes(q) || U.norm(p.partner_name).includes(q) || U.norm(p.city).includes(q)).slice(0, 6);
      const events = d.events.filter((e) => U.norm(e.title).includes(q) || U.norm(e.event_id).includes(q) || U.norm(e.city).includes(q)).slice(0, 5);
      const incs = d.incidents.filter((i) => U.norm(i.incident_id).includes(q)).slice(0, 4);
      const occs = S.state.engine.occurrences.filter((o) => U.norm(o.title).includes(q) || U.norm(o.id).includes(q)).slice(0, 4);
      items = [];
      const grp = (title, arr, map) => arr.length ? `<div class="sr-group">${title}</div>` + arr.map((x) => { const it = map(x); items.push(it); return `<button data-i="${items.length - 1}">${it.html}</button>`; }).join('') : '';
      const html = grp('Conveniados', partners, (p) => ({ type: 'partner', id: p.partner_code, html: `<b class="mono">${p.partner_code}</b> ${U.esc(p.partner_name)}<div class="sr-sub">${U.esc(p.city)}/${p.state} · ${p.telecom_operator} ${p.connectivity_type} · ${p.operational_status}</div>` }))
        + grp('Ocorrências', occs, (o) => ({ type: 'occurrence', id: o.id, html: `${U.esc(o.title)}<div class="sr-sub">${o.id} · ${o.partners.length} conveniado(s)</div>` }))
        + grp('Eventos externos (simulados)', events, (e) => ({ type: 'event', id: e.event_id, html: `${U.esc(e.title)}<div class="sr-sub">${e.event_id} · ${R.EVENT_CATEGORIES[e.category].short}</div>` }))
        + grp('Incidentes', incs, (i) => ({ type: 'incident', id: i.incident_id, html: `<b class="mono">${i.incident_id}</b> ${U.esc(i.description)}<div class="sr-sub">Conveniado ${i.partner_code}</div>` }));
      box.innerHTML = html || '<div class="empty" style="padding:16px">Nenhum resultado</div>';
      box.classList.remove('hidden'); selIdx = -1;
      box.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); pick(items[+b.dataset.i]); }));
    }, 150);
    function pick(it) {
      if (!it) return;
      box.classList.add('hidden'); input.blur();
      ({ partner: IOA.details.openPartner, event: IOA.details.openEvent, incident: IOA.details.openIncident, occurrence: IOA.details.openOccurrence })[it.type](it.id);
    }
    input.addEventListener('input', run);
    input.addEventListener('focus', run);
    input.addEventListener('blur', () => setTimeout(() => box.classList.add('hidden'), 120));
    input.addEventListener('keydown', (e) => {
      const btns = box.querySelectorAll('button[data-i]');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); selIdx = Math.max(0, Math.min(btns.length - 1, selIdx + (e.key === 'ArrowDown' ? 1 : -1)));
        btns.forEach((b, i) => b.classList.toggle('sel', i === selIdx));
      } else if (e.key === 'Enter') { pick(items[selIdx >= 0 ? selIdx : 0]); }
      else if (e.key === 'Escape') { box.classList.add('hidden'); }
    });
    document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); input.focus(); } });
  }

  /* ---------------- Notificações ---------------- */
  function notifications() {
    return S.state.engine.occurrences.filter((o) => o.status === 'ativo' && o.rule !== 'ISO' && (o.severity === 'critica' || o.severity === 'alta' || o.rule === 'R6'))
      .sort((a, b) => R.SEVERITIES[b.severity].rank - R.SEVERITIES[a.severity].rank || b.partners.length - a.partners.length);
  }
  function setupNotifications() {
    const pop = $('#notifPop');
    $('#bell').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!pop.classList.contains('hidden')) { pop.classList.add('hidden'); return; }
      const list = notifications();
      const apiIssues = [...IOA.integrations.monitoring.values()].filter((m) => m.status === 'indisponivel' || m.status === 'desatualizado');
      pop.innerHTML = `<div class="popover-head">Notificações <span class="badge sim">simuladas</span></div><div class="popover-body">
        ${list.map((o) => `<button class="notif" data-occ="${o.id}"><span class="notif-bar" style="background:${ui.SEV_COLOR[o.severity]}"></span><span><div style="font-weight:600;font-size:12.5px">${U.esc(o.title)}</div><div class="small muted">${o.partners.length} conveniado(s) · ${R.CONFIDENCE[o.confidence] ? 'confiança ' + R.CONFIDENCE[o.confidence].label.toLowerCase() : ''} · ${U.ago(o.first_seen, S.state.data.now)}</div></span></button>`).join('')}
        ${apiIssues.map((m) => `<button class="notif" data-cfg="1"><span class="notif-bar" style="background:${m.status === 'indisponivel' ? 'var(--crit)' : 'var(--warn)'}"></span><span><div style="font-weight:600;font-size:12.5px">Fonte ${m.status === 'indisponivel' ? 'indisponível' : 'desatualizada'}: ${U.esc(m.provider)}</div><div class="small muted">${U.esc(m.error_message || m.data_freshness || '')}</div></span></button>`).join('')}
        ${!list.length && !apiIssues.length ? ui.empty('Sem notificações', 'Nenhuma ocorrência crítica ativa.', 'check') : ''}</div>`;
      pop.classList.remove('hidden');
      pop.querySelectorAll('[data-occ]').forEach((b) => b.addEventListener('click', () => { pop.classList.add('hidden'); go('correlacao', null, { occ: b.dataset.occ }); }));
      pop.querySelectorAll('[data-cfg]').forEach((b) => b.addEventListener('click', () => { pop.classList.add('hidden'); go('config'); }));
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#notifPop')) pop.classList.add('hidden'); });
  }
  function refreshBadges() {
    const n = notifications().length;
    const dot = $('#bellDot'); dot.textContent = n; dot.classList.toggle('hidden', !n);
    const v = S.view();
    const setCount = (id, val, cls) => { const el = document.querySelector(`[data-count="${id}"]`); if (!el) return; el.textContent = val; el.classList.toggle('hidden', !val); if (cls) el.classList.add(cls); };
    setCount('correlacao', v.occurrences.filter((o) => o.status === 'ativo' && o.regional && o.rule !== 'R5').length, 'ana');
    setCount('executiva', v.partners.filter((p) => p.operational_status === 'offline').length);
  }

  /* ---------------- Roteamento ---------------- */
  function go(id, filterPatch, p) {
    params = p || {};
    if (filterPatch) S.setFilters(filterPatch);
    if (location.hash === '#/' + id) route(true); else location.hash = '#/' + id;
  }
  function route(force) {
    const id = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'executiva';
    const view = IOA.views[id] ? id : 'executiva';
    if (!force && view === currentId && current) return;
    if (current && current.destroy) current.destroy();
    ui.charts.destroyAll();
    ui.drawer.close();
    currentId = view; current = IOA.views[view];
    const nav = NAV.find((n) => n.id === view);
    $('#pageTitle').textContent = nav.label;
    $('#pageSub').textContent = current.subtitle || 'Eventos externos, conectividade e infraestrutura';
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === view));
    document.title = nav.label + ' · Inteligência Operacional Abastece';
    const el = $('#view');
    el.innerHTML = '';
    el.scrollTop = 0; window.scrollTo(0, 0);
    try { current.render(el, params); } catch (e) { console.error(e); el.innerHTML = `<div class="err-banner">${ui.icon('alert')} Erro ao montar a tela: ${U.esc(e.message)}</div>`; }
    params = {};
  }
  function onState() {
    renderFilters(); refreshBadges();
    if (!current) return;
    const el = $('#view');
    try {
      if (current.update) current.update(el);
      else { ui.charts.destroyAll(); if (current.destroy) current.destroy(); el.innerHTML = ''; current.render(el, {}); }
    } catch (e) { console.error(e); el.innerHTML = `<div class="err-banner">${ui.icon('alert')} Erro ao atualizar a tela: ${U.esc(e.message)}</div>`; }
  }

  /* ---------------- Inicialização ---------------- */
  async function start() {
    document.getElementById('root').innerHTML = ui.loading('Carregando fontes simuladas…');
    ui.charts.base();
    const sim = IOA.simulator.generate(Date.now());
    IOA.integrations.setup(sim);
    const data = await IOA.integrations.loadAll();
    S.init(data, data.errors);
    shell();
    renderFilters(); refreshBadges();
    S.subscribe(onState);
    window.addEventListener('hashchange', () => route());
    route(true);
  }

  /** Banner padrão de fontes com erro (estado de erro sem derrubar a tela). */
  function sourceBanner(domain) {
    const items = IOA.integrations.SOURCES.filter((s) => s.domain === domain).map((s) => ({ s, m: IOA.integrations.monitoring.get(s.id) }));
    const bad = items.filter((x) => x.m.status === 'indisponivel' || x.m.status === 'desatualizado' || x.m.status === 'nao_configurado');
    const simN = items.filter((x) => x.m.status === 'simulado').length;
    return `<div class="info-banner">${ui.icon('db')}<span><b>Fontes:</b> ${simN} simulada(s)${bad.length ? ' · ' + bad.map((x) => `${U.esc(x.s.name)} <span class="badge ${IOA.integrations.STATUS[x.m.status].cls}">${IOA.integrations.STATUS[x.m.status].label}</span>`).join(' · ') : ''}. Nenhuma integração real ativa no V0.</span><a href="#/config" style="margin-left:auto;white-space:nowrap">Ver integrações →</a></div>`;
  }

  return { start, go, NAV, sourceBanner, get params() { return params; } };
})();

document.addEventListener('DOMContentLoaded', () => IOA.app.start());
