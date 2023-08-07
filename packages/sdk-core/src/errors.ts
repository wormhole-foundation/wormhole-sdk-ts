export function NoProviderError(chain: string | number): Error {
  return new Error(
    `Missing provider for domain: ${chain}.\nHint: Have you called \`context.registerProvider(${chain}, provider)\` yet?`,
  );
}

export function NoContextError(chain: string | number): Error {
  // TODO: lookup chain name/id for better error messages
  return new Error(
    `You attempted to send a transfer to ${chain}, but the ${chain} context is not registered. ` +
      `You must import ${chain} from @wormhole-foundation/connect-sdk-sei and pass it in to the Wormhole class constructor`,
  );
}
