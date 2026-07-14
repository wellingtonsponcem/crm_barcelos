const CRM = {
  base: window.CRM2_BASE_PATH || "",
  users: [],
  currentUser: null,
  partners: [],
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const app = $("#app");
function api(resource, params = {}, options = {}) {
  const url = new URL(`${CRM.base}/api/index.php`, window.location.origin);
  url.searchParams.set("resource", resource);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const init = { ...options };
  if (init.body && typeof init.body !== "string") {
    init.headers = {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    };
    init.body = JSON.stringify(init.body);
  }
  return fetch(url, init).then(async (r) => {
    if (r.status === 401) {
      window.location.reload();
      return new Promise(() => {});
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(j.error || "Erro na API");
    return j;
  });
}
function money(v) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
}
function esc(v) {
  return String(v ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[c],
  );
}
function typeName(t) {
  return (
    {
      investor: "Investidor",
      operator: "Socio Gestor",
      landowner: "Proprietario",
    }[t] || t
  );
}
function roleLabel(r) {
  return (
    {
      director: "Diretoria",
      admin: "Admin",
      commercial: "Comercial",
      operational: "Operacional",
    }[r] || r
  );
}
function badge(p) {
  const c =
    p === "Alta"
      ? "badge-error"
      : p === "Media" || p === "M�dia"
        ? "badge-warning"
        : "badge-info";
  return `<span class="badge ${c}">${esc(p || "Media")}</span>`;
}
function tempColor(t) {
  return t === "Muito Quente"
    ? "var(--error)"
    : t === "Quente"
      ? "var(--warning)"
      : "var(--outline)";
}
function scoreColor(s) {
  s = Number(s || 0);
  return s >= 90
    ? "var(--error)"
    : s >= 70
      ? "var(--success)"
      : s >= 40
        ? "var(--warning)"
        : "var(--outline)";
}
function estimatedValue(p) {
  if (p.type === "investor" && p.available_capital)
    return money(p.available_capital);
  if (p.type === "landowner" && p.asking_price) return money(p.asking_price);
  return "N/A";
}
function toast(m) {
  const e = $("#toast");
  e.textContent = m;
  e.classList.add("active");
  clearTimeout(e._timer);
  e._timer = setTimeout(() => e.classList.remove("active"), 2600);
}
function loading(t = "Carregando dados...") {
  app.innerHTML = `<div class="empty-state"><strong>${t}</strong></div>`;
}
function stageSets(t) {
  return (
    {
      investor: [
        "Novo lead",
        "Primeiro contato",
        "Qualificacao",
        "Reuniao estrategica",
        "Apresentacao do modelo",
        "Envio de proposta",
        "Due diligence",
        "Negociacao",
        "Contrato",
        "Aporte realizado",
        "Investidor ativo",
        "Perdido",
      ],
      operator: [
        "Indicado",
        "Primeiro contato",
        "Analise inicial",
        "Entrevista estrategica",
        "Validacao de experiencia",
        "Analise de perfil",
        "Analise juridica",
        "Definicao de funcao",
        "Parceria aprovada",
        "Integracao ao projeto",
        "Reprovado",
      ],
      landowner: [
        "Terreno identificado",
        "Primeiro contato",
        "Coleta de informacoes",
        "Documentacao solicitada",
        "Visita tecnica agendada",
        "Visita realizada",
        "Analise de viabilidade",
        "Estudo financeiro",
        "Negociacao",
        "Contrato",
        "Terreno aprovado",
        "Recusado",
      ],
    }[t] || stageSets("investor")
  );
}
async function init() {
  bindChrome();
  const d = await api("users");
  CRM.users = d.users || [];
  CRM.currentUser = window.CRM2_CURRENT_USER || CRM.users[0] || { id: "", name: "Usuario", role: "admin" };
  $("#currentUserName").textContent = CRM.currentUser.name;
  const roleEl = $("#currentUserRole");
  if (roleEl) {
    roleEl.textContent = roleLabel(CRM.currentUser.role);
  }
  window.addEventListener("hashchange", route);
  route();
}
function bindChrome() {
  $("#newPartnerSidebar").addEventListener("click", () => openPartnerForm());
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
  $("#systemStatus").addEventListener("click", async () => {
    await api("init");
    toast("API PHP funcionando");
  });
  $("#globalSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter")
      location.hash =
        "#/parceiros?search=" + encodeURIComponent(e.target.value.trim());
  });
}
function route() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [path, q = ""] = h.split("?");
  const params = Object.fromEntries(new URLSearchParams(q));
  $$(".nav-link").forEach((a) =>
    a.classList.toggle(
      "active",
      a.dataset.route === "/" ? path === "/" : path.startsWith(a.dataset.route),
    ),
  );
  if (path === "/") return renderDashboard();
  if (path === "/parceiros") return renderPartners(params);
  if (path === "/pipeline") return renderPipeline("investor");
  if (path === "/alertas") return renderAlerts();
  if (path === "/relatorios") return renderReports();
  if (path === "/mapa") return renderMap();
  if (path === "/agenda") return renderAgenda();
  if (path === "/configuracoes") return renderSettings();
  renderDashboard();
}
async function renderDashboard() {
  loading("Carregando inteligencia de performance...");
  const [dash, alerts, tasksData] = await Promise.all([
    api("dashboard"),
    api("alerts", { status: "Ativo" }),
    api("tasks", { status: "Pendente" }),
  ]);
  const m = dash.metrics || {};
  
  // Oportunidades atrasadas filtradas dinamicamente
  const today = new Date();
  const overduePartners = (dash.urgent || []).filter(p => {
    if (!p.next_followup_at) return false;
    const fDate = new Date(p.next_followup_at);
    return fDate < today && !["Contrato", "Recusado", "Perdido", "Investidor ativo", "Parceria aprovada", "Terreno aprovado"].includes(p.pipeline_stage);
  });

  // Cálculos de metas e porcentagens de progresso
  const totalOpenPct = Math.min(100, Math.round((m.totalOpen / 100) * 100));
  const capitalAvailablePct = Math.min(100, Math.round((m.capitalAvailable / 20000000) * 100));
  const capitalRealizedPct = Math.min(100, Math.round((m.capitalRealized / (m.capitalAvailable || 1)) * 100));
  const criticalPct = Math.min(100, Math.round((m.criticalCount / (m.totalOpen || 1)) * 100));
  const overduePct = Math.max(0, 100 - Math.min(100, Math.round((m.overdueFollowups / (m.totalOpen || 1)) * 100)));

  // HTML das tendências
  const trendRealized = `<p class="kpi-trend up" style="color:var(--success);font-size:12px;font-weight:bold;display:flex;align-items:center;gap:2px;margin:0"><span class="material-symbols-outlined" style="font-size:14px">trending_up</span> +8%</p>`;
  const trendOverdue = m.overdueFollowups > 0 
    ? `<p class="kpi-trend down" style="color:var(--error);font-size:12px;font-weight:bold;display:flex;align-items:center;gap:2px;margin:0"><span class="material-symbols-outlined" style="font-size:14px">trending_up</span> +${m.overdueFollowups}</p>` 
    : `<p class="kpi-trend up" style="color:var(--success);font-size:12px;font-weight:bold;display:flex;align-items:center;gap:2px;margin:0"><span class="material-symbols-outlined" style="font-size:14px">check_circle</span> OK</p>`;

  app.innerHTML = `<div style="background-color:var(--error-container);border-left:4px solid var(--error);padding:16px;display:flex;align-items:center;gap:16px;box-shadow:var(--shadow-sm);margin-bottom:24px">
    <span class="material-symbols-outlined" style="color:var(--error);font-size:24px">warning</span>
    <div>
      <p style="font-weight:bold;color:var(--on-error-container);margin:0;font-size:14px">Alerta Estratégico Comercial</p>
      <p style="color:var(--on-error-container);margin:2px 0 0;font-size:13px">Queda na conversão de investidores e follow-ups vencidos exigem ação comercial imediata.</p>
    </div>
  </div>
  
  <div class="page-header">
    <div class="page-title-group">
      <h2>Inteligência de Performance</h2>
      <p>Métricas de otimização comercial em tempo real e monitoramento de saúde de relacionamentos.</p>
    </div>
    <div class="page-actions">
      <button class="btn btn-secondary" id="refreshDashboard"><span class="material-symbols-outlined">restart_alt</span>Atualizar</button>
      <button class="btn btn-primary" onclick="window.print()"><span class="material-symbols-outlined">print</span>Exportar PDF</button>
    </div>
  </div>
  
  <div class="card" style="margin-bottom:24px;padding:16px;background-color:var(--surface-container-low)">
    <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">
      ${filterSelect("Período", ["Últimos 30 dias", "Últimos 90 dias"])}
      ${filterSelect("Origem do Lead", ["Todas as Origens", "Indicação", "LinkedIn", "Anúncio Web"])}
      ${filterSelect("Responsável Comercial", ["Todos os Responsáveis", ...CRM.users.map((u) => u.name)])}
      ${filterSelect("UF", ["Estados", "SP", "RJ", "MG", "ES"])}
    </div>
  </div>
  
  <div class="kpi-grid">
    ${kpi("Oportunidades Ativas", m.totalOpen, `${m.investorsCount || 0} Inv | ${m.operatorsCount || 0} Op | ${m.landsCount || 0} Ter`, "hub", "var(--primary)", totalOpenPct)}
    ${kpi("Capital Disponível", money(m.capitalAvailable), "Disponível no pipeline", "payments", "var(--primary)", capitalAvailablePct)}
    ${kpi("Aporte Realizado", money(m.capitalRealized), "Contratos assinados / due diligence", "price_check", "var(--primary)", capitalRealizedPct, trendRealized)}
    ${kpi("Pontuação Crítica", m.criticalCount, "Score 90+", "warning", "var(--error)", criticalPct)}
    ${kpi("Follow-ups Vencidos", m.overdueFollowups, `${m.todayMeetings || 0} reuniões hoje | ${m.stagnantLeads || 0} estagnados`, "event_busy", "var(--warning)", overduePct, trendOverdue)}
  </div>
  
  <div class="card" style="border-top:4px solid var(--primary);margin-bottom:24px">
    <div class="card-header">
      <span class="card-title"><span class="material-symbols-outlined">filter_alt</span>Funil de Conversão de Investidores (Stitch Flow)</span>
    </div>
    <div class="card-body">${renderFunnel(dash.funnel || [])}</div>
  </div>
  
  <div class="card" style="background-color:var(--surface-container-low);margin-bottom:24px">
    <div class="card-header">
      <span class="card-title" style="color:var(--primary)"><span class="material-symbols-outlined">lightbulb</span>Insights de Inteligência Comercial</span>
    </div>
    <div class="card-body" style="display:flex;gap:16px;flex-wrap:wrap">
      ${insight("analytics", "Oportunidades Estagnadas", "Leads de alto valor parados em negociação por mais de 15 dias.")}
      ${insight("assignment_late", "Ações Faltantes", "Leads quentes sem abordagem estratégica futura agendada.")}
      ${insight("timer", "Atraso de Resposta", "Tempo médio de resposta acima da meta comercial.")}
    </div>
  </div>
  
  <div class="grid-2col">
    <div>
      <div class="card">
        <div class="card-header">
          <span class="card-title"><span class="material-symbols-outlined">analytics</span>Projeções Financeiras: Projetado vs. Realizado</span>
        </div>
        <div class="card-body">
          ${renderBars(dash.chartData || [])}
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:16px">
            ${miniMetric("Gap Comercial", "-R$ 248.5K", "var(--error)")}
            ${miniMetric("Acurácia Forecast", "94.2%", "var(--primary)")}
            ${miniMetric("Rendimento Projetado", "R$ 1.82M", "var(--primary)")}
          </div>
        </div>
      </div>
      ${efficiencyTable()}
    </div>
    <div style="display:flex;flex-direction:column;gap:24px">
      <div class="card" style="border-top:4px solid var(--error);margin-bottom:0">
        <div class="card-header" style="background-color:rgba(186,26,26,.05)">
          <span class="card-title" style="color:var(--error)"><span class="material-symbols-outlined">priority_high</span>Alertas Estratégicos Ativos</span>
          <span class="badge badge-error">${alerts.alerts.length} Pendentes</span>
        </div>
        <div class="card-body">${renderAlertList(alerts.alerts.slice(0, 4))}</div>
      </div>

      <div class="card" style="border-top:4px solid var(--error);margin-bottom:0">
        <div class="card-header" style="background-color:rgba(186,26,26,.05)">
          <span class="card-title" style="color:var(--error)"><span class="material-symbols-outlined">warning</span>Oportunidades Atrasadas (Overdue)</span>
        </div>
        <div class="card-body" style="padding:0">${renderOverdueList(overduePartners)}</div>
      </div>

      <div class="card" style="border-top:4px solid var(--primary);margin-bottom:0">
        <div class="card-header" style="background-color:var(--surface-container)">
          <span class="card-title"><span class="material-symbols-outlined">calendar_month</span>Próximas Abordagens (Agenda)</span>
          <button class="btn btn-secondary" id="dashGoToAgenda" style="padding:4px 8px;font-size:10px;text-transform:none;letter-spacing:0">Ver Agenda</button>
        </div>
        <div class="card-body" style="padding:0">${renderDashboardAgenda(tasksData.tasks || [])}</div>
      </div>
    </div>
  </div>
  
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-top:24px">
    ${bottomMetric("Valor Ativo do Pipeline", "R$ 14.2M", "payments", true)}
    ${bottomMetric("Risco de Churn de Parceiros", "4.2%", "trending_down")}
    ${bottomMetric("Utilização do Sistema", "88%", "settings_suggest")}
  </div>`;

  $("#refreshDashboard").addEventListener("click", renderDashboard);
  bindAlertButtons();
  
  $$(".open-partner").forEach((b) =>
    b.addEventListener("click", () => openPartnerDetail(b.dataset.id)),
  );
  
  const agendaBtn = $("#dashGoToAgenda");
  if (agendaBtn) {
    agendaBtn.addEventListener("click", () => {
      location.hash = "#/agenda";
    });
  }
}
function filterSelect(l, vals) {
  return `<label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:10px;font-weight:bold;text-transform:uppercase;color:var(--on-surface-variant)">${l}</span><select class="form-select" style="padding:4px 8px;font-size:12px">${vals.map((v) => `<option>${esc(v)}</option>`).join("")}</select></label>`;
}
function kpi(t, v, s, i, c = "var(--primary)", p = 100, trend = "") {
  return `<div class="kpi-card" style="border-top-color:${c}">
    <div class="kpi-header">
      <span class="kpi-title">${t}</span>
      <span class="material-symbols-outlined kpi-icon" style="color:${c}">${i}</span>
    </div>
    <div class="kpi-value-group" style="display:flex;align-items:baseline;gap:8px">
      <p class="kpi-value" style="color:${c};font-size:${String(v).length > 8 ? "22px" : "32px"}">${v ?? 0}</p>
      ${trend}
    </div>
    <div class="kpi-bar-bg" style="width:100%;height:4px;background:var(--surface-container-highest);margin-top:16px;overflow:hidden">
      <div class="kpi-bar-fill" style="width:${p}%;height:100%;background:${c};transition:width 0.5s ease"></div>
    </div>
    <p class="kpi-subtitle" style="font-size:9px;font-weight:bold;margin-top:8px;text-transform:uppercase;color:var(--on-surface-variant)">${s}</p>
  </div>`;
}
function renderFunnel(rows) {
  // Mapeamento tolerante a acentuação para os 4 grandes grupos do funil
  const stageGroups = {
    outreach: ["Novo lead", "Primeiro contato"],
    qualification: [
      "Qualificacao", 
      "Qualificação", 
      "Reuniao estrategica", 
      "Reunião estratégica", 
      "Apresentacao do modelo", 
      "Apresentação do modelo"
    ],
    negotiation: ["Envio de proposta", "Due diligence", "Negociacao", "Negociação"],
    closing: ["Contrato", "Aporte realizado", "Investidor ativo"]
  };

  // Contagem individual de leads ativos em cada estágio no banco
  let rawCounts = { outreach: 0, qualification: 0, negotiation: 0, closing: 0 };

  (rows || []).forEach(r => {
    const stage = r.pipeline_stage;
    const count = Number(r.count);
    if (stageGroups.outreach.includes(stage)) rawCounts.outreach += count;
    else if (stageGroups.qualification.includes(stage)) rawCounts.qualification += count;
    else if (stageGroups.negotiation.includes(stage)) rawCounts.negotiation += count;
    else if (stageGroups.closing.includes(stage)) rawCounts.closing += count;
  });

  // Funil Acumulado (leads em etapas mais avançadas passaram pelas anteriores)
  const countClosing = rawCounts.closing;
  const countNegotiation = rawCounts.negotiation + countClosing;
  const countQualification = rawCounts.qualification + countNegotiation;
  const countOutreach = rawCounts.outreach + countQualification;

  const total = countOutreach || 1;

  const steps = [
    { key: "outreach", title: "Initial Outreach", count: countOutreach, pct: 100, label: "100% Volume", class: "", drop: null },
    { 
      key: "qualification", 
      title: "Qualification", 
      count: countQualification, 
      pct: Math.round((countQualification / total) * 100), 
      label: `${Math.round((countQualification / total) * 100)}% CR`,
      class: "pl-4",
      drop: countOutreach > countQualification ? `-${Math.round(((countOutreach - countQualification) / countOutreach) * 100)}% Drop` : null
    },
    { 
      key: "negotiation", 
      title: "Negotiation", 
      count: countNegotiation, 
      pct: Math.round((countNegotiation / total) * 100), 
      label: `${Math.round((countNegotiation / total) * 100)}% CR`,
      class: "pl-8",
      drop: countQualification > countNegotiation ? `-${Math.round(((countQualification - countNegotiation) / countQualification) * 100)}% Stagnation` : null
    },
    { 
      key: "closing", 
      title: "Closed-Won", 
      count: countClosing, 
      pct: Math.round((countClosing / total) * 100), 
      label: `${Math.round((countClosing / total) * 100)}% Final`,
      class: "pl-12",
      drop: countNegotiation > countClosing ? `-${Math.round(((countNegotiation - countClosing) / countNegotiation) * 100)}% Drop` : null
    }
  ];

  return `<div class="funnel-wrapper">` + 
    steps.map((s, idx) => {
      let dropHtml = "";
      if (idx > 0) {
        let leftPx = idx === 1 ? 40 : 56;
        let badgeClass = "drop-red";
        let labelText = s.drop || "Optimal";

        if (idx === 1) {
          badgeClass = "drop-red";
          labelText = s.drop || "-0% Drop";
        } else if (idx === 2) {
          badgeClass = "drop-yellow";
          labelText = s.drop || "Estável";
        } else if (idx === 3) {
          badgeClass = "drop-blue";
          labelText = s.pct >= 15 ? "Optimal" : (s.drop || "17% Final");
        }

        dropHtml = `<div class="funnel-drop-tag-container" style="left:${leftPx}px">
          <div class="funnel-drop-tag-line"></div>
          <span class="funnel-drop-tag-badge ${badgeClass}">${labelText}</span>
        </div>`;
      }
      
      const widthPct = s.pct;

      return `<div class="funnel-step ${s.class}">
        ${dropHtml}
        <div class="funnel-header">
          <span class="funnel-title">${s.title}</span>
          <span class="funnel-count">${s.count} ${s.count === 1 ? 'Unidade' : 'Unidades'}</span>
        </div>
        <div class="funnel-bar-bg">
          <div class="funnel-bar-fill" style="width:${Math.max(10, widthPct)}%">
            ${s.label}
          </div>
        </div>
      </div>`;
    }).join("") + 
  `</div>
  <div class="funnel-alert-container">
    <div class="funnel-alert-header">
      <span class="material-symbols-outlined" style="font-size:18px">warning</span>
      <span class="funnel-alert-title">Alerta de Estagnação</span>
    </div>
    <p class="funnel-alert-desc">
      Negociações em andamento estão demorando em média <strong>14.2 dias</strong> a mais do que a meta trimestral. Revise a frequência de contatos para os Top 10 parceiros.
    </p>
  </div>`;
}

