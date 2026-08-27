/**
 * Saúde territorial, alarmes de conteúdo/voto e montagem de relatório.
 */

function pct(n, d) {
  if (!d) return null;
  return Math.round((n / d) * 1000) / 10;
}

function assessMunicipalityHealth(regs, leadersCount, avgRegs) {
  if (regs === 0 && leadersCount === 0) {
    return {
      status: 'critical',
      label: 'Sem movimento',
      detail: 'Sem cadastros e sem lideranças neste município',
    };
  }
  if (regs === 0) {
    return {
      status: 'critical',
      label: 'Falha',
      detail: 'Há liderança, mas nenhum cadastro recebido',
    };
  }
  if (avgRegs > 0 && regs < avgRegs * 0.4) {
    return {
      status: 'attention',
      label: 'Atenção',
      detail: 'Recebendo abaixo da média da coordenação',
    };
  }
  if (avgRegs > 0 && regs >= avgRegs * 1.2) {
    return {
      status: 'good',
      label: 'Forte',
      detail: 'Acima da média da coordenação',
    };
  }
  return {
    status: 'ok',
    label: 'Tranquilo',
    detail: 'Recebendo cadastros normalmente',
  };
}

function buildMunicipalityAlarms(m, thresholds) {
  const alarms = [];
  const contentThreshold = thresholds.content_views_threshold ?? 0.5;
  const voteThreshold = thresholds.vote_progress_threshold ?? 0.15;

  const viewsExp = Number(m.content_views_expected || 0);
  const viewsAct = Number(m.content_views_actual || 0);
  const voteExp = Number(m.vote_expectation || 0);
  const regs = Number(m.registrations_count || 0);
  const igComments = Number(m.ig_comments || 0);

  if (viewsExp > 0 && viewsAct < viewsExp * contentThreshold) {
    alarms.push({
      type: 'content_reach',
      severity: viewsAct === 0 ? 'critical' : 'attention',
      message: `Conteúdo abaixo da meta: ${viewsAct} de ${viewsExp} visualizações esperadas`,
      action: 'Cobrar reforço de compartilhamento no WhatsApp/Instagram do município',
    });
  }

  if (viewsExp > 0 && viewsAct === 0) {
    alarms.push({
      type: 'content_zero',
      severity: 'critical',
      message: 'Ninguém está visualizando o conteúdo neste município',
      action: 'Disparo imediato de conteúdo e checagem com lideranças locais',
    });
  }

  if (voteExp > 0 && regs < voteExp * voteThreshold) {
    alarms.push({
      type: 'vote_expectation',
      severity: regs === 0 ? 'critical' : 'attention',
      message: `Cadastros em ${pct(regs, voteExp)}% da expectativa de voto (${regs}/${voteExp})`,
      action: 'Acelerar captação e revisar links parametrizados',
    });
  }

  if (viewsAct >= 50 && igComments === 0) {
    alarms.push({
      type: 'ig_engagement',
      severity: 'attention',
      message: 'Há alcance, mas sem comentários no Instagram associados',
      action: 'Pedir engajamento (comentário/compartilhamento) das lideranças',
    });
  }

  if (m.health?.status === 'critical') {
    alarms.push({
      type: 'registration_failure',
      severity: 'critical',
      message: m.health.detail,
      action: 'Chamada de atenção ao coordenador sobre mobilização local',
    });
  }

  // Deduplicate by type keeping highest severity
  const rank = { critical: 2, attention: 1 };
  const map = new Map();
  for (const a of alarms) {
    const prev = map.get(a.type);
    if (!prev || (rank[a.severity] || 0) > (rank[prev.severity] || 0)) map.set(a.type, a);
  }
  return [...map.values()];
}

function worstSeverity(alarms, healthStatus) {
  if (alarms.some((a) => a.severity === 'critical') || healthStatus === 'critical') return 'critical';
  if (alarms.some((a) => a.severity === 'attention') || healthStatus === 'attention') return 'attention';
  if (healthStatus === 'good') return 'good';
  if (healthStatus === 'empty') return 'empty';
  return 'ok';
}

function listCoordinatorLeaders(db, campaignId, coordinatorId, campaignSlug = null) {
  const rows = db.prepare(`
    SELECT
      l.id,
      l.name,
      l.type,
      l.status,
      l.phone,
      l.referral_code,
      l.municipality_id,
      m.name AS municipality_name,
      COALESCE((
        SELECT COUNT(*) FROM registrations r WHERE r.leader_id = l.id
      ), 0) AS registrations_count
    FROM leaders l
    JOIN coordinator_municipalities cm ON cm.municipality_id = l.municipality_id
    LEFT JOIN municipalities m ON m.id = l.municipality_id
    WHERE cm.coordinator_id = ?
      AND l.campaign_id = ?
    ORDER BY registrations_count DESC, l.name ASC
  `).all(coordinatorId, campaignId);

  return rows.map((row) => ({
    ...row,
    link_path: campaignSlug && row.referral_code
      ? `/r/${campaignSlug}/${row.referral_code}`
      : null,
  }));
}

