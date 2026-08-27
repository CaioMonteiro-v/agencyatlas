/**
 * Caixa de consentimento LGPD / proteção de dados.
 * Reutilizada em QR de evento, link de liderança e link de mobilizador.
 * Não muda a URL — os QR Codes e links já impressos continuam iguais.
 */
export const LGPD_CONSENT_TEXT =
  'Autorizo o uso dos meus dados (nome, telefone e e-mail, se informado) '
  + 'para comunicação e mobilização desta campanha, conforme a Lei Geral '
  + 'de Proteção de Dados (LGPD — Lei nº 13.709/2018).';

export default function LgpdConsentBox({ checked, onChange, id = 'lgpd-consent' }) {
  return (
    <label className="lgpd-consent" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="lgpd-consent__input"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span className="lgpd-consent__text">
        <strong>Proteção de dados (LGPD)</strong>
        {' '}
        {LGPD_CONSENT_TEXT}
      </span>
    </label>
  );
}
