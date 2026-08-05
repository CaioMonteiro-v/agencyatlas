/**
 * Atlas Assistente — análise territorial (regras + opcional OpenAI).
 */

function severityRank(status) {
  if (status === 'critical') return 3;
  if (status === 'attention') return 2;
  if (status === 'good' || status === 'ok') return 0;
  return 1;
}

function buildLocalBriefing(report) {
  const lines = [];
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

  lines.push(`Atlas Assistente — briefing de ${now}`);
  lines.push('');
  lines.push('## Leitura geral');
  lines.push(report.executive_summary);
  lines.push('');

  if (report.alarms.length) {
    lines.push('## Alarmes prioritários');
    for (const a of report.alarms.slice(0, 12)) {
      lines.push(`- [${a.severity.toUpperCase()}] ${a.coordinator_name} · ${a.municipality_name}: ${a.message}`);
      if (a.action) lines.push(`  → Ação sugerida: ${a.action}`);
    }
    lines.push('');
  } else {
    lines.push('## Alarmes');
    lines.push('Nenhum alarme crítico no momento. Manter ritmo de conteúdo e cadastros.');
    lines.push('');
  }

  lines.push('## Chamada de atenção por coordenador');
  const byCoord = [...report.coordinators].sort(
    (a, b) => severityRank(b.health.status) - severityRank(a.health.status),
  );

  for (const c of byCoord) {
    const votePct = c.totals.vote_expectation > 0
      ? Math.round((c.totals.registrations / c.totals.vote_expectation) * 100)
      : null;
    const contentPct = c.totals.content_views_expected > 0
      ? Math.round((c.totals.content_views_actual / c.totals.content_views_expected) * 100)
      : null;

    lines.push(`### ${c.name} — ${c.health.label}`);
    lines.push(
      `Municípios: ${c.totals.municipalities} · Cadastros: ${c.totals.registrations}`
      + (votePct != null ? ` · Expectativa de voto: ${votePct}% da meta` : '')
      + (contentPct != null ? ` · Conteúdo visto: ${contentPct}% da meta` : ''),
    );

    const fails = (c.municipalities || []).filter((m) => m.alarms?.length);
    if (fails.length) {
      lines.push('Pontos de falha:');
      for (const m of fails.slice(0, 6)) {
        lines.push(`- ${m.name}: ${m.alarms.map((x) => x.message).join('; ')}`);
      }
      lines.push(`Roteiro de ligação: cobrar reforço de conteúdo e cadastro em ${fails.map((m) => m.name).slice(0, 3).join(', ')}.`);
    } else {
      lines.push('Roteiro: reforçar o que está funcionando e pedir avanço nos municípios mais fracos da média.');
    }
    lines.push('');
  }

  lines.push('## Próximos passos sugeridos');
  for (const step of report.next_steps) {
    lines.push(`- ${step}`);
  }

  return lines.join('\n');
}

async function enrichWithOpenAI(localText, report) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { source: 'atlas-local', text: localText };
  }

  try {
    const prompt = `Você é a Atlas Assistente, analista de campanha majoritária em Mato Grosso (Fábio Garcia — Vice-Governador).
Reescreva o briefing abaixo em português brasileiro, tom direto e operacional para ligar para coordenadores.
Foque em cobertura estadual, municípios estratégicos e conversão. Mantenha números e nomes. No máximo 700 palavras. Inclua seções claras.

BRIEFING BASE:
${localText}

RESUMO JSON (para precisão):
${JSON.stringify({
  summary: report.executive_summary,
  alarms: report.alarms.slice(0, 15),
  next_steps: report.next_steps,
})}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Assistente de campanha Atlas Agency. Respostas em PT-BR.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        source: 'atlas-local',
        text: localText,
        openai_error: data?.error?.message || `OpenAI HTTP ${res.status}`,
      };
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    return { source: 'openai', text: text || localText };
  } catch (err) {
    return { source: 'atlas-local', text: localText, openai_error: err.message };
  }
}

async function runAssistant(report) {
  const localText = buildLocalBriefing(report);
  return enrichWithOpenAI(localText, report);
}

module.exports = { buildLocalBriefing, runAssistant };
