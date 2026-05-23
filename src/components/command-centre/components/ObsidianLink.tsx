/**
 * Small "Open in Obsidian" link that uses the obsidian:// URI scheme.
 * Works when Obsidian is running locally and the named vault exists.
 *
 * The vault name must match the user's local Obsidian vault folder name
 * (ParkerTechFire). Slugs are produced by `entitySlug()` in
 * lib/vaultMarkdown.ts and must stay in sync with that function.
 */

const VAULT_NAME = 'ParkerTechFire';

export default function ObsidianLink({
  file,
  label = 'Open in Obsidian',
}: {
  /** Vault-relative path without `.md` extension, e.g. `Clients/Cavendish-Education`. */
  file: string;
  label?: string;
}) {
  const href = `obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(file)}`;
  return (
    <a
      href={href}
      className="cc-btn-ghost"
      title={`obsidian://open?vault=${VAULT_NAME}&file=${file}`}
    >
      {label}
    </a>
  );
}
