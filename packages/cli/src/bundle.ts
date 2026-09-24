import type { DiscoveredFunction } from './discover';

export {
  hashSourceTree,
  sha256Hex,
  stableBundlePayload,
} from '@functhis/publish/bundle';

export const createBootstrapSource = (
  functions: DiscoveredFunction[]
): string => {
  const imports = functions
    .map((fn, index) => `import handler${index} from './${fn.path}';`)
    .join('\n');

  const routeEntries = functions
    .map((fn, index) => `  ${JSON.stringify(fn.slug)}: handler${index},`)
    .join('\n');

  return `${imports}
import { __runInRuntime } from './__functhis_runtime.mjs';

const routes = {
${routeEntries}
};

export default {
  async fetch(request) {
    const logs = [];
    const nativeConsole = globalThis.console;
    globalThis.console = {
      ...nativeConsole,
      log: (...args) => { logs.push(args.map(String).join(' ')); },
      info: (...args) => { logs.push('[info] ' + args.map(String).join(' ')); },
      warn: (...args) => { logs.push('[warn] ' + args.map(String).join(' ')); },
      error: (...args) => { logs.push('[error] ' + args.map(String).join(' ')); },
    };
    try {
      const body = await request.json();
      const slug = body.functionSlug;
      const input = body.input ?? {};
      const runtime = body.runtime ?? { context: {}, secrets: {} };
      const handler = routes[slug];
      if (!handler) {
        return Response.json({ error: 'Unknown function slug: ' + slug, logs }, { status: 404 });
      }
      const result = await __runInRuntime(
        {
          context: runtime.context ?? {},
          secrets: runtime.secrets ?? {},
        },
        () => handler(input)
      );
      return Response.json({ result, logs });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error), logs }, { status: 500 });
    } finally {
      globalThis.console = nativeConsole;
    }
  },
};
`;
};
