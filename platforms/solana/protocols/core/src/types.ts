export type Wormhole = {
  address: string;
  metadata: {
    name: 'wormhole';
    version: '0.1.0';
    spec: '0.1.0';
  };
  instructions: [
    {
      name: 'initialize';
      discriminator: [0];
      accounts: [
        {
          name: 'bridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'guardianSet';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'feeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'guardianSetExpirationTime';
          type: 'u32';
        },
        {
          name: 'fee';
          type: 'u64';
        },
        {
          name: 'initialGuardians';
          type: {
            vec: {
              array: ['u8', 20];
            };
          };
        },
      ];
    },
    {
      name: 'postMessage';
      discriminator: [1];
      accounts: [
        {
          name: 'bridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'message';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'emitter';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'sequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'feeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'nonce';
          type: 'u32';
        },
        {
          name: 'payload';
          type: 'bytes';
        },
        {
          name: 'consistencyLevel';
          type: 'u8';
        },
      ];
    },
    {
      name: 'postVaa';
      discriminator: [2];
      accounts: [
        {
          name: 'guardianSet';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'bridge';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'signatureSet';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'version';
          type: 'u8';
        },
        {
          name: 'guardianSetIndex';
          type: 'u32';
        },
        {
          name: 'timestamp';
          type: 'u32';
        },
        {
          name: 'nonce';
          type: 'u32';
        },
        {
          name: 'emitterChain';
          type: 'u16';
        },
        {
          name: 'emitterAddress';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'sequence';
          type: 'u64';
        },
        {
          name: 'consistencyLevel';
          type: 'u8';
        },
        {
          name: 'payload';
          type: 'bytes';
        },
      ];
    },
    {
      name: 'setFees';
      discriminator: [3];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'bridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'claim';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'transferFees';
      discriminator: [4];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'bridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'claim';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'feeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'recipient';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'upgradeContract';
      discriminator: [5];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'bridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'claim';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'upgradeAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'spill';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'implementation';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'programData';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'bpfLoaderUpgradeable';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'upgradeGuardianSet';
      discriminator: [6];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'bridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'claim';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'guardianSetOld';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'guardianSetNew';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'verifySignatures';
      discriminator: [7];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'guardianSet';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'signatureSet';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'instructions';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'signatureStatus';
          type: {
            array: ['i8', 19];
          };
        },
      ];
    },
    {
      name: 'postMessageUnreliable';
      discriminator: [8];
      accounts: [
        {
          name: 'bridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'message';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'emitter';
          isMut: false;
          isSigner: true;
        },
        {
          name: 'sequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'feeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'nonce';
          type: 'u32';
        },
        {
          name: 'payload';
          type: 'bytes';
        },
        {
          name: 'consistencyLevel';
          type: 'u8';
        },
      ];
    },
  ];
  accounts: [
    {
      name: 'BridgeData';
      discriminator: [];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'guardianSetIndex';
            type: 'u32';
          },
          {
            name: 'lastLamports';
            type: 'u64';
          },
          {
            name: 'config';
            type: 'BridgeConfig';
          },
        ];
      };
    },
    {
      name: 'BridgeConfig';
      discriminator: [];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'guardianSetExpirationTime';
            type: 'u32';
          },
          {
            name: 'fee';
            type: 'u64';
          },
        ];
      };
    },
    {
      name: 'PostedMessage';
      discriminator: [];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vaaVersion';
            type: 'u8';
          },
          {
            name: 'consistencyLevel';
            type: 'u8';
          },
          {
            name: 'vaaTime';
            type: 'u32';
          },
          {
            name: 'vaaSignatureAccount';
            type: 'pubkey';
          },
          {
            name: 'submissionTime';
            type: 'u32';
          },
          {
            name: 'nonce';
            type: 'u32';
          },
          {
            name: 'sequence';
            type: 'u64';
          },
          {
            name: 'emitterChain';
            type: 'u16';
          },
          {
            name: 'emitterAddress';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'payload';
            type: 'bytes';
          },
        ];
      };
    },
    {
      name: 'PostedVAA';
      discriminator: [];
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vaaVersion';
            type: 'u8';
          },
          {
            name: 'consistencyLevel';
            type: 'u8';
          },
          {
            name: 'vaaTime';
            type: 'u32';
          },
          {
            name: 'vaaSignatureAccount';
            type: 'pubkey';
          },
          {
            name: 'submissionTime';
            type: 'u32';
          },
          {
            name: 'nonce';
            type: 'u32';
          },
          {
            name: 'sequence';
            type: 'u64';
          },
          {
            name: 'emitterChain';
            type: 'u16';
          },
          {
            name: 'emitterAddress';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'payload';
            type: 'bytes';
          },
        ];
      };
    },
  ];
};

