import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, LockKeyhole } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { MOCK_ACCOUNTS } from "../mock/data";
import { ROLE_LABEL } from "../components/layout/navConfig";

export function LoginPage() {
  const { user, login } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(usuario, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="text-2xl font-extrabold italic tracking-tight text-ink-900">
            ADEMINCOL <span className="text-brand-600">Central</span>
          </span>
          <p className="mt-1 text-sm text-ink-500">Plataforma unificada de reportes de inspección</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border-t-4 border-brand-600 bg-white p-8 shadow-sm"
        >
          <h1 className="mb-6 text-lg font-bold text-ink-900">Iniciar sesión</h1>

          <label className="mb-1 block text-sm font-medium text-ink-700">Usuario</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            placeholder="admin"
            autoComplete="username"
          />

          <label className="mb-1 block text-sm font-medium text-ink-700">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-2 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {error && (
            <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
            Ingresar
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-ink-200 bg-white p-4 text-xs text-ink-500">
          <p className="mb-2 font-semibold text-ink-700">Cuentas demo (contraseña: Demo2026*)</p>
          <ul className="space-y-1">
            {MOCK_ACCOUNTS.map((a) => (
              <li key={a.usuario} className="flex justify-between">
                <span className="font-mono">{a.usuario}</span>
                <span>{ROLE_LABEL[a.user.rol]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
