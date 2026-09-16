export default async function hello(input: { name?: string }) {
  return { message: `Hello, ${input.name ?? 'world'}!` };
}
