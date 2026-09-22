import { BrowserWindow } from '#/components/ui/mock-browser-window';

interface Note {
  body: string;
  offsetClass: string;
  title: string;
}

const LEFT_NOTES: Note[] = [
  {
    body: 'Published functions live in the catalog at @handle/package/function — not in a Git host Functhis runs for you.',
    offsetClass: 'min-[1360px]:mt-5',
    title: 'Catalog path',
  },
  {
    body: 'One TypeScript file is one callable. The file name is the slug. Named exports are ignored.',
    offsetClass: 'min-[1360px]:mt-10',
    title: 'One file, one function',
  },
  {
    body: 'The default export takes a single object named input. Put JSDoc on that export — that is the description agents search.',
    offsetClass: 'min-[1360px]:mt-16',
    title: 'Named input',
  },
];

const RIGHT_NOTES: Note[] = [
  {
    body: 'The JSDoc on the default export is the contract. Functhis does not invent a description for you.',
    offsetClass: 'min-[1360px]:mt-8',
    title: 'JSDoc is the contract',
  },
];

type TokenKind =
  | 'comment'
  | 'ident'
  | 'keyword'
  | 'plain'
  | 'property'
  | 'punct'
  | 'string'
  | 'tag'
  | 'type';

interface Token {
  kind: TokenKind;
  text: string;
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: 'text-[#8b949e]',
  ident: 'text-[#d2a8ff]',
  keyword: 'text-[#ff7b72]',
  plain: 'text-[#e6edf3]',
  property: 'text-[#ffa657]',
  punct: 'text-[#9198a1]',
  string: 'text-[#a5d6ff]',
  tag: 'text-[#79c0ff]',
  type: 'text-[#79c0ff]',
};

const t = (kind: TokenKind, text: string): Token => ({ kind, text });

const CODE_LINES: Token[][] = [
  [t('comment', '/**')],
  [t('comment', ' * Greet someone by name.')],
  [t('comment', ' *')],
  [
    t('comment', ' * '),
    t('tag', '@param'),
    t('comment', ' input.name - Person to greet. Defaults to "world".'),
  ],
  [
    t('comment', ' * '),
    t('tag', '@returns'),
    t('comment', ' Greeting payload with a `message` string.'),
  ],
  [t('comment', ' * '), t('tag', '@example')],
  [t('comment', " * hello({ name: 'Ada' })")],
  [t('comment', " * // => { message: 'Hello, Ada!' }")],
  [t('comment', ' */')],
  [
    t('keyword', 'export'),
    t('plain', ' '),
    t('keyword', 'default'),
    t('plain', ' '),
    t('keyword', 'function'),
    t('plain', ' '),
    t('ident', 'hello'),
    t('punct', '('),
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
    t('punct', ')'),
    t('plain', ' '),
    t('punct', '{'),
  ],
  [
    t('plain', '  '),
    t('keyword', 'return'),
    t('plain', ' '),
    t('punct', '{'),
    t('plain', ' '),
    t('property', 'message'),
    t('punct', ':'),
    t('plain', ' '),
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
    t('plain', ' '),
    t('punct', '}'),
    t('punct', ';'),
  ],
  [t('punct', '}')],
];

interface TreeRow {
  depth: number;
  kind: 'file' | 'folder';
  name: string;
  selected?: boolean;
}

const TREE: TreeRow[] = [
  { depth: 0, kind: 'folder', name: '@you' },
  { depth: 1, kind: 'folder', name: 'hello' },
  { depth: 2, kind: 'file', name: 'hello.ts', selected: true },
  { depth: 1, kind: 'folder', name: 'github' },
  { depth: 2, kind: 'file', name: 'merge-pr.ts' },
];

