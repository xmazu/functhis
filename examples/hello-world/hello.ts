/**
 * Greet someone by name.
 */
export default function hello(input: { name?: string }) {
  return { message: `Hello, ${input.name ?? 'world'}!` };
}