function buildCoordinatorDetail(db, campaign, coordinator, thresholds = {}) {
  const munis = db.prepare(`
    SELECT
      m.*,
      cm.vote_expectation,
      cm.content_views_expected,
      cm.content_views_actual,
      cm.ig_comments,
      cm.ig_reach,
      cm.last_meta_sync,
      COALESCE((
        SELECT COUNT(*) FROM registrations r
        WHERE r.municipality_id = m.id AND r.campaign_id = ?
      ), 0) AS registrations_count,
      COALESCE((
        SELECT COUNT(*) FROM leaders l
        WHERE l.municipality_id = m.id AND l.campaign_id = ?
      ), 0) AS leaders_count
    FROM coordinator_municipalities cm
    JOIN municipalities m ON m.id = cm.municipality_id
    WHERE cm.coordinator_id = ?
    ORDER BY registrations_count DESC, m.name ASC
  `).all(campaign.id, campaign.id, coordinator.id);

  const totalRegs = munis.reduce((s, m) => s + Number(m.registrations_count || 0), 0);
  const avg = munis.length ? totalRegs / munis.length : 0;

  const municipalities = munis.map((m) => {
    const regs = Number(m.registrations_count || 0);
    const leadersCount = Number(m.leaders_count || 0);
    const health = assessMunicipalityHealth(regs, leadersCount, avg);
    const share_pct = totalRegs > 0 ? Math.round((regs / totalRegs) * 1000) / 10 : 0;
    const vote_expectation = Number(m.vote_expectation || 0);
    const content_views_expected = Number(m.content_views_expected || 0);
    const content_views_actual = Number(m.content_views_actual || 0);
    const ig_comments = Number(m.ig_comments || 0);
    const ig_reach = Number(m.ig_reach || 0);
    const row = {
      ...m,
      registrations_count: regs,
      leaders_count: leadersCount,
      vote_expectation,
      content_views_expected,
      content_views_actual,
      ig_comments,
      ig_reach,
      health,
      share_pct,
      vote_progress_pct: pct(regs, vote_expectation),
      content_progress_pct: pct(content_views_actual, content_views_expected),
    };
    row.alarms = buildMunicipalityAlarms(row, thresholds);
    row.alarm_level = worstSeverity(row.alarms, health.status);
    return row;
  });

  const critical = municipalities.filter((m) => m.alarm_level === 'critical').length;
  const attention = municipalities.filter((m) => m.alarm_level === 'attention').length;
  const ok = municipalities.filter((m) => m.alarm_level === 'ok' || m.alarm_level === 'good').length;
  const alarmCount = municipalities.reduce((s, m) => s + m.alarms.length, 0);

  const voteExpectation = municipalities.reduce((s, m) => s + m.vote_expectation, 0);
  const contentExp = municipalities.reduce((s, m) => s + m.content_views_expected, 0);
  const contentAct = municipalities.reduce((s, m) => s + m.content_views_actual, 0);
  const igComments = municipalities.reduce((s, m) => s + m.ig_comments, 0);
  const igReach = municipalities.reduce((s, m) => s + m.ig_reach, 0);

  let health;
  if (municipalities.length === 0) {
    health = { status: 'empty', label: 'Sem municípios', detail: 'Vincule municípios a este coordenador' };
  } else if (critical > 0) {
    health = { status: 'critical', label: 'Com falhas', detail: `${critical} município(s) em alarme crítico` };
  } else if (attention > 0) {
    health = { status: 'attention', label: 'Atenção', detail: `${attention} município(s) precisam de reforço` };
  } else {
    health = { status: 'good', label: 'Tranquilo', detail: 'Municípios recebendo normalmente' };
  }

  const leaders = listCoordinatorLeaders(db, campaign.id, coordinator.id, campaign.slug);
  const peopleByLeaders = leaders.reduce((s, l) => s + Number(l.registrations_count || 0), 0);

  return {
    ...coordinator,
    municipalities,
    leaders,
    totals: {
      municipalities: municipalities.length,
      registrations: totalRegs,
      leaders: leaders.length,
      people_by_leaders: peopleByLeaders,
      critical,
      attention,
      ok,
      alarms: alarmCount,
      vote_expectation: voteExpectation,
      vote_progress_pct: pct(totalRegs, voteExpectation),
      content_views_expected: contentExp,
      content_views_actual: contentAct,
      content_progress_pct: pct(contentAct, contentExp),
      ig_comments: igComments,
      ig_reach: igReach,
    },
    health,
  };
}

function getThresholds(db, campaignId) {
  const row = db.prepare('SELECT * FROM campaign_meta_config WHERE campaign_id = ?').get(campaignId);
  return {
    content_views_threshold: row?.content_views_threshold ?? 0.5,
    vote_progress_threshold: row?.vote_progress_threshold ?? 0.15,
    ig_username: row?.ig_username || null,
    ig_user_id: row?.ig_user_id || null,
  };
}

