import { Navigate } from 'react-router-dom';
import { useApp } from '../AppContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, authLoading } = useApp();

  if (authLoading) return <div className="page"><p className="hint">Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/" replace />;

  return children;
}