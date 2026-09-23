import { DeployConsole } from '#/components/marketing/deploy-console';

export const DeployStage = () => (
  <section className="scroll-mt-24 pt-[102px]" id="deploy">
    <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-[41px]">
      One command publishes it
    </h2>
    <p className="mt-4 text-lg leading-relaxed text-zinc-400">
      Run{' '}
      <code className="font-mono text-[0.95em] text-zinc-300">
        npx functhis publish
      </code>{' '}
      from the project. Functhis versions the functions and prints live URLs.
      People open a page. Agents call search and execute.
    </p>
    <div className="mt-10">
      <DeployConsole />
    </div>
  </section>
);
