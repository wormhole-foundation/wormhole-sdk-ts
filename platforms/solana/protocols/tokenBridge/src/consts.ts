import { Network, RoArray } from '@wormhole-foundation/connect-sdk';

// TODO: hack to get around the fact that Solana does _not_ have
// an easy way to recover all the tokens that are registered and allowed
// to be transferred
// This list was populated from the tokenRegistry
export const registeredTokens = {
  Testnet: [
    '7VPWjBhCXrpYYBiRKZh1ubh9tLZZNkZGp2ReRphEV4Mc',
    '3WK3mEDNPrNuQReBvM28NcsqrExMnPxD9pPJmgrUeKKH',
    'BaGfF51MQ3a61papTRDYaNefBgTQ9ywnVne5fCff4bxT',
    'ACbmcQxbbhiXWM1GmapUSMmBYKMvnFLfAAXKqdo8xKwo',
    'GQtMXZxnuacCFTXVeTvyHi6P9F6chbtzhVc8JgD8hv7c',
    '3Ftc5hTz9sG4huk79onufGiebJNDMZNL8HYgdMJ9E7JR',
    'DMw2tLaq1bVoAEKtkoUtieSk9bfCPUvubYLatTMsSVop',
    '84F2QX9278ToDmA98u4A86xSV9hz1ovazr8zwGaX6qjS',
    'So11111111111111111111111111111111111111112',
    '8987WGkYa5viiZ9DD8sS3PB5XghKmWjkEgmzvwDuoAEc',
    'BJZ72CjPQojVoH68mzrd4VQ4nr6KuhbAGnhZEZCujKxY',
  ],
  Mainnet: [
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM',
    'Dn4noZ5jgGfkntzcQSUZ8czkreiZ1ForXYoV2H8Dm7S1',
    '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    '9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa',
    'Gz7VkD4MacbEB6yC5XD3HcumEiYx2EtDYYrfikGsvopG',
    'KgV1GvrHQmRBY8sHQQeUKwTm2r2h8t4C8qt12Cw1HVE',
    'DRQBDBEWmwWGK13fRTLhSPzjbvMSUavhV6nW4RUH8W6T',
    '9kvAcwQbqejuJMd59mKuw2bfSsLRaQ7zuvaTVHEeBBec',
    '7ixSaXGsHAFy34wogPk2YXiUX3BMmQMFdercdaHLnBby',
    'G1vJEgzepqhnVu35BN4jrkv3wVwkujYWFFCxhbEZ1CZr',
    'So11111111111111111111111111111111111111112',
  ],
  Devnet: [],
} as const satisfies Record<Network, RoArray<string>>;