const FolderIcon = () => (
  <svg
    aria-hidden="true"
    className="size-3 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
  >
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const FileIcon = () => (
  <svg
    aria-hidden="true"
    className="size-3 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
  </svg>
);

const NoteBlock = ({ align, note }: { align: 'start' | 'end'; note: Note }) => (
  <div className={`flex flex-col gap-1 ${note.offsetClass}`}>
    <div
      className={`flex items-center gap-2 ${align === 'end' ? 'min-[1360px]:flex-row-reverse' : ''}`}
    >
      <p className="shrink-0 font-medium min-[1360px]:text-sm">{note.title}</p>
      <div className="hidden h-px flex-1 bg-zinc-800 min-[1360px]:block" />
    </div>
    <p className="text-zinc-400 min-[1360px]:text-xs">{note.body}</p>
  </div>
);

const CatalogWindow = () => (
  <div aria-hidden="true" className="hidden md:block" data-proof="catalog">
    <BrowserWindow
      className="h-auto min-h-[24rem] max-w-none overflow-hidden rounded-xl border-zinc-800 bg-zinc-900 shadow-none"
      headerStyle="full"
      size="xl"
      theme="dark"
      url="functhis.now/@you/hello"
    >
      <div className="grid h-full min-h-[24rem] grid-cols-[12.5rem_1fr] divide-x divide-zinc-800">
        <div className="flex flex-col gap-px overflow-hidden px-2 py-3 font-mono text-[11px] text-zinc-500">
          {TREE.map((row) => (
            <div
              className={`flex items-center gap-2 rounded-md px-2 py-1 ${row.selected ? 'bg-zinc-800 text-zinc-50' : ''} ${row.depth === 1 ? 'ps-4' : ''} ${row.depth === 2 ? 'ps-6' : ''}`}
              key={`${row.depth}-${row.name}`}
            >
              {row.kind === 'folder' ? <FolderIcon /> : <FileIcon />}
              <p className={`truncate ${row.selected ? 'font-medium' : ''}`}>
                {row.name}
              </p>
            </div>
          ))}
        </div>
        <pre className="min-h-0 overflow-hidden p-5 font-mono text-[13px] leading-7">
          <code>
            {CODE_LINES.map((tokens, lineIndex) => (
              <span className="block whitespace-pre" key={lineIndex}>
                {tokens.length === 0 ? '\n' : null}
                {tokens.map((token, tokenIndex) => (
                  <span className={TOKEN_CLASS[token.kind]} key={tokenIndex}>
                    {token.text}
                  </span>
                ))}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </BrowserWindow>
  </div>
);

export const CatalogStage = () => (
  <section className="scroll-mt-24 pt-[102px]">
    <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-[41px]">
      One file is one function
    </h2>
    <p className="mt-4 text-lg leading-relaxed text-zinc-400">
      Functhis catalogs every published function at functhis.now. Write a
      default export with a typed{' '}
      <code className="font-mono text-[0.95em] text-zinc-300">input</code> and
      JSDoc. The file name is the slug. That shape is the product, not a style
      guide.
    </p>
    <div className="relative mt-10 grid items-start gap-8 min-[1360px]:min-h-[24rem] min-[1360px]:grid-cols-1">
      <div className="grid gap-8 min-[1360px]:absolute min-[1360px]:top-0 min-[1360px]:right-full min-[1360px]:mr-10 min-[1360px]:flex min-[1360px]:w-[200px] min-[1360px]:flex-col min-[1360px]:gap-0 sm:grid-cols-2 md:grid-cols-3">
        {LEFT_NOTES.map((note) => (
          <NoteBlock align="start" key={note.title} note={note} />
        ))}
      </div>
      <CatalogWindow />
      <div className="grid gap-8 min-[1360px]:absolute min-[1360px]:top-0 min-[1360px]:left-full min-[1360px]:ml-10 min-[1360px]:flex min-[1360px]:w-[200px] min-[1360px]:grid-cols-1 min-[1360px]:flex-col min-[1360px]:gap-0 min-[1360px]:text-right sm:grid-cols-2 md:grid-cols-3">
        {RIGHT_NOTES.map((note) => (
          <NoteBlock align="end" key={note.title} note={note} />
        ))}
      </div>
    </div>
  </section>
);
