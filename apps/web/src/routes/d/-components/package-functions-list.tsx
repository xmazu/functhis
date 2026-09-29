import type { ReactElement } from 'react';

import type { PackageDetailFunctionView } from '#/routes/d/-server/package-detail-view-model';

const ui = 'text-[length:var(--app-font-size-ui,12px)]';

const functionsSectionLabelClass = `${ui} mb-4 flex items-center gap-2 border-b border-border pb-4 font-mono text-foreground`;

export const PackageFunctionsList = ({
  functions,
}: {
  functions: PackageDetailFunctionView[];
}): ReactElement => (
  <section className="scroll-mt-10" id="functions">
    <div className={functionsSectionLabelClass}>functions</div>
    {functions.length === 0 ? (
      <p className={`${ui} text-muted-foreground`}>
        No functions published yet.
      </p>
    ) : (
      <ul className="divide-border divide-y">
        {functions.map((fn) => (
          <li id={`fn-${fn.slug}`} key={fn.slug}>
            <div className="py-3">
              <h3 className={`${ui} text-foreground font-mono`}>{fn.slug}</h3>
              {fn.description ? (
                <p
                  className={`${ui} text-muted-foreground mt-2 line-clamp-2 text-pretty`}
                >
                  {fn.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);
