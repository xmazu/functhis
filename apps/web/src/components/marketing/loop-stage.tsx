import { TOKEN_CLASS } from '#/components/marketing/agent-run-data';
import type { Token, TokenKind } from '#/components/marketing/agent-run-data';

const HEADING_ID = 'loop-heading';

interface WithoutRow {
  concern: string;
  path: string;
}

const WITHOUT_ROWS: WithoutRow[] = [
  { concern: 'endpoints', path: 'app/api/hello/route.ts' },
  { concern: 'hosting', path: 'wrangler.toml' },
  { concern: 'validation', path: 'lib/validate.ts' },
  { concern: 'auth', path: 'lib/auth.ts' },
  { concern: 'documentation', path: 'openapi.yaml' },
  { concern: 'MCP', path: 'mcp/server.ts' },
];

const t = (kind: TokenKind, text: string): Token => ({ kind, text });

const WITH_LINES: Token[][] = [
  [t('comment', '/** Greet someone by name. */')],
  [
    t('keyword', 'export'),
    t('plain', ' '),
    t('keyword', 'default'),
    t('plain', ' '),
    t('keyword', 'function'),
    t('plain', ' '),
    t('ident', 'hello'),
    t('punct', '('),
  ],
  [
    t('plain', '  '),
    t('property', 'input'),
    t('punct', ':'),
    t('plain', ' '),
    t('punct', '{'),
    t('plain', ' '),
    t('property', 'name'),
    t('punct', '?:'),
    t('plain', ' '),
    t('type', 'string'),
    t('plain', ' '),
    t('punct', '}'),
    t('punct', ','),
  ],
  [t('punct', ')'), t('plain', ' '), t('punct', '{')],
  [t('plain', '  '), t('keyword', 'return'), t('plain', ' '), t('punct', '{')],
  [t('plain', '    '), t('property', 'message'), t('punct', ':')],
  [
    t('plain', '      '),
    t('string', '`Hello, '),
    t('punct', '${'),
    t('property', 'input'),
    t('punct', '.'),
    t('property', 'name'),
    t('plain', ' '),
    t('keyword', '??'),
    t('plain', ' '),
    t('string', "'world'"),
    t('punct', '}'),
    t('string', '!`'),
    t('punct', ','),
  ],
  [t('plain', '  '), t('punct', '}')],
  [t('punct', '}')],
];

const WithoutList = () => (
  <div>
    <h3 className="text-sm font-medium">Without Functhis</h3>
    <ul className="mt-4 flex flex-col gap-1.5 font-mono text-[13px] leading-6">
      {WITHOUT_ROWS.map((row) => (
        <li
          className="flex items-baseline justify-between gap-6"
          key={row.path}
        >
          <span className="min-w-0 truncate text-zinc-400">{row.path}</span>
          <span className="shrink-0 text-zinc-500">{row.concern}</span>
        </li>
      ))}
    </ul>
  </div>
);

const WithPanel = () => (
  <div>
    <h3 className="text-sm font-medium">With Functhis</h3>
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-4 py-2 font-mono text-[11px] text-zinc-500">
        hello.ts
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-6">
        <code>
          {WITH_LINES.map((tokens, lineIndex) => (
            <span className="block whitespace-pre" key={lineIndex}>
              {tokens.map((token, tokenIndex) => (
                <span className={TOKEN_CLASS[token.kind]} key={tokenIndex}>
                  {token.text}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
      <div className="flex flex-col gap-1 border-t border-zinc-800 px-4 py-3 font-mono text-[12px] leading-6">
        <p className="text-zinc-300">functhis.now/@you/hello</p>
        <p className="text-zinc-500">MCP search + execute</p>
      </div>
    </div>
  </div>
);

export const LoopStage = () => (
  <section
    aria-labelledby={HEADING_ID}
    className="scroll-mt-24 pt-[102px]"
    id="loop"
  >
    <h2
      className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-[41px]"
      id={HEADING_ID}
    >
      Write it. Deploy it. Let anyone run it.
    </h2>
    <p className="mt-4 text-lg leading-relaxed text-zinc-400">
      A working tool is usually a pile of infrastructure. Functhis keeps the
      function and generates the rest.
    </p>
    <div className="mt-10 flex flex-col gap-12">
      <WithoutList />
      <WithPanel />
    </div>
  </section>
);
