import { Link } from '@tanstack/react-router';

import { BrandMark } from '#/components/brand-mark';
import { DOCS_HREF } from '#/lib/agent-prompt';

const Header = () => (
  <header className="sticky top-0 z-40 bg-zinc-950/70 backdrop-blur-xl backdrop-saturate-150">
    <div className="flex min-h-16 items-center justify-between gap-4 px-6 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-5">
        <Link
          className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-zinc-50"
          to="/"
        >
          <BrandMark />
          functhis
        </Link>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <a
          className="hidden text-sm font-medium text-zinc-500 hover:text-zinc-50 sm:block"
          href={DOCS_HREF}
          rel="noopener noreferrer"
          target="_blank"
        >
          Docs
        </a>
        <div className="flex items-center gap-2">
          <Link
            className="rounded-md bg-zinc-50 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-950 hover:bg-zinc-200 sm:px-3"
            search={{ callbackURL: '/d' }}
            to="/login"
          >
            Log in
          </Link>
          <Link
            className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-50 hover:bg-zinc-900 sm:px-3"
            search={{ callbackURL: '/d' }}
            to="/login"
          >
            <span className="sm:hidden">Sign up</span>
            <span className="hidden sm:inline">Sign up for free</span>
          </Link>
        </div>
      </div>
    </div>
  </header>
);

export default Header;
