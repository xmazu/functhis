import { formatGreeting } from '@acme/shared';

/**
 * Greet someone using shared monorepo formatting.
 */
export default function greet(input: { name?: string }) {
  return { message: formatGreeting(input.name ?? 'world') };
}
