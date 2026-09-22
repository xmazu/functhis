import { CopyPromptButton } from '#/components/copy-prompt-button';
import { AgentMarquee } from '#/components/marketing/agent-marquee';
import { HeroHeading } from '#/components/marketing/hero-heading';
import { Reveal } from '#/components/marketing/reveal';

export const Hero = () => (
  <section
    aria-labelledby="hero-heading"
    className="flex w-full min-w-0 flex-col"
  >
    <Reveal>
      <HeroHeading />
    </Reveal>
    <Reveal delayMs={120}>
      <div className="mt-12">
        <div data-hero-cta>
          <CopyPromptButton
            copiedLabel="Paste in your agent"
            idleLabel="Copy prompt for agent"
            size="hero"
          />
        </div>
        <AgentMarquee />
      </div>
    </Reveal>
  </section>
);