function renderOverdueList(partners) {
  if (!partners.length) {
    return `<div style="padding:24px;text-align:center;font-style:italic;color:var(--outline);font-size:12px">
      Nenhuma oportunidade atrasada. Excelente trabalho!
    </div>`;
  }
  
  return `<div style="display:flex;flex-direction:column">` + 
    partners.slice(0, 3).map(p => {
      const diffTime = Math.abs(new Date() - new Date(p.next_followup_at));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return `<div style="padding:16px;border-bottom:1px solid var(--outline-variant)" class="overdue-item">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <button class="open-partner" data-id="${p.id}" style="font-size:13px;font-weight:bold;color:var(--primary);border:0;background:transparent;cursor:pointer;padding:0;text-align:left">${esc(p.name)}</button>
          <span style="font-family:var(--font-mono);font-size:10px;font-weight:bold;color:var(--error);white-space:nowrap">${diffDays} ${diffDays === 1 ? 'DIA' : 'DIAS'} ATRASADO</span>
        </div>
        <p style="font-size:11px;color:var(--on-surface-variant);margin:4px 0 0">
          Ação pendente: <strong>${esc(p.next_action || "Sem ação registrada")}</strong>.
        </p>
      </div>`;
    }).join("") + 
  `</div>`;
}

function renderDashboardAgenda(tasks) {
  if (!tasks.length) {
    return `<div style="padding:24px;text-align:center;font-style:italic;color:var(--outline);font-size:12px">
      Sem compromissos agendados.
    </div>`;
  }
  
  return `<div style="display:flex;flex-direction:column">` + 
    tasks.slice(0, 3).map(t => {
      const date = new Date(t.due_date);
      const isToday = date.toDateString() === new Date().toDateString();
      const timeStr = date.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
      const dateStr = isToday ? `HOJE • ${timeStr}` : `${date.toLocaleDateString("pt-BR", { day: 'numeric', month: 'short' }).toUpperCase()} • ${timeStr}`;
      const bg = isToday ? 'var(--secondary-container)' : 'var(--surface-container)';
      const fg = isToday ? 'var(--primary)' : 'var(--on-surface-variant)';
      
      return `<div style="padding:16px;border-bottom:1px solid var(--outline-variant);transition:background 0.2s" class="dashboard-agenda-item">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-family:var(--font-mono);font-size:10px;font-weight:bold;color:${fg};background:${bg};padding:2px 6px;border-radius:2px">${dateStr}</span>
          <button class="btn btn-secondary open-partner" data-id="${t.partner_id}" style="padding:2px 6px;font-size:10px;text-transform:none;letter-spacing:0">Ver Ficha</button>
        </div>
        <h4 style="font-size:13px;font-weight:bold;color:var(--primary);margin:4px 0">${esc(t.partner_name || "Sem Parceiro")}</h4>
        <p style="font-size:12px;color:var(--on-surface-variant);margin:2px 0">${esc(t.title)}</p>
        <div style="display:flex;align-items:center;gap:4px;margin-top:6px;font-size:11px;color:var(--on-surface-variant)">
          <span class="material-symbols-outlined" style="font-size:14px">person</span>
          <span>Responsável: ${esc(t.user_name || "Sem Responsável")}</span>
        </div>
      </div>`;
    }).join("") + 
  `</div>`;
}
function renderBars(rows) {
  return `<div style="display:flex;align-items:flex-end;height:220px;gap:28px;border-bottom:1px solid var(--outline-variant);padding:16px">${rows.map((r) => `<div style="flex:1;text-align:center"><div style="display:flex;gap:8px;align-items:flex-end;justify-content:center;height:150px"><div title="Projetado" style="width:28px;height:${(r.projected / 3000000) * 100}%;background:rgba(80,95,118,.35)"></div><div title="Realizado" style="width:28px;height:${(r.actual / 3000000) * 100}%;background:var(--primary)"></div></div><strong style="font-size:11px">${r.month}</strong></div>`).join("")}</div>`;
}
function insight(i, t, x) {
  return `<div style="display:flex;gap:12px;flex:1 1 250px"><span class="material-symbols-outlined" style="color:var(--primary);font-size:20px">${i}</span><div><p style="font-size:13px;font-weight:bold;margin:0">${t}</p><p style="font-size:12px;color:var(--on-surface-variant);margin:2px 0 0">${x}</p></div></div>`;
}
function miniMetric(l, v, c) {
  return `<div style="background-color:var(--surface-container-low);padding:12px"><p style="font-size:10px;color:var(--on-surface-variant);font-weight:bold;text-transform:uppercase">${l}</p><p style="font-size:18px;color:${c};font-weight:bold;margin-top:4px">${v}</p></div>`;
}
function efficiencyTable() {
  return `<div class="card"><div class="card-header"><span class="card-title"><span class="material-symbols-outlined">query_stats</span>Relatorio de Eficiencia de Relacionamento</span></div><div class="table-wrapper"><table class="table"><thead><tr><th>Segmento Parceiro</th><th>Tempo Medio Resposta</th><th>Frequencia</th><th>Taxa Fechamento</th><th>Saude</th></tr></thead><tbody><tr><td><strong>Investidores</strong></td><td>4.2 horas</td><td>Semanal</td><td><strong>10.2%</strong></td><td><span class="badge badge-error">Critico</span></td></tr><tr><td><strong>Socios Gestores</strong></td><td>1.8 horas</td><td>Diaria</td><td><strong>42.5%</strong></td><td><span class="badge badge-success">Excelente</span></td></tr><tr><td><strong>Proprietarios</strong></td><td>3.1 horas</td><td>Quinzenal</td><td><strong>28.4%</strong></td><td><span class="badge badge-info">Estavel</span></td></tr></tbody></table></div></div>`;
}
function bottomMetric(l, v, i, d = false) {
  return `<div class="${d ? "" : "card"}" style="${d ? "background-color:var(--primary);color:var(--on-primary);" : ""}padding:24px;box-shadow:var(--shadow-sm)"><div style="display:flex;justify-content:space-between;margin-bottom:16px"><span style="font-size:11px;font-weight:bold;text-transform:uppercase;${d ? "opacity:.7" : "color:var(--on-surface-variant)"}">${l}</span><span class="material-symbols-outlined">${i}</span></div><h3 style="font-size:32px;font-weight:800;${d ? "" : "color:var(--primary)"}">${v}</h3><p style="font-size:10px;margin-top:16px;${d ? "opacity:.6" : "color:var(--on-surface-variant)"}">Resumo ponderado pela probabilidade do estagio.</p></div>`;
}
async function renderPartners(params = {}) {
  loading("Carregando parceiros...");
  const data = await api("partners", params);
  CRM.partners = data.partners || [];
  const total = CRM.partners.length;
  const pipe = CRM.partners.filter(
    (p) => !["Contrato", "Recusado", "Perdido"].includes(p.pipeline_stage),
  ).length;
  const crit = CRM.partners.filter((p) => Number(p.score || 0) >= 90).length;
  const tv = CRM.partners.reduce(
    (s, p) =>
      s +
      (p.type === "investor"
        ? Number(p.available_capital || 0)
        : p.type === "landowner"
          ? Number(p.asking_price || 0)
          : 0),
    0,
  );
  app.innerHTML = `<div class="page-header"><div class="page-title-group"><h2>Diretorio Geral de Parceiros</h2><p>Consulte, filtre e gerencie todos os investidores, operadores e proprietarios cadastrados.</p></div><div class="page-actions"><button class="btn btn-secondary" id="exportCsv"><span class="material-symbols-outlined">download</span>Exportar CSV</button><button class="btn btn-primary" id="newPartner"><span class="material-symbols-outlined">person_add</span>Novo Parceiro</button></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">${statBox("Total de Parceiros", total, "var(--primary)")}${statBox("Em Negociacao", pipe, "var(--warning)")}${statBox("Aporte/Valor Medio", money(total ? tv / total : 0), "var(--primary)")}${statBox("Score Critico (90+)", crit, "var(--error)")}</div><div class="card" style="margin-bottom:24px;padding:16px;background-color:var(--surface-container-low)"><div style="display:flex;flex-direction:column;gap:16px"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span style="font-size:11px;font-weight:bold;color:var(--on-surface-variant);margin-right:8px">Filtrar por Tipo:</span>${typeFilterButton("", "Todos")}${typeFilterButton("investor", "Investidores")}${typeFilterButton("operator", "Socios Gestores")}${typeFilterButton("landowner", "Proprietarios")}<button class="btn btn-secondary" style="padding:4px 12px;font-size:11px">Objecoes Pendentes</button><button class="btn btn-secondary" style="padding:4px 12px;font-size:11px">Docs Pendentes</button></div><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center"><div style="position:relative;flex-grow:1;min-width:220px"><input class="form-input" id="partnerSearch" placeholder="Buscar por nome, cidade ou email..." value="${esc(params.search || "")}" style="width:100%;padding-left:32px;height:36px;font-size:12px"><span class="material-symbols-outlined" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:18px;color:var(--outline)">search</span></div><select class="form-select" id="stateFilter" style="height:36px;font-size:12px"><option value="">Estado</option><option>SP</option><option>RJ</option><option>MG</option><option>ES</option></select><select class="form-select" id="tempFilter" style="height:36px;font-size:12px"><option value="">Temperatura</option><option>Frio</option><option>Morno</option><option>Quente</option><option>Muito Quente</option></select><button class="btn btn-secondary" id="applyPartnerFilters" style="height:36px"><span class="material-symbols-outlined">filter_alt</span>Filtrar</button></div></div></div><div class="card" style="padding:0;overflow:hidden"><div class="table-wrapper"><table class="table"><thead><tr><th>Nome do Parceiro</th><th>Tipo</th><th>Status</th><th>Temp</th><th>Score</th><th>Saude</th><th>Valor Estimado</th><th>Ultimo Contato</th><th style="text-align:right">Ficha</th></tr></thead><tbody>${CRM.partners.map(partnerRow).join("") || '<tr><td colspan="9">Nenhum parceiro encontrado.</td></tr>'}</tbody></table></div></div><button id="fabPartner" style="position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background-color:var(--primary);color:white;border:none;box-shadow:var(--shadow-lg);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:100"><span class="material-symbols-outlined" style="font-size:28px">add</span></button>`;
  $("#newPartner").addEventListener("click", () => openPartnerForm());
  $("#fabPartner").addEventListener("click", () => openPartnerForm());
  $("#exportCsv").addEventListener("click", exportCsv);
  $$(".quick-type").forEach((b) =>
    b.addEventListener("click", () => {
      const q = new URLSearchParams();
      if (b.dataset.type) q.set("type", b.dataset.type);
      location.hash = "#/parceiros" + (q.toString() ? "?" + q.toString() : "");
    }),
  );
  $("#applyPartnerFilters").addEventListener("click", () => {
    const q = new URLSearchParams();
    if ($("#partnerSearch").value) q.set("search", $("#partnerSearch").value);
    if ($("#stateFilter").value) q.set("state", $("#stateFilter").value);
    if ($("#tempFilter").value) q.set("temperature", $("#tempFilter").value);
    location.hash = "#/parceiros" + (q.toString() ? "?" + q.toString() : "");
  });
  $$(".open-partner").forEach((b) =>
    b.addEventListener("click", () => openPartnerDetail(b.dataset.id)),
  );
}
function typeFilterButton(t, l) {
  return `<button class="btn btn-secondary quick-type" data-type="${t}" style="padding:4px 12px;font-size:11px">${l}</button>`;
}
function statBox(l, v, c) {
  return `<div style="padding:12px;border:1px solid var(--outline-variant);border-top:4px solid ${c};background:var(--surface-container-lowest)"><p style="font-size:10px;font-weight:bold;color:var(--on-surface-variant);text-transform:uppercase;margin-bottom:4px">${l}</p><p style="font-size:24px;font-weight:900;color:${c}">${v}</p></div>`;
}
function partnerRow(p) {
  const sc = ["Contrato", "Aporte realizado", "Investidor ativo"].includes(
    p.pipeline_stage,
  )
    ? "#10b981"
    : ["Recusado", "Perdido"].includes(p.pipeline_stage)
      ? "#ef4444"
      : "#f59e0b";
  const ic =
    p.type === "operator"
      ? "factory"
      : p.type === "landowner"
        ? "terrain"
        : "account_balance";
  return `<tr><td><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;background:rgba(0,32,70,.05);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--primary)"><span class="material-symbols-outlined">${ic}</span></div><div><button class="open-partner" data-id="${p.id}" style="font-weight:bold;color:var(--primary);border:0;background:transparent;cursor:pointer;padding:0">${esc(p.name)}</button><p style="font-size:11px;color:var(--on-surface-variant);margin-top:2px">${esc(p.city || "")} - ${esc(p.state || "")}</p></div></div></td><td><span class="badge badge-info" style="font-size:9px">${typeName(p.type)}</span></td><td><div style="display:flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:50%;background:${sc}"></span><span style="font-size:11px;font-weight:bold;color:${sc}">${sc === "#10b981" ? "Ativo" : sc === "#ef4444" ? "Inativo" : "Em Negociacao"}</span></div></td><td><span class="material-symbols-outlined" style="color:${tempColor(p.temperature)};font-size:18px">device_thermostat</span></td><td style="font-family:var(--font-mono);font-weight:bold">${p.score || 0}</td><td><div style="width:64px;height:6px;background:var(--surface-container-highest);border-radius:3px;overflow:hidden"><div style="width:${Number(p.score || 0)}%;height:100%;background:${scoreColor(p.score)}"></div></div></td><td style="font-family:var(--font-mono);font-size:12px">${estimatedValue(p)}</td><td style="font-size:11px;color:var(--on-surface-variant)">${p.last_interaction_at ? new Date(p.last_interaction_at).toLocaleDateString("pt-BR") : "Sem registros"}</td><td style="text-align:right"><button class="btn btn-secondary open-partner" data-id="${p.id}" style="padding:6px"><span class="material-symbols-outlined" style="font-size:16px">visibility</span></button></td></tr>`;
}
function exportCsv() {
  const h = [
    "ID",
    "Tipo",
    "Nome",
    "Telefone",
    "WhatsApp",
    "Email",
    "Cidade",
    "Estado",
    "Origem",
    "Temperatura",
    "Score",
    "Etapa",
  ];
  const rows = CRM.partners.map((p) => [
    p.id,
    typeName(p.type),
    p.name,
    p.phone || "",
    p.whatsapp || "",
    p.email || "",
    p.city || "",
    p.state || "",
    p.source || "",
    p.temperature || "",
    p.score || 0,
    p.pipeline_stage || "",
  ]);
  const csv =
    "\uFEFF" +
    [h, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  a.download = `fidelity_crm_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function renderPipeline(activeType = "investor") {
  loading("Carregando funil...");
  const data = await api("partners", { type: activeType });
  const partners = data.partners || [];
  const stages = stageSets(activeType);
  const grouped = Object.fromEntries(stages.map((s) => [s, []]));
  partners.forEach((p) =>
    grouped[grouped[p.pipeline_stage] ? p.pipeline_stage : stages[0]].push(p),
  );
  const total = partners.reduce(
    (s, p) =>
      s +
      (p.type === "investor"
        ? Number(p.available_capital || 0)
        : p.type === "landowner"
          ? Number(p.asking_price || 0)
          : 0),
    0,
  );
  app.innerHTML = `<div style="display:flex;flex-direction:column;height:calc(100vh - 145px);position:relative;width:100%;max-width:100%;overflow:hidden"><div class="page-header" style="margin-bottom:16px;flex-shrink:0"><div class="page-title-group"><h2>Funil Tatico de Parcerias</h2><p>Arraste visualmente os parceiros e acompanhe as negociacoes por etapa comercial.</p></div><div class="page-actions"><button class="btn btn-primary" id="newPipelinePartner"><span class="material-symbols-outlined">add</span>Nova Oportunidade</button></div></div><div class="card" style="margin-bottom:16px;padding:12px 16px;flex-shrink:0;background-color:var(--surface-container-low)"><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span style="font-size:11px;font-weight:bold;text-transform:uppercase;color:var(--primary);letter-spacing:.05em">Funil Ativo:</span>${pipelineTypeButton(activeType, "investor", "Captacao de Investidores")}${pipelineTypeButton(activeType, "operator", "Avaliacao de Socios/Operadores")}${pipelineTypeButton(activeType, "landowner", "Expansao de Terrenos")}</div></div><div class="pipeline-board" style="display:flex;gap:16px;overflow-x:auto;overflow-y:hidden;flex-grow:1;padding:0 4px 16px;align-items:stretch">${stages.map((s, i) => pipelineColumn(s, grouped[s], i, stages.length)).join("")}<div style="flex:0 0 16px;width:16px"></div></div><footer style="height:48px;background-color:var(--surface-container-lowest);border-top:1px solid var(--outline-variant);display:flex;align-items:center;padding:0 24px;justify-content:space-between;font-size:11px;flex-shrink:0"><div style="display:flex;gap:24px"><div><span style="color:var(--on-surface-variant);font-weight:bold;text-transform:uppercase;margin-right:6px">Valor Total do Funil:</span><strong style="color:var(--primary);font-family:var(--font-mono)">${money(total)}</strong></div><div><span style="color:var(--on-surface-variant);font-weight:bold;text-transform:uppercase;margin-right:6px">Ciclo Medio:</span><strong style="color:var(--primary);font-family:var(--font-mono)">24 dias</strong></div><div><span style="color:var(--on-surface-variant);font-weight:bold;text-transform:uppercase;margin-right:6px">Taxa de Conversao:</span><strong style="color:var(--primary);font-family:var(--font-mono)">68%</strong></div></div><div style="display:flex;gap:16px"><span>Acao Imediata</span><span>Alta Prioridade</span></div></footer></div>`;
  $("#newPipelinePartner").addEventListener("click", () =>
    openPartnerForm({ type: activeType }),
  );
  $$(".pipeline-type").forEach((b) =>
    b.addEventListener("click", () => renderPipeline(b.dataset.type)),
  );
  $$(".open-partner").forEach((b) =>
    b.addEventListener("click", () => openPartnerDetail(b.dataset.id)),
  );
}
function pipelineTypeButton(a, t, l) {
  return `<button class="btn ${a === t ? "btn-primary" : "btn-secondary"} pipeline-type" data-type="${t}" style="font-size:11px;padding:6px 12px">${l}</button>`;
}
function pipelineColumn(s, list, i, total) {
  const conv = Math.max(10, Math.round(85 - i * (75 / total)));
  return `<div class="pipeline-column" style="flex:0 0 280px;display:flex;flex-direction:column;max-height:100%;background-color:var(--surface-container-low);border:1px solid var(--outline-variant);border-radius:8px"><div class="pipeline-column-header" style="padding:12px 16px;border-bottom:1px solid var(--outline-variant);background-color:var(--surface-container)"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;font-weight:bold;color:var(--primary);text-transform:uppercase">${esc(s)}</span><span style="font-size:10px;font-weight:bold;background-color:var(--surface-container-high);padding:2px 6px;border-radius:10px;color:var(--on-surface-variant)">${list.length}</span></div></div><div style="padding:8px 16px;background-color:rgba(0,32,70,.02);border-bottom:1px solid var(--outline-variant)"><div style="display:flex;justify-content:space-between;font-size:9px;font-weight:bold;color:var(--on-surface-variant)"><span>CONV. RATE</span><span style="color:var(--primary)">${conv}%</span></div><div style="width:100%;height:3px;background-color:var(--surface-container-highest);margin-top:4px;border-radius:1.5px;overflow:hidden"><div style="width:${conv}%;height:100%;background-color:var(--primary)"></div></div></div><div class="pipeline-cards" style="padding:12px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;flex-grow:1;min-height:200px">${list.length ? list.map(pipelineCard).join("") : '<div style="padding:32px 12px;font-style:italic;font-size:11px;text-align:center;color:var(--outline)">Sem contatos</div>'}</div></div>`;
}
function pipelineCard(p) {
  const score = Number(p.score || 0);
  const stars = score >= 90 ? 5 : score >= 70 ? 4 : score >= 40 ? 3 : 2;
  const val = estimatedValue(p);
  const pr = score >= 80;
  return `<div class="pipeline-card" style="background:white;padding:12px;border-radius:6px;border:${pr ? "2px solid var(--error)" : "1px solid var(--outline-variant)"};box-shadow:var(--shadow-sm);cursor:pointer"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><button class="open-partner" data-id="${p.id}" style="font-size:13px;font-weight:bold;color:var(--primary);border:0;background:transparent;cursor:pointer;padding:0;text-align:left">${esc(p.name)}</button>${pr ? '<span style="font-size:9px;padding:1px 5px;background-color:var(--error-container);color:var(--error);font-weight:bold;text-transform:uppercase;border-radius:2px">Prioritario</span>' : ""}</div><div style="display:flex;gap:2px;color:var(--primary);margin-bottom:8px">${Array.from(
    { length: 5 },
  )
    .map(
      (_, i) =>
        `<span class="material-symbols-outlined" style="font-size:14px;font-variation-settings:'FILL' ${i < stars ? 1 : 0};color:${i < stars ? "var(--primary)" : "var(--outline-variant)"}">star</span>`,
    )
    .join(
      "",
    )}</div>${val !== "N/A" ? `<div style="margin-bottom:8px"><p style="font-size:9px;color:var(--on-surface-variant);text-transform:uppercase;margin:0">Valor Projetado</p><strong style="font-size:13px;color:var(--primary);font-family:var(--font-mono)">${val}</strong></div>` : ""}<div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--on-surface-variant);margin-bottom:8px"><span class="material-symbols-outlined" style="font-size:12px">history</span><span>Ultimo contato monitorado</span></div><div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(0,0,0,.05);font-size:10px"><span style="font-weight:bold;color:var(--on-surface-variant);text-transform:uppercase;font-family:var(--font-mono)">Etapa ativa</span><div style="width:20px;height:20px;border-radius:50%;background-color:var(--primary-container);display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:9px;font-weight:bold">${esc((p.name || "?").charAt(0))}</div></div></div>`;
}
async function renderAlerts() {
  loading("Carregando alertas...");
  const data = await api("alerts", { status: "Ativo" });
  app.innerHTML = `<div style="max-width:800px;margin:0 auto;width:100%"><div class="page-header"><div class="page-title-group"><h2>Alertas Estrategicos & Notificacoes Ativas</h2><p>Varredura continua de regras taticas: oportunidades paradas, follow-ups atrasados ou propostas esquecidas.</p></div></div><div class="card"><div class="card-header"><span class="card-title"><span class="material-symbols-outlined">notifications_active</span>Alertas sob Monitoramento Comercial</span><span class="badge badge-error">${(data.alerts || []).length} Pendentes</span></div><div class="card-body">${renderAlertList(data.alerts || [])}</div></div></div>`;
  bindAlertButtons();
}
function renderAlertList(alerts) {
  if (!alerts.length)
    return '<div class="alert-empty"><span class="material-symbols-outlined" style="font-size:48px;color:var(--outline)">notifications_off</span><p style="font-weight:bold;margin-top:16px">Nenhum alerta estrategico no momento.</p></div>';
  return `<div class="alerts-list">${alerts.map((a) => `<div class="alert-card ${a.priority === "Alta" ? "high" : "medium"}"><div class="alert-card-header"><span class="alert-card-title">${esc(a.title)}</span>${badge(a.priority)}</div><div class="alert-card-meta"><span>Contato: <strong style="color:var(--primary)">${esc(a.partner_name || "-")}</strong></span><span>Tipo: ${typeName(a.partner_type)}</span></div><p class="alert-card-body">${esc(a.description)}</p><div style="padding:8px;font-size:11px;background:var(--surface-container-low);border-left:3px solid var(--primary);margin-top:4px"><strong>Acao Recomendada:</strong> ${esc(a.recommended_action || "-")}</div><div class="alert-actions"><a href="tel:${esc(a.partner_phone || "")}" class="btn btn-secondary" style="padding:6px 10px;font-size:11px"><span class="material-symbols-outlined" style="font-size:16px">call</span>Ligar</a><a href="https://wa.me/${String(a.partner_whatsapp || "").replace(/[^0-9]/g, "")}" target="_blank" class="btn btn-secondary" style="padding:6px 10px;font-size:11px;border-color:#16a34a;color:#16a34a"><span class="material-symbols-outlined" style="font-size:16px">sms</span>WhatsApp</a><button class="btn btn-primary resolve-alert" data-id="${a.id}" style="padding:6px 12px;font-size:11px">Marcar como Resolvido</button></div></div>`).join("")}</div>`;
}
function bindAlertButtons() {
  $$(".resolve-alert").forEach((b) =>
    b.addEventListener("click", async () => {
      await api(
        "alerts",
        { id: b.dataset.id },
        { method: "PUT", body: { status: "Resolvido" } },
      );
      toast("Alerta resolvido");
      route();
    }),
  );
}
async function renderAgenda() {
  loading("Carregando agenda...");
  const data = await api("tasks");
  app.innerHTML = `<div class="page-header"><div class="page-title-group"><h2>Agenda</h2><p>Tarefas e follow-ups comerciais.</p></div><div class="page-actions"><button class="btn btn-primary" id="newTask"><span class="material-symbols-outlined">add_task</span>Nova Tarefa</button></div></div><div class="card"><div class="table-wrapper"><table class="table"><thead><tr><th>Tarefa</th><th>Parceiro</th><th>Vencimento</th><th>Prioridade</th><th>Status</th><th></th></tr></thead><tbody>${(data.tasks || []).map((t) => `<tr><td>${esc(t.title)}</td><td>${esc(t.partner_name || "-")}</td><td>${esc(t.due_date || "")}</td><td>${badge(t.priority)}</td><td>${esc(t.status)}</td><td><button class="btn btn-secondary complete-task" data-id="${t.id}">Concluir</button></td></tr>`).join("")}</tbody></table></div></div>`;
  $("#newTask").addEventListener("click", () => openTaskForm());
  $$(".complete-task").forEach((b) =>
    b.addEventListener("click", async () => {
      await api(
        "tasks",
        { id: b.dataset.id },
        { method: "PUT", body: { status: "Concluida" } },
      );
      route();
    }),
  );
}
async function renderReports() {
  const dash = await api("dashboard");
  const m = dash.metrics || {};
  app.innerHTML = `<div class="page-header"><div class="page-title-group"><h2>Relatorios</h2><p>Resumo executivo do pipeline.</p></div><div class="page-actions"><button class="btn btn-primary" onclick="window.print()"><span class="material-symbols-outlined">print</span>Exportar PDF</button></div></div><div class="kpi-grid">${kpi("Pipeline", money(m.capitalAvailable), "Capital disponivel", "payments")}${kpi("Terrenos", money(m.landValue), "Valor solicitado", "location_on")}${kpi("Alertas Ativos", m.activeAlerts, `${m.highAlerts || 0} alta prioridade`, "notifications_active")}</div>${efficiencyTable()}`;
}
async function renderMap() {
  const data = await api("partners", { type: "landowner" });
  app.innerHTML = `<div class="page-header"><div class="page-title-group"><h2>Mapa</h2><p>Terrenos e oportunidades por localizacao.</p></div></div><div class="map-lite">${(data.partners || []).map((p, i) => `<button class="map-dot" data-id="${p.id}" title="${esc(p.name)}" style="left:${18 + i * 18}%;top:${32 + (i % 3) * 16}%"></button>`).join("")}</div><div style="margin-top:16px" class="list-grid">${(data.partners || []).map((p) => `<div class="partner-card open-partner" data-id="${p.id}"><div class="partner-card-title">${esc(p.name)}</div><div class="partner-meta"><span>${typeName(p.type)}</span><span>${esc(p.city || "")}/${esc(p.state || "")}</span><span>Score ${p.score || 0}</span></div></div>`).join("")}</div>`;
  $$(".open-partner,.map-dot").forEach((e) =>
    e.addEventListener("click", () => openPartnerDetail(e.dataset.id)),
  );
}
function renderSettings() {
  app.innerHTML = `<div class="page-header"><div class="page-title-group"><h2>Ajustes</h2><p>Ambiente Vercel / PHP Serverless.</p></div></div><div class="card"><div class="card-body"><p><strong>Base path:</strong> ${esc(CRM.base || "/")}</p><p><strong>API:</strong> ${esc(CRM.base)}/api/index.php</p><p>Para produção na Vercel, configure as variáveis de ambiente (<code>DB_HOST</code>, <code>DB_USER</code>, <code>DB_PASS</code>, etc.) no painel do seu projeto na Vercel para conectar a um banco MySQL remoto.</p><button class="btn btn-primary" id="testApi"><span class="material-symbols-outlined">wifi</span>Testar API</button></div></div>`;
  $("#testApi").addEventListener("click", async () => {
    await api("init");
    toast("API PHP funcionando");
  });
}

async function openPartnerDetail(id) {
  const data = await api("partners", { id });
  const p = data.partner;
  const profile = data.profile || {};
  openModal(
    p.name,
    `<div class="page-header" style="margin-bottom:20px"><div class="page-title-group"><h2>${esc(p.name)}</h2><p>${typeName(p.type)} - ${esc(p.city || "")}/${esc(p.state || "")} - Score ${p.score}</p></div><div class="page-actions"><button class="btn btn-secondary" id="editPartner"><span class="material-symbols-outlined">edit</span>Editar</button><button class="btn btn-danger" id="archivePartner"><span class="material-symbols-outlined">archive</span>Arquivar</button></div></div><div class="grid-2col"><div class="card"><div class="card-header"><span class="card-title">Dados comerciais</span></div><div class="card-body"><p><strong>Telefone:</strong> ${esc(p.phone || "-")}</p><p><strong>WhatsApp:</strong> ${esc(p.whatsapp || "-")}</p><p><strong>Email:</strong> ${esc(p.email || "-")}</p><p><strong>Origem:</strong> ${esc(p.source || "-")}</p><p><strong>Proxima acao:</strong> ${esc(p.next_action || "-")}</p><p><strong>Notas:</strong> ${esc(p.notes || "-")}</p></div></div><div class="card"><div class="card-header"><span class="card-title">Perfil</span></div><div class="card-body">${profileHtml(p.type, profile)}</div></div></div><div class="card"><div class="card-header"><span class="card-title">Tarefas</span><button class="btn btn-secondary" id="addTask"><span class="material-symbols-outlined">add_task</span>Adicionar</button></div><div class="table-wrapper"><table class="table"><thead><tr><th>Tarefa</th><th>Vencimento</th><th>Prioridade</th><th>Status</th><th></th></tr></thead><tbody>${(data.tasks || []).map((t) => `<tr><td>${esc(t.title)}</td><td>${esc(t.due_date || "")}</td><td>${badge(t.priority)}</td><td>${esc(t.status)}</td><td><button class="btn btn-secondary complete-task" data-id="${t.id}">Concluir</button></td></tr>`).join("") || '<tr><td colspan="5">Sem tarefas.</td></tr>'}</tbody></table></div></div>`,
  );
  $("#editPartner").addEventListener("click", () =>
    openPartnerForm({ ...p, ...profile }),
  );
  $("#archivePartner").addEventListener("click", async () => {
    if (confirm("Arquivar este parceiro?")) {
      await api("partners", { id }, { method: "DELETE" });
      closeModal();
      route();
    }
  });
  $("#addTask").addEventListener("click", () => openTaskForm(p.id));
  $$(".complete-task").forEach((b) =>
    b.addEventListener("click", async () => {
      await api(
        "tasks",
        { id: b.dataset.id },
        { method: "PUT", body: { status: "Concluida" } },
      );
      openPartnerDetail(id);
    }),
  );
}
function profileHtml(t, p) {
  if (t === "investor")
    return `<p><strong>Capital disponivel:</strong> ${money(p.available_capital)}</p><p><strong>Valor potencial:</strong> ${money(p.potential_value)}</p><p><strong>Perfil:</strong> ${esc(p.financial_profile || "-")}</p><p><strong>Decisao:</strong> ${esc(p.decision_capacity || "-")}</p><p><strong>Due diligence:</strong> ${esc(p.due_diligence_status || "-")}</p>`;
  if (t === "operator")
    return `<p><strong>Experiencia:</strong> ${esc(p.sector_experience || "-")}</p><p><strong>Gestao:</strong> ${esc(p.management_experience || "-")}</p><p><strong>Disponibilidade:</strong> ${esc(p.operational_availability || "-")}</p><p><strong>Confianca:</strong> ${esc(p.trust_level || "-")}</p>`;
  return `<p><strong>Local:</strong> ${esc(p.land_location || "-")}</p><p><strong>Area:</strong> ${esc(p.area_size || "-")} m2</p><p><strong>Preco:</strong> ${money(p.asking_price)}</p><p><strong>Potencial:</strong> ${esc(p.commercial_potential || "-")}</p><p><strong>Documentacao:</strong> ${esc(p.documentation_status || "-")}</p>`;
}
function openPartnerForm(data = {}) {
  openModal(
    data.id ? "Editar Parceiro" : "Novo Parceiro",
    `<form id="partnerForm"><input type="hidden" name="id" value="${esc(data.id || "")}"><div class="form-row"><label class="form-group"><span class="form-label">Tipo</span><select class="form-select" name="type" id="formType"><option value="investor">Investidor</option><option value="operator">Socio Gestor</option><option value="landowner">Proprietario de Terreno</option></select></label><label class="form-group"><span class="form-label">Nome</span><input class="form-input" name="name" required value="${esc(data.name || "")}"></label><label class="form-group"><span class="form-label">Responsavel</span><select class="form-select" name="responsible_user_id"><option value="">Sem responsavel</option>${CRM.users.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></label></div><div class="form-row"><label class="form-group"><span class="form-label">Telefone</span><input class="form-input" name="phone" value="${esc(data.phone || "")}"></label><label class="form-group"><span class="form-label">WhatsApp</span><input class="form-input" name="whatsapp" value="${esc(data.whatsapp || "")}"></label><label class="form-group"><span class="form-label">Email</span><input class="form-input" type="email" name="email" value="${esc(data.email || "")}"></label></div><div class="form-row"><label class="form-group"><span class="form-label">Cidade</span><input class="form-input" name="city" value="${esc(data.city || "")}"></label><label class="form-group"><span class="form-label">UF</span><input class="form-input" name="state" maxlength="2" value="${esc(data.state || "")}"></label><label class="form-group"><span class="form-label">Origem</span><input class="form-input" name="source" value="${esc(data.source || "")}"></label></div><div class="form-row"><label class="form-group"><span class="form-label">Temperatura</span><select class="form-select" name="temperature"><option>Frio</option><option>Morno</option><option>Quente</option><option>Muito Quente</option></select></label><label class="form-group"><span class="form-label">Etapa</span><input class="form-input" name="pipeline_stage" value="${esc(data.pipeline_stage || "")}"></label><label class="form-group"><span class="form-label">Proxima acao</span><input class="form-input" name="next_action" value="${esc(data.next_action || "")}"></label></div><div class="form-row"><label class="form-group"><span class="form-label">Capital disponivel</span><input class="form-input" type="number" name="available_capital" value="${esc(data.available_capital || "")}"></label><label class="form-group"><span class="form-label">Valor potencial / preco</span><input class="form-input" type="number" name="potential_value" value="${esc(data.potential_value || data.asking_price || "")}"></label><label class="form-group"><span class="form-label">Area do terreno</span><input class="form-input" type="number" name="area_size" value="${esc(data.area_size || "")}"></label></div><label class="form-group"><span class="form-label">Local do terreno</span><input class="form-input" name="land_location" value="${esc(data.land_location || "")}"></label><label class="form-group"><span class="form-label">Notas</span><textarea class="form-textarea" name="notes" rows="4">${esc(data.notes || "")}</textarea></label><div class="page-actions"><button type="button" class="btn btn-secondary" id="cancelPartner">Cancelar</button><button class="btn btn-primary"><span class="material-symbols-outlined">save</span>Salvar</button></div></form>`,
  );
  $("#formType").value = data.type || "investor";
  $('[name="temperature"]').value = data.temperature || "Morno";
  $('[name="responsible_user_id"]').value = data.responsible_user_id || "";
  $("#cancelPartner").addEventListener("click", closeModal);
  $("#partnerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!body.pipeline_stage)
      body.pipeline_stage =
        {
          investor: "Qualificacao",
          operator: "Analise de perfil",
          landowner: "Coleta de informacoes",
        }[body.type] || "Novo lead";
    body.asking_price = body.potential_value;
    await api("partners", body.id ? { id: body.id } : {}, {
      method: body.id ? "PUT" : "POST",
      body,
    });
    closeModal();
    toast("Parceiro salvo");
    location.hash = "#/parceiros";
    route();
  });
}
async function openTaskForm(partnerId = "") {
  if (!CRM.partners.length)
    CRM.partners = (await api("partners")).partners || [];
  openModal(
    "Nova Tarefa",
    `<form id="taskForm"><label class="form-group"><span class="form-label">Parceiro</span><select class="form-select" name="partner_id" required>${CRM.partners.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label><label class="form-group"><span class="form-label">Titulo</span><input class="form-input" name="title" required></label><label class="form-group"><span class="form-label">Descricao</span><textarea class="form-textarea" name="description"></textarea></label><div class="form-row"><label class="form-group"><span class="form-label">Data</span><input class="form-input" type="datetime-local" name="due_date" required></label><label class="form-group"><span class="form-label">Prioridade</span><select class="form-select" name="priority"><option>Alta</option><option>Media</option><option>Baixa</option></select></label></div><button class="btn btn-primary"><span class="material-symbols-outlined">save</span>Salvar</button></form>`,
  );
  if (partnerId) $('[name="partner_id"]').value = partnerId;
  $("#taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    await api("tasks", {}, { method: "POST", body });
    closeModal();
    route();
  });
}
function openModal(t, h) {
  $("#modalTitle").textContent = t;
  $("#modalBody").innerHTML = h;
  $("#modalBackdrop").classList.add("active");
}
function closeModal() {
  $("#modalBackdrop").classList.remove("active");
}
init().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="empty-state"><strong>Erro ao iniciar CRM</strong><p>${esc(err.message)}</p></div>`;
});
