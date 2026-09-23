import { CopyPromptButton } from '#/components/copy-prompt-button';
import { AgentRun } from '#/components/marketing/agent-run';
import { CatalogStage } from '#/components/marketing/catalog-stage';
import { DeployStage } from '#/components/marketing/deploy-stage';
import { FaqList } from '#/components/marketing/faq';
import { Hero } from '#/components/marketing/hero';
import { LoopStage } from '#/components/marketing/loop-stage';
import { Reveal } from '#/components/marketing/reveal';
import { SectionRule } from '#/components/marketing/section-rule';

export const Homepage = () => (
  <main className="mx-auto flex w-full max-w-[780px] flex-1 flex-col px-6 pt-16 pb-[102px] md:pt-24">
    <Hero />
    <Reveal>
      <AgentRun />
    </Reveal>
    <Reveal>
      <SectionRule />
    </Reveal>
    <Reveal>
      <LoopStage />
    </Reveal>
    <Reveal>
      <SectionRule />
    </Reveal>
    <Reveal>
      <DeployStage />
    </Reveal>
    <Reveal>
      <SectionRule />
    </Reveal>
    <Reveal>
      <CatalogStage />
    </Reveal>
    <Reveal>
      <SectionRule />
    </Reveal>
    <Reveal>
      <FaqList />
    </Reveal>
    <Reveal>
      <SectionRule />
      <div
        className="flex scroll-mt-24 flex-col items-center pt-[92px] text-center"
        id="get-started"
      >
        <h2 className="text-4xl leading-tight font-semibold tracking-tight sm:text-[41px]">
          Get started
        </h2>
        <div className="mt-8">
          <CopyPromptButton
            copiedLabel="Paste in your agent"
            idleLabel="Copy prompt for agent"
            size="hero"
          />
        </div>
      </div>
    </Reveal>
  </main>
);
