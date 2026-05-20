import { signOutNow } from './AuthProvider';

export default function NotAuthorized({ email }: { email: string | null }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6">
      <div className="cc-card w-full max-w-sm p-8 text-center">
        <p className="cc-eyebrow">ParkerTech</p>
        <h1 className="cc-display mt-2 text-2xl">Not authorized</h1>
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          {email ? (
            <>The account <strong>{email}</strong> isn't allowed here.</>
          ) : (
            "This account isn't allowed here."
          )}
        </p>
        <button
          type="button"
          onClick={() => signOutNow()}
          className="cc-btn-primary mt-6 w-full"
        >
          Sign out
        </button>
      </div>
      <a href="/" className="cc-back-link">
        ← Back to parkertech.co.uk
      </a>
    </div>
  );
}
