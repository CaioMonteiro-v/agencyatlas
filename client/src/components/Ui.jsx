export function Avatar({ name, photo, size }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="avatar" style={size ? { width: size, height: size, fontSize: size * 0.35 } : undefined}>
      {photo ? <img src={photo} alt={name} /> : initials}
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    ativa: { className: 'badge', label: 'Ativa' },
    planejamento: { className: 'badge badge-info', label: 'Planejamento' },
    ativo: { className: 'badge', label: 'Ativo' },
    inativo: { className: 'badge badge-warn', label: 'Inativo' },
    concluida: { className: 'badge badge-info', label: 'Concluída' },
    pausada: { className: 'badge badge-warn', label: 'Pausada' },
  };
  const item = map[status] || { className: 'badge', label: status };
  return <span className={item.className}>{item.label}</span>;
}

export function EmptyState({ children }) {
  return <div className="empty">{children}</div>;
}

export function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" onClick={onClose}>
      {message}
    </div>
  );
}
