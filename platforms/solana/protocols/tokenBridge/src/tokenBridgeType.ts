export type TokenBridge = {
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
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
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
      args: [
        {
          name: 'wormhole';
          type: 'pubkey';
        },
      ];
    },
    {
      name: 'attestToken';
      discriminator: [1];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wrappedMeta';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'splMetadata';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeBridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeMessage';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'wormholeEmitter';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeSequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeFeeCollector';
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
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'nonce';
          type: 'u32';
        },
      ];
    },
    {
      name: 'completeNative';
      discriminator: [2];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
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
          name: 'endpoint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'to';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'toFees';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'custody';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'custodySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'completeWrapped';
      discriminator: [3];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
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
          name: 'endpoint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'to';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'toFees';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wrappedMeta';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'mintAuthority';
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
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'transferWrapped';
      discriminator: [4];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'from';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'fromOwner';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'mint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wrappedMeta';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authoritySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeBridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeMessage';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'wormholeEmitter';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeSequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeFeeCollector';
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
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
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
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'fee';
          type: 'u64';
        },
        {
          name: 'targetAddress';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'targetChain';
          type: 'u16';
        },
      ];
    },
    {
      name: 'transferNative';
      discriminator: [5];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'from';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'custody';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authoritySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'custodySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeBridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeMessage';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'wormholeEmitter';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeSequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeFeeCollector';
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
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
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
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'fee';
          type: 'u64';
        },
        {
          name: 'targetAddress';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'targetChain';
          type: 'u16';
        },
      ];
    },
    {
      name: 'registerChain';
      discriminator: [6];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'endpoint';
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
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'createWrapped';
      discriminator: [7];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'endpoint';
          isMut: false;
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
          name: 'mint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wrappedMeta';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'splMetadata';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mintAuthority';
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
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'splMetadataProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: 'upgradeContract';
      discriminator: [8];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
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
          name: 'tokenBridgeProgram';
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
      name: 'transferWrappedWithPayload';
      discriminator: [9];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'from';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'fromOwner';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'mint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wrappedMeta';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'authoritySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeBridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeMessage';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'wormholeEmitter';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeSequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeFeeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'sender';
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
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
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
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'targetAddress';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'targetChain';
          type: 'u16';
        },
        {
          name: 'payload';
          type: 'bytes';
        },
        {
          name: 'cpiProgramId';
          type: {
            option: 'pubkey';
          };
        },
      ];
    },
    {
      name: 'transferNativeWithPayload';
      discriminator: [10];
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'config';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'from';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'mint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'custody';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authoritySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'custodySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeBridge';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeMessage';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'wormholeEmitter';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeSequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeFeeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'clock';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'sender';
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
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
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
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'targetAddress';
          type: {
            array: ['u8', 32];
          };
        },
        {
          name: 'targetChain';
          type: 'u16';
        },
        {
          name: 'payload';
          type: 'bytes';
        },
        {
          name: 'cpiProgramId';
          type: {
            option: 'pubkey';
          };
        },
      ];
    },
  ];
  accounts: [];
};

export const TOKEN_BRIDGE_IDL: TokenBridge = {
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
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
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
      args: [
        {
          name: 'wormhole',
          type: 'pubkey',
        },
      ],
    },
    {
      name: 'attestToken',
      discriminator: [1],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wrappedMeta',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'splMetadata',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeBridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeMessage',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'wormholeEmitter',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeSequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeFeeCollector',
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
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'nonce',
          type: 'u32',
        },
      ],
    },
    {
      name: 'completeNative',
      discriminator: [2],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: false,
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
          name: 'endpoint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'to',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'toFees',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'custody',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'custodySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'completeWrapped',
      discriminator: [3],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: false,
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
          name: 'endpoint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'to',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'toFees',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wrappedMeta',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'mintAuthority',
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
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'transferWrapped',
      discriminator: [4],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'from',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'fromOwner',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'mint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wrappedMeta',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authoritySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeBridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeMessage',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'wormholeEmitter',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeSequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeFeeCollector',
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
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
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
          name: 'amount',
          type: 'u64',
        },
        {
          name: 'fee',
          type: 'u64',
        },
        {
          name: 'targetAddress',
          type: {
            array: ['u8', 32],
          },
        },
        {
          name: 'targetChain',
          type: 'u16',
        },
      ],
    },
    {
      name: 'transferNative',
      discriminator: [5],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'from',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'custody',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authoritySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'custodySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeBridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeMessage',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'wormholeEmitter',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeSequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeFeeCollector',
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
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
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
          name: 'amount',
          type: 'u64',
        },
        {
          name: 'fee',
          type: 'u64',
        },
        {
          name: 'targetAddress',
          type: {
            array: ['u8', 32],
          },
        },
        {
          name: 'targetChain',
          type: 'u16',
        },
      ],
    },
    {
      name: 'registerChain',
      discriminator: [6],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'endpoint',
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
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'createWrapped',
      discriminator: [7],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'endpoint',
          isMut: false,
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
          name: 'mint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wrappedMeta',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'splMetadata',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mintAuthority',
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
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'splMetadataProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'upgradeContract',
      discriminator: [8],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
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
          name: 'tokenBridgeProgram',
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
      name: 'transferWrappedWithPayload',
      discriminator: [9],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'from',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'fromOwner',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'mint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wrappedMeta',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'authoritySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeBridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeMessage',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'wormholeEmitter',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeSequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeFeeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'sender',
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
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
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
          name: 'amount',
          type: 'u64',
        },
        {
          name: 'targetAddress',
          type: {
            array: ['u8', 32],
          },
        },
        {
          name: 'targetChain',
          type: 'u16',
        },
        {
          name: 'payload',
          type: 'bytes',
        },
        {
          name: 'cpiProgramId',
          type: {
            option: 'pubkey',
          },
        },
      ],
    },
    {
      name: 'transferNativeWithPayload',
      discriminator: [10],
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'config',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'from',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'custody',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authoritySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'custodySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeBridge',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeMessage',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'wormholeEmitter',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeSequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeFeeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'sender',
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
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
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
          name: 'amount',
          type: 'u64',
        },
        {
          name: 'targetAddress',
          type: {
            array: ['u8', 32],
          },
        },
        {
          name: 'targetChain',
          type: 'u16',
        },
        {
          name: 'payload',
          type: 'bytes',
        },
        {
          name: 'cpiProgramId',
          type: {
            option: 'pubkey',
          },
        },
      ],
    },
  ],
  accounts: [],
};
