export type TokenKind =
  | 'comment'
  | 'ident'
  | 'keyword'
  | 'plain'
  | 'property'
  | 'punct'
  | 'string'
  | 'tag'
  | 'type';

export interface Token {
  kind: TokenKind;
  text: string;
}

export const TOKEN_CLASS: Record<TokenKind, string> = {
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

export const USER_PROMPT =
  "Find Acme's unpaid invoices and send Anna a payment reminder.";

export const AGENT_THINKING_SENTENCES = [
  'Parse the request: unpaid invoices for Acme, then a payment reminder to Anna.',
  'Search the published billing package for a function that lists overdue invoices.',
  'Email is an external action - show results and ask before calling send-reminder.',
  'Plan: search, run find-overdue-invoices, search again, then pause for approval.',
] as const;

export const AGENT_THINKING_DELAYS = [550, 650, 600, 650] as const;

export const VERSION = 'v3';

export const INVOICES = [
  { amount: '$740', due: '12 days overdue', id: 'INV-1841' },
  { amount: '$500', due: '5 days overdue', id: 'INV-1902' },
] as const;

export interface DemoFunction {
  executeCall: string;
  executeResult: string;
  file: string;
  id: string;
  lines: Token[][];
  logDuration: string;
  logId: string;
  searchQuery: string;
  slug: string;
}

const FIND_LINES: Token[][] = [
  [t('comment', '/**')],
  [t('comment', ' * Find unpaid invoices for a customer.')],
  [t('comment', ' *')],
  [
    t('comment', ' * '),
    t('tag', '@param'),
    t('comment', ' input.customer - Name in this project’s Stripe account.'),
  ],
  [t('comment', ' */')],
  [
    t('keyword', 'export'),
    t('plain', ' '),
    t('keyword', 'default'),
    t('plain', ' '),
    t('keyword', 'async'),
    t('plain', ' '),
    t('keyword', 'function'),
    t('plain', ' '),
    t('ident', 'findOverdueInvoices'),
    t('punct', '('),
    t('property', 'input'),
    t('punct', ':'),
    t('plain', ' '),
    t('punct', '{'),
    t('plain', ' '),
    t('property', 'customer'),
    t('punct', ':'),
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
    t('keyword', 'const'),
    t('plain', ' '),
    t('property', 'invoices'),
    t('plain', ' '),
    t('punct', '='),
    t('plain', ' '),
    t('keyword', 'await'),
    t('plain', ' '),
    t('ident', 'stripe'),
    t('punct', '.'),
    t('property', 'invoices'),
    t('punct', '.'),
    t('ident', 'list'),
    t('punct', '('),
    t('punct', '{'),
  ],
  [
    t('plain', '    '),
    t('property', 'customer'),
    t('punct', ':'),
    t('plain', ' '),
    t('property', 'input'),
    t('punct', '.'),
    t('property', 'customer'),
    t('punct', ','),
  ],
  [
    t('plain', '    '),
    t('property', 'status'),
    t('punct', ':'),
    t('plain', ' '),
    t('string', "'open'"),
    t('punct', ','),
  ],
  [t('plain', '  '), t('punct', '}'), t('punct', ')'), t('punct', ';')],
  [
    t('plain', '  '),
    t('keyword', 'return'),
    t('plain', ' '),
    t('punct', '{'),
    t('plain', ' '),
    t('property', 'invoices'),
    t('punct', ','),
    t('plain', ' '),
    t('property', 'totalDue'),
    t('punct', ':'),
    t('plain', ' '),
    t('ident', 'sum'),
    t('punct', '('),
    t('property', 'invoices'),
    t('punct', ')'),
    t('plain', ' '),
    t('punct', '}'),
    t('punct', ';'),
  ],
  [t('punct', '}')],
];

const SEND_LINES: Token[][] = [
  [t('comment', '/**')],
  [
    t(
      'comment',
      ' * Send a payment reminder from this project’s mail provider.'
    ),
  ],
  [t('comment', ' *')],
  [
    t('comment', ' * '),
    t('tag', '@param'),
    t('comment', ' input.contact - Person to email.'),
  ],
  [
    t('comment', ' * '),
    t('tag', '@param'),
    t('comment', ' input.invoiceIds - Open invoices to include.'),
  ],
  [t('comment', ' */')],
  [
    t('keyword', 'export'),
    t('plain', ' '),
    t('keyword', 'default'),
    t('plain', ' '),
    t('keyword', 'async'),
    t('plain', ' '),
    t('keyword', 'function'),
    t('plain', ' '),
    t('ident', 'sendReminder'),
    t('punct', '('),
    t('property', 'input'),
    t('punct', ':'),
    t('plain', ' '),
    t('punct', '{'),
  ],
  [
    t('plain', '  '),
    t('property', 'customer'),
    t('punct', ':'),
    t('plain', ' '),
    t('type', 'string'),
    t('punct', ';'),
  ],
  [
    t('plain', '  '),
    t('property', 'contact'),
    t('punct', ':'),
    t('plain', ' '),
    t('type', 'string'),
    t('punct', ';'),
  ],
  [
    t('plain', '  '),
    t('property', 'invoiceIds'),
    t('punct', ':'),
    t('plain', ' '),
    t('type', 'string'),
    t('punct', '[]'),
    t('punct', ';'),
  ],
  [
    t('plain', ' '),
    t('punct', '}'),
    t('punct', ')'),
    t('plain', ' '),
    t('punct', '{'),
  ],
  [
    t('plain', '  '),
    t('keyword', 'await'),
    t('plain', ' '),
    t('ident', 'mail'),
    t('punct', '.'),
    t('ident', 'send'),
    t('punct', '('),
    t('punct', '{'),
  ],
  [
    t('plain', '    '),
    t('property', 'to'),
    t('punct', ':'),
    t('plain', ' '),
    t('property', 'input'),
    t('punct', '.'),
    t('property', 'contact'),
    t('punct', ','),
  ],
  [
    t('plain', '    '),
    t('property', 'subject'),
    t('punct', ':'),
    t('plain', ' '),
    t('string', '`Payment reminder for '),
    t('punct', '${'),
    t('property', 'input'),
    t('punct', '.'),
    t('property', 'customer'),
    t('punct', '}'),
    t('string', '`'),
    t('punct', ','),
  ],
  [
    t('plain', '    '),
    t('property', 'invoiceIds'),
    t('punct', ':'),
    t('plain', ' '),
    t('property', 'input'),
    t('punct', '.'),
    t('property', 'invoiceIds'),
    t('punct', ','),
  ],
  [t('plain', '  '), t('punct', '}'), t('punct', ')'), t('punct', ';')],
  [
    t('plain', '  '),
    t('keyword', 'return'),
    t('plain', ' '),
    t('punct', '{'),
    t('plain', ' '),
    t('property', 'sent'),
    t('punct', ':'),
    t('plain', ' '),
    t('keyword', 'true'),
    t('plain', ' '),
    t('punct', '}'),
    t('punct', ';'),
  ],
  [t('punct', '}')],
];

export const FIND_OVERDUE: DemoFunction = {
  executeCall: 'find-overdue-invoices({ customer: "Acme" })',
  executeResult: '2 unpaid invoices · $1,240 total',
  file: 'functions/billing/find-overdue-invoices.ts',
  id: '@acme/billing/find-overdue-invoices',
  lines: FIND_LINES,
  logDuration: '412ms',
  logId: 'exec_7f3a2c',
  searchQuery: 'find overdue invoices for a customer',
  slug: 'find-overdue-invoices',
};

export const SEND_REMINDER: DemoFunction = {
  executeCall:
    'send-reminder({ customer: "Acme", contact: "Anna", invoiceIds: [...] })',
  executeResult: 'Reminder sent',
  file: 'functions/billing/send-reminder.ts',
  id: '@acme/billing/send-reminder',
  lines: SEND_LINES,
  logDuration: '186ms',
  logId: 'exec_9c10b4',
  searchQuery: 'send a payment reminder',
  slug: 'send-reminder',
};

export const DEMO_FUNCTIONS = [FIND_OVERDUE, SEND_REMINDER] as const;

export const STEPS = [
  { id: 'functions', label: 'Your functions' },
  { id: 'discovers', label: 'Agent discovers' },
  { id: 'work', label: 'Work gets done' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export const BEAT_MS = 720;
export const PAUSE_BEAT = 6;
export const OUTCOME_BEAT = 7;

export const beatForStep = (step: StepId): number => {
  if (step === 'discovers') {
    return 5;
  }
  if (step === 'work') {
    return PAUSE_BEAT;
  }
  return 0;
};

export const stepForBeat = (beat: number): StepId => {
  if (beat >= PAUSE_BEAT) {
    return 'work';
  }
  if (beat >= 1) {
    return 'discovers';
  }
  return 'functions';
};

export const LIVE_FOR_BEAT = [
  'You asked to find Acme’s unpaid invoices and send Anna a payment reminder.',
  'Agent called functhis.search for overdue invoices.',
  'Search returned @acme/billing/find-overdue-invoices.',
  'Agent executed find-overdue-invoices. Two unpaid invoices, $1,240 total.',
  'Agent called functhis.search for a payment reminder.',
  'Search returned @acme/billing/send-reminder.',
  'Agent is waiting for you to approve sending the reminder.',
  'Agent executed send-reminder. Reminder sent.',
] as const;