export const IDL: Wormhole = {
  address: '',
  metadata: {
    name: 'wormhole',
    version: '0.1.0',
    spec: '0.1.0',
  },
  instructions: [
    {
      name: 'initialize',
      discriminator: [0],
      accounts: [
        {
          name: 'bridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'guardianSet',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'feeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'guardianSetExpirationTime',
          type: 'u32',
        },
        {
          name: 'fee',
          type: 'u64',
        },
        {
          name: 'initialGuardians',
          type: {
            vec: {
              array: ['u8', 20],
            },
          },
        },
      ],
    },
    {
      name: 'postMessage',
      discriminator: [1],
      accounts: [
        {
          name: 'bridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'message',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'emitter',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'sequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'feeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'nonce',
          type: 'u32',
        },
        {
          name: 'payload',
          type: 'bytes',
        },
        {
          name: 'consistencyLevel',
          type: 'u8',
        },
      ],
    },
    {
      name: 'postVaa',
      discriminator: [2],
      accounts: [
        {
          name: 'guardianSet',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'bridge',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'signatureSet',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vaa',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'version',
          type: 'u8',
        },
        {
          name: 'guardianSetIndex',
          type: 'u32',
        },
        {
          name: 'timestamp',
          type: 'u32',
        },
        {
          name: 'nonce',
          type: 'u32',
        },
        {
          name: 'emitterChain',
          type: 'u16',
        },
        {
          name: 'emitterAddress',
          type: {
            array: ['u8', 32],
          },
        },
        {
          name: 'sequence',
          type: 'u64',
        },
        {
          name: 'consistencyLevel',
          type: 'u8',
        },
        {
          name: 'payload',
          type: 'bytes',
        },
      ],
    },
    {
      name: 'setFees',
      discriminator: [3],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'bridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'claim',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'transferFees',
      discriminator: [4],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'bridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'claim',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'feeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'recipient',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'upgradeContract',
      discriminator: [5],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'bridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'claim',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'upgradeAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'spill',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'implementation',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'programData',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'bpfLoaderUpgradeable',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'upgradeGuardianSet',
      discriminator: [6],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'bridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'claim',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'guardianSetOld',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'guardianSetNew',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'verifySignatures',
      discriminator: [7],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'guardianSet',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'signatureSet',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'instructions',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'signatureStatus',
          type: {
            array: ['i8', 19],
          },
        },
      ],
    },
    {
      name: 'postMessageUnreliable',
      discriminator: [8],
      accounts: [
        {
          name: 'bridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'message',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'emitter',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'sequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'feeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'nonce',
          type: 'u32',
        },
        {
          name: 'payload',
          type: 'bytes',
        },
        {
          name: 'consistencyLevel',
          type: 'u8',
        },
      ],
    },
  ],
  accounts: [
    {
      name: 'BridgeData',
      discriminator: [],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'guardianSetIndex',
            type: 'u32',
          },
          {
            name: 'lastLamports',
            type: 'u64',
          },
          {
            name: 'config',
            type: 'BridgeConfig',
          },
        ],
      },
    },
    {
      name: 'BridgeConfig',
      discriminator: [],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'guardianSetExpirationTime',
            type: 'u32',
          },
          {
            name: 'fee',
            type: 'u64',
          },
        ],
      },
    },
    {
      name: 'PostedMessage',
      discriminator: [],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'vaaVersion',
            type: 'u8',
          },
          {
            name: 'consistencyLevel',
            type: 'u8',
          },
          {
            name: 'vaaTime',
            type: 'u32',
          },
          {
            name: 'vaaSignatureAccount',
            type: 'pubkey',
          },
          {
            name: 'submissionTime',
            type: 'u32',
          },
          {
            name: 'nonce',
            type: 'u32',
          },
          {
            name: 'sequence',
            type: 'u64',
          },
          {
            name: 'emitterChain',
            type: 'u16',
          },
          {
            name: 'emitterAddress',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'payload',
            type: 'bytes',
          },
        ],
      },
    },
    {
      name: 'PostedVAA',
      discriminator: [],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'vaaVersion',
            type: 'u8',
          },
          {
            name: 'consistencyLevel',
            type: 'u8',
          },
          {
            name: 'vaaTime',
            type: 'u32',
          },
          {
            name: 'vaaSignatureAccount',
            type: 'pubkey',
          },
          {
            name: 'submissionTime',
            type: 'u32',
          },
          {
            name: 'nonce',
            type: 'u32',
          },
          {
            name: 'sequence',
            type: 'u64',
          },
          {
            name: 'emitterChain',
            type: 'u16',
          },
          {
            name: 'emitterAddress',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'payload',
            type: 'bytes',
          },
        ],
      },
    },
  ],
};
