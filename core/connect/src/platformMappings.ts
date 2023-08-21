import {
  PlatformName,
  ChainName,
  isChain,
  chainToPlatform,
} from '@wormhole-foundation/sdk-base';
import { ChainOrPlatformToPlatform } from '@wormhole-foundation/sdk-definitions';
import { Platform } from './types';

declare global {
  namespace Wormhole {
    export interface PlatformMapping {}
  }
}

export type SupportedPlatforms = keyof Wormhole.PlatformMapping;

export type PlatformType<T extends PlatformName | ChainName> =
  ChainOrPlatformToPlatform<T> extends SupportedPlatforms
    ? Wormhole.PlatformMapping[ChainOrPlatformToPlatform<T>]
    : never;

const platformFactory = new Map<PlatformName, Platform>();

export function registerPlatform<P extends SupportedPlatforms>(
  platform: P,
  platformImpl: Platform,
): void {
  if (platformFactory.has(platform))
    throw new Error(
      `Native address type for platform ${platform} has already registered`,
    );

  platformFactory.set(platform, platformImpl);
}
// registerPlatform<'Evm'>('Evm', undefined as Platform);

export function toPlatformName<T extends PlatformName | ChainName>(
  chainOrPlatform: T,
): PlatformName {
  const platform: PlatformName = isChain(chainOrPlatform)
    ? chainToPlatform(chainOrPlatform)
    : chainOrPlatform;
  return platform;
}

export function getPlatform<T extends PlatformName | ChainName>(
  chainOrPlatform: T,
): PlatformType<T> {
  const platform = toPlatformName(chainOrPlatform);
  const platformImpl = platformFactory.get(platform);
  if (!platformImpl)
    throw new Error(`No platform type registered for platform ${platform}`);
  return platformImpl as unknown as PlatformType<T>;
}
