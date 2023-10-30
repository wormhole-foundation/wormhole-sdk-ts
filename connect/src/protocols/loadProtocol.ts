export async function loadProtocolModule(
  platformName: string,
  moduleSuffix: string,
): Promise<Record<string, any>> {
  try {
    const moduleName = `@wormhole-foundation/connect-sdk-${platformName.toLowerCase()}-${moduleSuffix}`;
    // @ts-ignore -- complains about commonjs but compiles?
    return await import(moduleName);
  } catch (e) {
    console.error("Error loading " + moduleSuffix, e);
    throw e;
  }
}
