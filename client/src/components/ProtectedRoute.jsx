import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { EmptyState } from '../components/Ui';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container section">
        <EmptyState>Verificando acesso…</EmptyState>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
