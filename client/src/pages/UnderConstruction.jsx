export default function UnderConstruction({ title }) {
  return (
    <div className="container section" style={{ paddingTop: 0 }}>
      <div className="panel under-construction">
        <div>
          <div className="under-construction__art" aria-hidden="true" />
          <p className="eyebrow">{title}</p>
          <h2>Em Construção</h2>
          <p>
            Esta seção será desenvolvida em breve com ferramentas de gestão de mídia,
            tráfego e criação de conteúdo para a campanha.
          </p>
        </div>
      </div>
    </div>
  );
}
