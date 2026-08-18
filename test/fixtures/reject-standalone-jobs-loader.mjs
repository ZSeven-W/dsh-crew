export async function resolve(specifier, context, nextResolve) {
  if (specifier === './jobs.mjs' && context.parentURL?.endsWith('/src/server.mjs')) {
    throw new Error('standalone jobs module must not load during MCP startup');
  }
  return nextResolve(specifier, context);
}