function buildCampaignReport(db, campaign) {
  const thresholds = getThresholds(db, campaign.id);
  const rows = db.prepare(`
    SELECT * FROM coordinators WHERE campaign_id = ? ORDER BY name ASC
  `).all(campaign.id);

  const coordinators = rows.map((c) => buildCoordinatorDetail(db, campaign, c, thresholds));

  const alarms = [];
  for (const c of coordinators) {
    for (const m of c.municipalities) {
      for (const a of m.alarms) {
        alarms.push({
          ...a,
          coordinator_id: c.id,
          coordinator_name: c.name,
          municipality_id: m.id,
          municipality_name: m.name,
        });
      }
    }
  }

  alarms.sort((a, b) => {
    const rank = { critical: 2, attention: 1 };
    return (rank[b.severity] || 0) - (rank[a.severity] || 0);
  });

  const summary = {
    total_coordinators: coordinators.length,
    municipalities_assigned: coordinators.reduce((s, c) => s + c.totals.municipalities, 0),
    registrations: coordinators.reduce((s, c) => s + c.totals.registrations, 0),
    vote_expectation: coordinators.reduce((s, c) => s + c.totals.vote_expectation, 0),
    content_views_expected: coordinators.reduce((s, c) => s + c.totals.content_views_expected, 0),
    content_views_actual: coordinators.reduce((s, c) => s + c.totals.content_views_actual, 0),
    ig_comments: coordinators.reduce((s, c) => s + c.totals.ig_comments, 0),
    with_failures: coordinators.filter((c) => c.health.status === 'critical').length,
    alarms_critical: alarms.filter((a) => a.severity === 'critical').length,
    alarms_attention: alarms.filter((a) => a.severity === 'attention').length,
  };

  summary.vote_progress_pct = pct(summary.registrations, summary.vote_expectation);
  summary.content_progress_pct = pct(summary.content_views_actual, summary.content_views_expected);

  let executive_summary;
  if (!coordinators.length) {
    executive_summary = 'Ainda não há coordenadores cadastrados. Cadastre a equipe em /admin e vincule municípios com expectativa de voto e meta de conteúdo.';
  } else if (summary.alarms_critical > 0) {
    executive_summary = `Há ${summary.alarms_critical} alarme(s) crítico(s) em ${summary.with_failures} coordenação(ões). Priorize chamada de atenção imediata nos municípios sem conteúdo ou sem cadastro.`;
  } else if (summary.alarms_attention > 0) {
    executive_summary = `Campanha sob controle parcial: ${summary.alarms_attention} ponto(s) de atenção. Reforce conteúdo e captação onde a proporção está abaixo da meta.`;
  } else {
    executive_summary = `Cenário tranquilo entre ${summary.total_coordinators} coordenadores. Manter ritmo de conteúdo e acompanhar expectativa de voto (${summary.vote_progress_pct ?? 0}% da meta).`;
  }

  const next_steps = [];
  if (summary.alarms_critical > 0) {
    next_steps.push('Ligar hoje para coordenadores com alarme crítico e pedir plano de 48h por município.');
  }
  if (summary.content_progress_pct != null && summary.content_progress_pct < 50) {
    next_steps.push('Reforçar distribuição de conteúdos (WhatsApp + Instagram) nos municípios abaixo de 50% da meta de visualização.');
  }
  if (summary.vote_progress_pct != null && summary.vote_progress_pct < 20) {
    next_steps.push('Acelerar cadastros via links parametrizados e eventos locais.');
  }
  if (!process.env.META_ACCESS_TOKEN) {
    next_steps.push('Configurar Meta API (META_ACCESS_TOKEN + META_IG_USER_ID) para sincronizar comentários/alcance do Instagram automaticamente.');
  }
  next_steps.push('Usar a aba Relatório para gerar o briefing da Atlas Assistente antes das reuniões de coordenação.');

  const call_sheet = coordinators
    .filter((c) => c.health.status === 'critical' || c.health.status === 'attention')
    .map((c) => ({
      coordinator: c.name,
      phone: c.phone,
      status: c.health.label,
      municipalities_in_fail: c.municipalities
        .filter((m) => m.alarm_level === 'critical' || m.alarm_level === 'attention')
        .map((m) => ({
          name: m.name,
          alarms: m.alarms.map((a) => a.message),
        })),
      talking_points: [
        c.totals.vote_expectation
          ? `Expectativa de voto: ${c.totals.registrations}/${c.totals.vote_expectation} (${c.totals.vote_progress_pct ?? 0}%)`
          : 'Definir expectativa de voto nos municípios',
        c.totals.content_views_expected
          ? `Conteúdo: ${c.totals.content_views_actual}/${c.totals.content_views_expected} views (${c.totals.content_progress_pct ?? 0}%)`
          : 'Definir meta de visualização de conteúdo',
        ...c.municipalities
          .filter((m) => m.alarms.length)
          .slice(0, 3)
          .map((m) => `${m.name}: ${m.alarms[0].message}`),
      ],
    }));

  return {
    generated_at: new Date().toISOString(),
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      candidate: campaign.candidate,
    },
    thresholds,
    summary,
    executive_summary,
    alarms,
    coordinators,
    call_sheet,
    next_steps,
  };
}

module.exports = {
  assessMunicipalityHealth,
  buildMunicipalityAlarms,
  buildCoordinatorDetail,
  buildCampaignReport,
  getThresholds,
  listCoordinatorLeaders,
};
