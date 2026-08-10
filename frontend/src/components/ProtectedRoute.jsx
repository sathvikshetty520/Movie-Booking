import { Navigate } from 'react-router-dom';
import { useApp } from '../AppContext';

export default function ProtectedRoute({ children }) {
  const { user, authLoading } = useApp();

  if (authLoading) return <div className="page"><p className="hint">Loading…</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}