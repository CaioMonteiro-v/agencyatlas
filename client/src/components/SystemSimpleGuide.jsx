/**
 * Guia do Atlas em linguagem simples — para quem não é da área técnica.
 */
export default function SystemSimpleGuide({ campaign }) {
  const name = campaign?.candidate || campaign?.name || 'a campanha';

  return (
    <div className="system-guide">
      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <p className="eyebrow">Para qualquer pessoa da equipe</p>
        <h3 style={{ marginTop: 0 }}>O que é o Atlas, em uma frase</h3>
        <p className="report-lead" style={{ marginBottom: 0 }}>
          É o painel da campanha de <strong>{name}</strong>: organiza quem se cadastra,
          quem cuida de cada cidade, os grupos de WhatsApp, os vídeos e o que a equipe
          precisa resolver no dia a dia.
        </p>
      </section>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Como a pessoa chega até a gente</h3>
        <ol className="system-guide__steps">
          <li>
            <strong>QR Code no evento</strong> — a pessoa aponta a câmera, coloca nome e telefone
            (e-mail é opcional) e já pode falar no WhatsApp.
          </li>
          <li>
            <strong>Link de um mobilizador</strong> — alguém da equipe manda um link pessoal;
            o cadastro fica no nome dele.
          </li>
          <li>
            <strong>Link de uma liderança</strong> — mesma ideia, crédito para a liderança.
          </li>
        </ol>
        <p style={{ marginBottom: 0, color: 'var(--muted)' }}>
          Tudo isso cai na lista de cadastros e aparece no mapa e no ranking.
        </p>
      </section>

      <div className="layout-split" style={{ marginBottom: '1rem' }}>
        <section className="panel panel-pad">
          <h3 style={{ marginTop: 0 }}>O que cada aba faz</h3>
          <ul className="system-guide__list">
            <li>
              <strong>Visão Geral</strong> — resumo rápido da campanha.
            </li>
            <li>
              <strong>Mobilização</strong> — o dia a dia: mapa das cidades, ranking de quem
              mais cadastra, eventos com QR, missões e a lista de pessoas.
            </li>
            <li>
              <strong>Coordenadores</strong> — quem cuida de cada região e como está o
              desempenho (incluindo Instagram, se estiver conectado).
            </li>
            <li>
              <strong>Relatório</strong> — esta tela: guia simples, o que aconteceu nas cidades
              e o panorama para reunião.
            </li>
            <li>
              <strong>Investimento</strong> — o que o mandato/campanha entregou em cada cidade
              (dossiê para mostrar no município).
            </li>
            <li>
              <strong>Grupos Dobra</strong> — grupos de WhatsApp por Deputado Estadual
              (foto, quantas pessoas, link do grupo).
            </li>
            <li>
              <strong>Bitly</strong> — quando sai um vídeo, gera um link diferente para cada
              grupo e mostra quem clicou.
            </li>
            <li>
              <strong>Conteúdo</strong> — posts da semana e quem deve dobrar em cada cidade.
            </li>
          </ul>
        </section>

        <section className="panel panel-pad">
          <h3 style={{ marginTop: 0 }}>Duas ideias importantes</h3>
          <article className="system-guide__card">
            <p className="eyebrow">1. Cadastro ≠ clique no vídeo</p>
            <p>
              <strong>Cadastro</strong> = a pessoa entrou na base (QR ou link).
              <br />
              <strong>Clique no Bitly</strong> = a pessoa abriu o link do vídeo
              que você mandou no grupo.
            </p>
          </article>
          <article className="system-guide__card">
            <p className="eyebrow">2. Dois tipos de link Bitly</p>
            <p>
              <strong>Convite do grupo</strong> — para a pessoa <em>entrar</em> no WhatsApp.
              <br />
              <strong>Link do vídeo</strong> — um por grupo, para ver quem abriu
              aquele conteúdo.
            </p>
          </article>
          <article className="system-guide__card">
            <p className="eyebrow">Como a dobra se organiza</p>
            <p style={{ marginBottom: 0 }}>
              <strong>Deputado Estadual</strong> (ex.: Beto Dois a Um)
              → <strong>nosso coordenador</strong> da campanha
              → <strong>coordenador das dobras</strong>
              → os <strong>grupos</strong> de WhatsApp.
            </p>
          </article>
        </section>
      </div>

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Roteiro simples do dia</h3>
        <ol className="system-guide__steps">
          <li>Olhar <strong>Mobilização</strong>: mapa e cadastros novos.</li>
          <li>Se tiver evento, gerar o <strong>QR</strong> e acompanhar quem chega.</li>
          <li>Postou vídeo? Ir em <strong>Bitly</strong> → cadastrar o vídeo → gerar links para os grupos.</li>
          <li>Mandar cada link no grupo certo e depois atualizar os cliques.</li>
          <li>
            Anotar problemas por cidade em{' '}
            <strong>Relatório → O que aconteceu nas cidades</strong>.
          </li>
        </ol>
      </section>

      <section className="panel panel-pad">
        <h3 style={{ marginTop: 0 }}>Se algo “não puxar”</h3>
        <ul className="system-guide__list" style={{ marginBottom: 0 }}>
          <li>
            <strong>Instagram não atualiza</strong> — o acesso ao Instagram pode ter expirado;
            a equipe técnica renova. Enquanto isso, dá para anotar números na mão.
          </li>
          <li>
            <strong>Bitly não cria link</strong> — falta configurar o Bitly no servidor, ou o grupo
            ainda não tem o convite do WhatsApp.
          </li>
          <li>
            <strong>QR não abre no celular</strong> — use o link do site no ar
            (o endereço público da campanha), não o do computador local.
          </li>
        </ul>
      </section>
    </div>
  );
}
