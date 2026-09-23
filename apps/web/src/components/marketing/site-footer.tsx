import { useRouteContext } from '@tanstack/react-router';

import { DOCS_HREF } from '#/lib/agent-prompt';

const linkClass =
  'text-zinc-500 transition-colors duration-[120ms] hover:text-zinc-50';

const FOOTER_LINKS = [
  { href: DOCS_HREF, label: 'Docs' },
  { href: 'https://github.com/openenvx/functhis', label: 'GitHub' },
  { href: 'https://mcp.functhis.now/mcp', label: 'MCP' },
] as const;

const LICENSE_HREF = 'https://github.com/openenvx/functhis/blob/main/LICENSE';

export const SiteFooter = () => {
  const { consoleUrl } = useRouteContext({ from: '__root__' });

  return (
    <footer className="w-full border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p>
          Functhis is{' '}
          <a
            className={linkClass}
            href={LICENSE_HREF}
            rel="noopener noreferrer"
            target="_blank"
          >
            free and open source (MIT)
          </a>
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {FOOTER_LINKS.map((link, index) => (
              <li className="flex items-center gap-1" key={link.label}>
                {index > 0 ? (
                  <span aria-hidden="true" className="text-zinc-600">
                    ·
                  </span>
                ) : null}
                <a
                  className={linkClass}
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="flex items-center gap-1">
              <span aria-hidden="true" className="text-zinc-600">
                ·
              </span>
              <a className={linkClass} href={`${consoleUrl}/login`}>
                Console
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
};
