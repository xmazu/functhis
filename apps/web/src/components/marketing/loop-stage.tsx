import {
  Bot,
  Check,
  Clock3,
  FileCode2,
  Files,
  Globe,
  ShieldCheck,
  Terminal,
  Webhook,
} from 'lucide-react';

import {
  SEND_REMINDER,
  TOKEN_CLASS,
} from '#/components/marketing/agent-run-data';
import type { Token } from '#/components/marketing/agent-run-data';

const HEADING_ID = 'loop-heading';
const WITH_URL = 'functhis.now/@acme/billing/send-reminder';

const RUN_METHODS = [
  {
    detail: 'Discover and run over MCP',
    icon: Bot,
    soon: false,
    title: 'From an agent',
  },
  {
    detail: 'Call your function’s URL',
    icon: Globe,
    soon: false,
    title: 'Over HTTP',
  },
  {
    detail: 'Run automatically with cron',
    icon: Clock3,
    soon: true,
    title: 'On a schedule',
  },
  {
    detail: 'React to events in your tools',
    icon: Webhook,
    soon: true,
    title: 'From a webhook',
  },
];

const INCLUDED = [
  'Managed runtime',
  'Input validation',
  'Access control',
  'Execution limits',
];

const BOILERPLATE = [
  {
    code: "app.post('/reminders', validate(schema), handler);",
    files: ['routes/reminders.ts', 'schemas/reminder.ts', 'mcp/server.ts'],
    placement: 'sm:rotate-[-2deg] sm:translate-y-2',
    responsibility: 'Routes, schemas & agent adapters',
    title: 'Expose it',
  },
  {
    code: "await authorize(token, { scope: 'billing:write' });",
    files: ['auth/verify-token.ts', 'middleware/rate-limit.ts', 'secrets.ts'],
    placement: 'sm:rotate-[2deg] sm:translate-y-5',
    responsibility: 'Authentication, permissions & limits',
    title: 'Secure it',
  },
  {
    code: 'terraform plan && terraform apply',
    files: ['Dockerfile', 'infra/main.tf', '.github/workflows/deploy.yml'],
    placement: 'sm:rotate-[1deg]',
    responsibility: 'Runtime, infrastructure & CI',
    title: 'Deploy it',
  },
  {
    code: 'alert: reminder_error_rate > threshold',
    files: [
      'observability/logger.ts',
      'routes/health.ts',
      'monitoring/alerts.yml',
    ],
    placement: 'sm:rotate-[-2deg] sm:translate-y-3',
    responsibility: 'Logs, health checks & alerts',
    title: 'Keep it running',
  },
];

const WindowDots = () => (
  <div className="flex items-center gap-1.5">
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
  </div>
);

const CodeLines = ({ lines }: { lines: Token[][] }) => (
  <pre className="overflow-x-auto font-mono text-[12px] leading-6">
    <code>
      {lines.map((tokens, lineIndex) => (
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
);

const WithoutPanel = () => (
  <div>
    <h3 className="text-2xl leading-tight font-semibold tracking-tight">
      Without Functhis
    </h3>
    <p className="mt-2 text-zinc-400">
      You wanted to send a reminder. Now you own a service.
    </p>
    <div className="relative mt-6 rounded-xl border border-zinc-800 px-4 pt-5 pb-6 sm:px-6 sm:pb-9">
      <div className="flex items-start gap-3 border-b border-zinc-800 pb-5">
        <FileCode2
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-zinc-400"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-zinc-200">send-reminder.ts</p>
          <p className="mt-1 text-xs text-zinc-400">
            The part you actually wanted to write.
          </p>
        </div>
        <span className="text-xs text-zinc-500">Your logic</span>
      </div>
      <div className="flex items-center gap-2 py-5 text-xs text-zinc-400">
        <Files aria-hidden="true" className="size-3.5 shrink-0" />
        <p>Then all the files around it.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-8 sm:px-1 sm:pb-5">
        {BOILERPLATE.map((group) => (
          <div
            className={`relative min-w-0 ${group.placement}`}
            key={group.title}
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-2 -top-2 bottom-2 rounded-lg border border-zinc-800 bg-zinc-950"
            />
            <div className="relative overflow-hidden rounded-lg border border-zinc-700/70 bg-zinc-900">
              <div className="border-b border-zinc-800 px-4 py-3">
                <h4 className="text-sm font-medium text-zinc-200">
                  {group.title}
                </h4>
                <p className="mt-1 text-xs text-zinc-400">
                  {group.responsibility}
                </p>
              </div>
              <ul className="space-y-2 px-4 py-3">
                {group.files.map((file) => (
                  <li
                    className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-zinc-300"
                    key={file}
                  >
                    <FileCode2
                      aria-hidden="true"
                      className="size-3 shrink-0 text-zinc-500"
                    />
                    <span className="break-all">{file}</span>
                  </li>
                ))}
              </ul>
              <p className="overflow-hidden border-t border-zinc-800 px-4 py-2.5 font-mono text-[10px] leading-5 text-zinc-500">
                <code className="block truncate whitespace-nowrap">
                  {group.code}
                </code>
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-400">
        And someone still has to manage credentials, patch dependencies, and
        debug failed deploys.
      </p>
    </div>
  </div>
);

const WithPanel = () => (
  <div>
    <h3 className="text-2xl leading-tight font-semibold tracking-tight">
      With Functhis
    </h3>
    <p className="mt-2 text-zinc-400">
      Keep the function. We handle the infrastructure around it.
    </p>
    <div className="mt-5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
        <WindowDots />
        <p className="min-w-0 truncate font-mono text-[11px] text-zinc-500">
          {SEND_REMINDER.file}
        </p>
      </div>
      <div className="p-4">
        <CodeLines lines={SEND_REMINDER.lines} />
      </div>
      <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-3 font-mono text-xs text-zinc-200">
        <Terminal aria-hidden="true" className="size-3.5 text-zinc-500" />
        <span>functhis deploy</span>
      </div>
      <div className="flex flex-col gap-1 border-t border-zinc-800 px-4 py-3 font-mono text-[12px] leading-6">
        <p className="break-all text-zinc-300">{WITH_URL}</p>
      </div>
      <div className="border-t border-zinc-800 bg-zinc-950/40 px-4 py-5 sm:px-5">
        <h4 className="text-sm font-medium text-zinc-200">
          One function. More ways to run it.
        </h4>
        <ul className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {RUN_METHODS.map(({ icon: Icon, title, detail, soon }) => (
            <li className="flex items-start gap-3" key={title}>
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-zinc-400"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-xs font-medium text-zinc-200">{title}</p>
                  {soon ? (
                    <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] leading-none text-zinc-400">
                      Coming soon
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
      <p className="flex shrink-0 items-center gap-2 text-xs leading-5 font-medium text-zinc-300">
        <ShieldCheck aria-hidden="true" className="size-3.5" />
        Batteries included
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {INCLUDED.map((item) => (
          <li
            className="flex items-center gap-1.5 text-xs leading-5 text-zinc-400"
            key={item}
          >
            <Check aria-hidden="true" className="size-3 text-zinc-500" />
            {item}
          </li>
        ))}
      </ul>
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
      A useful function shouldn’t need an entire service around it.
    </p>
    <div className="mt-10 space-y-10">
      <WithoutPanel />
      <WithPanel />
    </div>
  </section>
);
