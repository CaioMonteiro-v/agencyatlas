/**
 * Conteúdo da semana — cobrança territorial (funciona sem Meta API).
 */

function assignmentHealth(a) {
  const target = Math.max(0, Number(a.target_views || 0));
  const actual = Math.max(0, Number(a.actual_views || 0));
  if (a.status === 'feito') {
    return { status: 'good', label: 'Feito', detail: 'Missão de conteúdo concluída' };
  }
  if (a.status === 'falhou') {
    return { status: 'critical', label: 'Falhou', detail: 'Conteúdo não circulou como combinado' };
  }
  if (!target) {
    return { status: 'attention', label: 'Sem meta', detail: 'Defina meta de views para cobrar' };
  }
  const pct = actual / target;
  if (pct < 0.35) {
    return { status: 'critical', label: 'Parado', detail: `Só ${Math.round(pct * 100)}% da meta de views` };
  }
  if (pct < 0.8) {
    return { status: 'attention', label: 'Abaixo', detail: `${Math.round(pct * 100)}% da meta — reforçar dobra` };
  }
  return { status: 'good', label: 'No ritmo', detail: `${Math.round(pct * 100)}% da meta` };
}

function enrichAssignment(db, row) {
  const coordinator = row.coordinator_id
    ? db.prepare('SELECT id, name FROM coordinators WHERE id = ?').get(row.coordinator_id)
    : null;
  const municipality = row.municipality_id
    ? db.prepare('SELECT id, name FROM municipalities WHERE id = ?').get(row.municipality_id)
    : null;
  const health = assignmentHealth(row);
  const target = Math.max(0, Number(row.target_views || 0));
  const actual = Math.max(0, Number(row.actual_views || 0));
  return {
    ...row,
    coordinator_name: coordinator?.name || null,
    municipality_name: municipality?.name || null,
    progress_pct: target ? Math.round((actual / target) * 1000) / 10 : null,
    health,
  };
}

function buildContentDetail(db, post) {
  const assignments = db.prepare(`
    SELECT * FROM content_assignments
    WHERE content_post_id = ?
    ORDER BY id DESC
  `).all(post.id).map((a) => enrichAssignment(db, a));

  const critical = assignments.filter((a) => a.health.status === 'critical').length;
  const attention = assignments.filter((a) => a.health.status === 'attention').length;
  const done = assignments.filter((a) => a.status === 'feito' || a.health.status === 'good').length;

  return {
    ...post,
    assignments,
    totals: {
      assignments: assignments.length,
      critical,
      attention,
      on_track: done,
      target_views: assignments.reduce((s, a) => s + Number(a.target_views || 0), 0),
      actual_views: assignments.reduce((s, a) => s + Number(a.actual_views || 0), 0),
    },
  };
}

function listContentWeek(db, campaignId) {
  const posts = db.prepare(`
    SELECT * FROM content_posts
    WHERE campaign_id = ? AND status != 'arquivada'
    ORDER BY id DESC
  `).all(campaignId)
    .sort((a, b) => {
      const da = String(a.posted_at || a.created_at || '');
      const dbv = String(b.posted_at || b.created_at || '');
      return dbv.localeCompare(da);
    })
    .map((p) => buildContentDetail(db, p));

  const alarms = [];
  for (const post of posts) {
    for (const a of post.assignments) {
      if (a.health.status === 'critical' || a.health.status === 'attention') {
        alarms.push({
          content_post_id: post.id,
          content_title: post.title,
          assignment_id: a.id,
          coordinator_id: a.coordinator_id,
          coordinator_name: a.coordinator_name,
          municipality_id: a.municipality_id,
          municipality_name: a.municipality_name,
          severity: a.health.status === 'critical' ? 'critical' : 'attention',
          message: `${a.coordinator_name || 'Coord.'}${a.municipality_name ? ` · ${a.municipality_name}` : ''}: ${a.health.detail}`,
          action: 'Cobrar dobra do conteúdo nesta cidade',
        });
      }
    }
  }

  const summary = {
    posts: posts.length,
    assignments: posts.reduce((s, p) => s + p.totals.assignments, 0),
    critical: alarms.filter((a) => a.severity === 'critical').length,
    attention: alarms.filter((a) => a.severity === 'attention').length,
    target_views: posts.reduce((s, p) => s + p.totals.target_views, 0),
    actual_views: posts.reduce((s, p) => s + p.totals.actual_views, 0),
  };

  return { posts, alarms, summary };
}

module.exports = {
  assignmentHealth,
  buildContentDetail,
  listContentWeek,
};
