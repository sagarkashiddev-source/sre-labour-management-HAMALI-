import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Role } from '../api/client';

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

export function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}

export function roleHome(role: Role): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'OWNER') return '/owner';
  return '/labour';
}

function FullScreenLoader() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading...</div>;
}
