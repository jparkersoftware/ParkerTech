import { signOutNow } from './AuthProvider';

export default function NotAuthorized({ email }: { email: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Not authorized
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {email ? <>The account <strong>{email}</strong> isn't allowed here.</> : 'This account isn\'t allowed here.'}
        </p>
        <button
          type="button"
          onClick={() => signOutNow()}
          className="mt-6 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
