export type ExecutorTokenBridgeRelayer = {
  version: '0.4.0';
  name: 'tokenBridgeRelayer';
  instructions: [
    {
      name: 'completeNativeTransferWithRelay';
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
          name: 'mint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'recipientTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'recipient';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tmpTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenBridgeConfig';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeClaim';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenBridgeForeignEndpoint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeCustody';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenBridgeCustodySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'vaaHash';
          type: {
            array: ['u8', 32];
          };
        },
      ];
    },
    {
      name: 'completeWrappedTransferWithRelay';
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
          name: 'tokenBridgeWrappedMint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'recipientTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'recipient';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tmpTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenBridgeWrappedMeta';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeConfig';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'vaa';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeClaim';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenBridgeForeignEndpoint';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeMintAuthority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'systemProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'rent';
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: 'vaaHash';
          type: {
            array: ['u8', 32];
          };
        },
      ];
    },
    {
      name: 'initialize';
      accounts: [
        {
          name: 'payer';
          isMut: true;
          isSigner: true;
        },
        {
          name: 'senderConfig';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'redeemerConfig';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'authority';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'lutAddress';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'lut';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'lutProgram';
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
          name: 'recentSlot';
          type: 'u64';
        },
      ];
    },
    {
      name: 'resolveExecuteVaaV1';
      accounts: [];
      args: [
        {
          name: 'vaaBody';
          type: 'bytes';
        },
      ];
      returns: {
        defined: 'ResolverInstructionGroups';
      };
    },
    {
      name: 'transferNativeTokensWithRelay';
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
          name: 'mint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'fromTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tmpTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenBridgeConfig';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeCustody';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenBridgeAuthoritySigner';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeCustodySigner';
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
          name: 'tokenBridgeEmitter';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeSequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeFeeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payee';
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
        {
          name: 'tokenBridgeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'associatedTokenProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'executorProgram';
          isMut: false;
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
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'TransferNativeTokensWithRelayArgs';
          };
        },
      ];
    },
    {
      name: 'transferWrappedTokensWithRelay';
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
          name: 'tokenBridgeWrappedMint';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'fromTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tmpTokenAccount';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'tokenBridgeWrappedMeta';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeConfig';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeAuthoritySigner';
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
          name: 'tokenBridgeEmitter';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeSequence';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeFeeCollector';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'payee';
          isMut: true;
          isSigner: false;
        },
        {
          name: 'wormholeProgram';
          isMut: false;
          isSigner: false;
        },
        {
          name: 'tokenBridgeProgram';
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
          name: 'executorProgram';
          isMut: false;
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
      ];
      args: [
        {
          name: 'args';
          type: {
            defined: 'TransferWrappedTokensWithRelayArgs';
          };
        },
      ];
    },
  ];
  accounts: [
    {
      name: 'LUT';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'bump';
            type: 'u8';
          },
          {
            name: 'address';
            type: 'publicKey';
          },
        ];
      };
    },
    {
      name: 'RedeemerConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'SenderConfig';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'bump';
            type: 'u8';
          },
        ];
      };
    },
  ];
  types: [
    {
      name: 'InstructionGroup';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'instructions';
            type: {
              vec: {
                defined: 'SerializableInstruction';
              };
            };
          },
          {
            name: 'addressLookupTables';
            type: {
              vec: 'publicKey';
            };
          },
        ];
      };
    },
    {
      name: 'InstructionGroups';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'groups';
            type: {
              vec: {
                defined: 'InstructionGroup';
              };
            };
          },
        ];
      };
    },
    {
      name: 'MissingAccounts';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'accounts';
            type: {
              vec: 'publicKey';
            };
          },
          {
            name: 'addressLookupTables';
            type: {
              vec: 'publicKey';
            };
          },
        ];
      };
    },
    {
      name: 'ResolverInstructionGroups';
      type: {
        kind: 'enum';
        variants: [
          {
            name: 'Resolved';
            fields: [
              {
                name: 'groups';
                type: {
                  defined: 'InstructionGroups';
                };
              },
            ];
          },
          {
            name: 'Missing';
            fields: [
              {
                name: 'accounts';
                type: {
                  defined: 'MissingAccounts';
                };
              },
            ];
          },
          {
            name: 'Account';
          },
        ];
      };
    },
    {
      name: 'SerializableAccountMeta';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'pubkey';
            type: 'publicKey';
          },
          {
            name: 'isSigner';
            type: 'bool';
          },
          {
            name: 'isWritable';
            type: 'bool';
          },
        ];
      };
    },
    {
      name: 'SerializableInstruction';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'programId';
            type: 'publicKey';
          },
          {
            name: 'accounts';
            type: {
              vec: {
                defined: 'SerializableAccountMeta';
              };
            };
          },
          {
            name: 'data';
            type: 'bytes';
          },
        ];
      };
    },
    {
      name: 'TransferNativeTokensWithRelayArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'recipientChain';
            type: 'u16';
          },
          {
            name: 'recipientAddress';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'nonce';
            type: 'u32';
          },
          {
            name: 'wrapNative';
            type: 'bool';
          },
          {
            name: 'dstTransferRecipient';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'dstExecutionAddress';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'execAmount';
            type: 'u64';
          },
          {
            name: 'signedQuoteBytes';
            type: 'bytes';
          },
          {
            name: 'relayInstructions';
            type: 'bytes';
          },
        ];
      };
    },
    {
      name: 'TransferWrappedTokensWithRelayArgs';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'recipientChain';
            type: 'u16';
          },
          {
            name: 'recipientAddress';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'nonce';
            type: 'u32';
          },
          {
            name: 'dstTransferRecipient';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'dstExecutionAddress';
            type: {
              array: ['u8', 32];
            };
          },
          {
            name: 'execAmount';
            type: 'u64';
          },
          {
            name: 'signedQuoteBytes';
            type: 'bytes';
          },
          {
            name: 'relayInstructions';
            type: 'bytes';
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'InvalidWormholeBridge';
      msg: 'invalidWormholeBridge';
    },
    {
      code: 6001;
      name: 'InvalidWormholeFeeCollector';
      msg: 'invalidWormholeFeeCollector';
    },
    {
      code: 6002;
      name: 'OwnerOnly';
      msg: 'ownerOnly';
    },
    {
      code: 6003;
      name: 'OutboundTransfersPaused';
      msg: 'outboundTransfersPaused';
    },
    {
      code: 6004;
      name: 'OwnerOrAssistantOnly';
      msg: 'ownerOrAssistantOnly';
    },
    {
      code: 6005;
      name: 'NotPendingOwner';
      msg: 'notPendingOwner';
    },
    {
      code: 6006;
      name: 'AlreadyTheOwner';
      msg: 'alreadyTheOwner';
    },
    {
      code: 6007;
      name: 'AlreadyTheAssistant';
      msg: 'alreadyTheAssistant';
    },
    {
      code: 6008;
      name: 'AlreadyTheFeeRecipient';
      msg: 'alreadyTheFeeRecipient';
    },
    {
      code: 6009;
      name: 'BumpNotFound';
      msg: 'bumpNotFound';
    },
    {
      code: 6010;
      name: 'FailedToMakeImmutable';
      msg: 'failedToMakeImmutable';
    },
    {
      code: 6011;
      name: 'InvalidForeignContract';
      msg: 'invalidForeignContract';
    },
    {
      code: 6012;
      name: 'ZeroBridgeAmount';
      msg: 'zeroBridgeAmount';
    },
    {
      code: 6013;
      name: 'InvalidToNativeAmount';
      msg: 'invalidToNativeAmount';
    },
    {
      code: 6014;
      name: 'NativeMintRequired';
      msg: 'nativeMintRequired';
    },
    {
      code: 6015;
      name: 'SwapsNotAllowedForNativeMint';
      msg: 'swapsNotAllowedForNativeMint';
    },
    {
      code: 6016;
      name: 'InvalidTokenBridgeConfig';
      msg: 'invalidTokenBridgeConfig';
    },
    {
      code: 6017;
      name: 'InvalidTokenBridgeAuthoritySigner';
      msg: 'invalidTokenBridgeAuthoritySigner';
    },
    {
      code: 6018;
      name: 'InvalidTokenBridgeCustodySigner';
      msg: 'invalidTokenBridgeCustodySigner';
    },
    {
      code: 6019;
      name: 'InvalidTokenBridgeEmitter';
      msg: 'invalidTokenBridgeEmitter';
    },
    {
      code: 6020;
      name: 'InvalidTokenBridgeSequence';
      msg: 'invalidTokenBridgeSequence';
    },
    {
      code: 6021;
      name: 'InvalidRecipient';
      msg: 'invalidRecipient';
    },
    {
      code: 6022;
      name: 'InvalidTransferToChain';
      msg: 'invalidTransferToChain';
    },
    {
      code: 6023;
      name: 'InvalidTransferTokenChain';
      msg: 'invalidTransferTokenChain';
    },
    {
      code: 6024;
      name: 'InvalidPrecision';
      msg: 'invalidPrecision';
    },
    {
      code: 6025;
      name: 'InvalidTransferToAddress';
      msg: 'invalidTransferToAddress';
    },
    {
      code: 6026;
      name: 'AlreadyRedeemed';
      msg: 'alreadyRedeemed';
    },
    {
      code: 6027;
      name: 'InvalidTokenBridgeForeignEndpoint';
      msg: 'invalidTokenBridgeForeignEndpoint';
    },
    {
      code: 6028;
      name: 'InvalidTokenBridgeMintAuthority';
      msg: 'invalidTokenBridgeMintAuthority';
    },
    {
      code: 6029;
      name: 'InvalidPublicKey';
      msg: 'invalidPublicKey';
    },
    {
      code: 6030;
      name: 'ZeroSwapRate';
      msg: 'zeroSwapRate';
    },
    {
      code: 6031;
      name: 'TokenNotRegistered';
      msg: 'tokenNotRegistered';
    },
    {
      code: 6032;
      name: 'ChainNotRegistered';
      msg: 'chainNotRegistered';
    },
    {
      code: 6033;
      name: 'TokenAlreadyRegistered';
      msg: 'tokenAlreadyRegistered';
    },
    {
      code: 6034;
      name: 'FeeCalculationError';
      msg: 'tokenFeeCalculationError';
    },
    {
      code: 6035;
      name: 'InvalidSwapCalculation';
      msg: 'invalidSwapCalculation';
    },
    {
      code: 6036;
      name: 'InsufficientFunds';
      msg: 'insufficientFunds';
    },
    {
      code: 6037;
      name: 'FailedToParseVaaBody';
      msg: 'failedToParseVaaBody';
    },
  ];
};

export const ExecutorTokenBridgeRelayerIdl: ExecutorTokenBridgeRelayer = {
  version: '0.4.0',
  name: 'tokenBridgeRelayer',
  instructions: [
    {
      name: 'completeNativeTransferWithRelay',
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
          name: 'mint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'recipientTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'recipient',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tmpTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenBridgeConfig',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeClaim',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenBridgeForeignEndpoint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeCustody',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenBridgeCustodySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'vaaHash',
          type: {
            array: ['u8', 32],
          },
        },
      ],
    },
    {
      name: 'completeWrappedTransferWithRelay',
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
          name: 'tokenBridgeWrappedMint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'recipientTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'recipient',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tmpTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenBridgeWrappedMeta',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeConfig',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'vaa',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeClaim',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenBridgeForeignEndpoint',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeMintAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'vaaHash',
          type: {
            array: ['u8', 32],
          },
        },
      ],
    },
    {
      name: 'initialize',
      accounts: [
        {
          name: 'payer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'senderConfig',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'redeemerConfig',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'authority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'lutAddress',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'lut',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'lutProgram',
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
          name: 'recentSlot',
          type: 'u64',
        },
      ],
    },
    {
      name: 'resolveExecuteVaaV1',
      accounts: [],
      args: [
        {
          name: 'vaaBody',
          type: 'bytes',
        },
      ],
      returns: {
        defined: 'ResolverInstructionGroups',
      },
    },
    {
      name: 'transferNativeTokensWithRelay',
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
          name: 'mint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'fromTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tmpTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenBridgeConfig',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeCustody',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenBridgeAuthoritySigner',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeCustodySigner',
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
          name: 'tokenBridgeEmitter',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeSequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeFeeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payee',
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
        {
          name: 'tokenBridgeProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'associatedTokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'executorProgram',
          isMut: false,
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
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'TransferNativeTokensWithRelayArgs',
          },
        },
      ],
    },
    {
      name: 'transferWrappedTokensWithRelay',
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
          name: 'tokenBridgeWrappedMint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'fromTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tmpTokenAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'tokenBridgeWrappedMeta',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeConfig',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeAuthoritySigner',
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
          name: 'tokenBridgeEmitter',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeSequence',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeFeeCollector',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'payee',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'wormholeProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenBridgeProgram',
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
          name: 'executorProgram',
          isMut: false,
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
      ],
      args: [
        {
          name: 'args',
          type: {
            defined: 'TransferWrappedTokensWithRelayArgs',
          },
        },
      ],
    },
  ],
  accounts: [
    {
      name: 'LUT',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'bump',
            type: 'u8',
          },
          {
            name: 'address',
            type: 'publicKey',
          },
        ],
      },
    },
    {
      name: 'RedeemerConfig',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'bump',
            type: 'u8',
          },
        ],
      },
    },
    {
      name: 'SenderConfig',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'bump',
            type: 'u8',
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'InstructionGroup',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'instructions',
            type: {
              vec: {
                defined: 'SerializableInstruction',
              },
            },
          },
          {
            name: 'addressLookupTables',
            type: {
              vec: 'publicKey',
            },
          },
        ],
      },
    },
    {
      name: 'InstructionGroups',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'groups',
            type: {
              vec: {
                defined: 'InstructionGroup',
              },
            },
          },
        ],
      },
    },
    {
      name: 'MissingAccounts',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'accounts',
            type: {
              vec: 'publicKey',
            },
          },
          {
            name: 'addressLookupTables',
            type: {
              vec: 'publicKey',
            },
          },
        ],
      },
    },
    {
      name: 'ResolverInstructionGroups',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'Resolved',
            fields: [
              {
                name: 'groups',
                type: {
                  defined: 'InstructionGroups',
                },
              },
            ],
          },
          {
            name: 'Missing',
            fields: [
              {
                name: 'accounts',
                type: {
                  defined: 'MissingAccounts',
                },
              },
            ],
          },
          {
            name: 'Account',
          },
        ],
      },
    },
    {
      name: 'SerializableAccountMeta',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'pubkey',
            type: 'publicKey',
          },
          {
            name: 'isSigner',
            type: 'bool',
          },
          {
            name: 'isWritable',
            type: 'bool',
          },
        ],
      },
    },
    {
      name: 'SerializableInstruction',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'programId',
            type: 'publicKey',
          },
          {
            name: 'accounts',
            type: {
              vec: {
                defined: 'SerializableAccountMeta',
              },
            },
          },
          {
            name: 'data',
            type: 'bytes',
          },
        ],
      },
    },
    {
      name: 'TransferNativeTokensWithRelayArgs',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'amount',
            type: 'u64',
          },
          {
            name: 'recipientChain',
            type: 'u16',
          },
          {
            name: 'recipientAddress',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'nonce',
            type: 'u32',
          },
          {
            name: 'wrapNative',
            type: 'bool',
          },
          {
            name: 'dstTransferRecipient',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'dstExecutionAddress',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'execAmount',
            type: 'u64',
          },
          {
            name: 'signedQuoteBytes',
            type: 'bytes',
          },
          {
            name: 'relayInstructions',
            type: 'bytes',
          },
        ],
      },
    },
    {
      name: 'TransferWrappedTokensWithRelayArgs',
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'amount',
            type: 'u64',
          },
          {
            name: 'recipientChain',
            type: 'u16',
          },
          {
            name: 'recipientAddress',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'nonce',
            type: 'u32',
          },
          {
            name: 'dstTransferRecipient',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'dstExecutionAddress',
            type: {
              array: ['u8', 32],
            },
          },
          {
            name: 'execAmount',
            type: 'u64',
          },
          {
            name: 'signedQuoteBytes',
            type: 'bytes',
          },
          {
            name: 'relayInstructions',
            type: 'bytes',
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'InvalidWormholeBridge',
      msg: 'invalidWormholeBridge',
    },
    {
      code: 6001,
      name: 'InvalidWormholeFeeCollector',
      msg: 'invalidWormholeFeeCollector',
    },
    {
      code: 6002,
      name: 'OwnerOnly',
      msg: 'ownerOnly',
    },
    {
      code: 6003,
      name: 'OutboundTransfersPaused',
      msg: 'outboundTransfersPaused',
    },
    {
      code: 6004,
      name: 'OwnerOrAssistantOnly',
      msg: 'ownerOrAssistantOnly',
    },
    {
      code: 6005,
      name: 'NotPendingOwner',
      msg: 'notPendingOwner',
    },
    {
      code: 6006,
      name: 'AlreadyTheOwner',
      msg: 'alreadyTheOwner',
    },
    {
      code: 6007,
      name: 'AlreadyTheAssistant',
      msg: 'alreadyTheAssistant',
    },
    {
      code: 6008,
      name: 'AlreadyTheFeeRecipient',
      msg: 'alreadyTheFeeRecipient',
    },
    {
      code: 6009,
      name: 'BumpNotFound',
      msg: 'bumpNotFound',
    },
    {
      code: 6010,
      name: 'FailedToMakeImmutable',
      msg: 'failedToMakeImmutable',
    },
    {
      code: 6011,
      name: 'InvalidForeignContract',
      msg: 'invalidForeignContract',
    },
    {
      code: 6012,
      name: 'ZeroBridgeAmount',
      msg: 'zeroBridgeAmount',
    },
    {
      code: 6013,
      name: 'InvalidToNativeAmount',
      msg: 'invalidToNativeAmount',
    },
    {
      code: 6014,
      name: 'NativeMintRequired',
      msg: 'nativeMintRequired',
    },
    {
      code: 6015,
      name: 'SwapsNotAllowedForNativeMint',
      msg: 'swapsNotAllowedForNativeMint',
    },
    {
      code: 6016,
      name: 'InvalidTokenBridgeConfig',
      msg: 'invalidTokenBridgeConfig',
    },
    {
      code: 6017,
      name: 'InvalidTokenBridgeAuthoritySigner',
      msg: 'invalidTokenBridgeAuthoritySigner',
    },
    {
      code: 6018,
      name: 'InvalidTokenBridgeCustodySigner',
      msg: 'invalidTokenBridgeCustodySigner',
    },
    {
      code: 6019,
      name: 'InvalidTokenBridgeEmitter',
      msg: 'invalidTokenBridgeEmitter',
    },
    {
      code: 6020,
      name: 'InvalidTokenBridgeSequence',
      msg: 'invalidTokenBridgeSequence',
    },
    {
      code: 6021,
      name: 'InvalidRecipient',
      msg: 'invalidRecipient',
    },
    {
      code: 6022,
      name: 'InvalidTransferToChain',
      msg: 'invalidTransferToChain',
    },
    {
      code: 6023,
      name: 'InvalidTransferTokenChain',
      msg: 'invalidTransferTokenChain',
    },
    {
      code: 6024,
      name: 'InvalidPrecision',
      msg: 'invalidPrecision',
    },
    {
      code: 6025,
      name: 'InvalidTransferToAddress',
      msg: 'invalidTransferToAddress',
    },
    {
      code: 6026,
      name: 'AlreadyRedeemed',
      msg: 'alreadyRedeemed',
    },
    {
      code: 6027,
      name: 'InvalidTokenBridgeForeignEndpoint',
      msg: 'invalidTokenBridgeForeignEndpoint',
    },
    {
      code: 6028,
      name: 'InvalidTokenBridgeMintAuthority',
      msg: 'invalidTokenBridgeMintAuthority',
    },
    {
      code: 6029,
      name: 'InvalidPublicKey',
      msg: 'invalidPublicKey',
    },
    {
      code: 6030,
      name: 'ZeroSwapRate',
      msg: 'zeroSwapRate',
    },
    {
      code: 6031,
      name: 'TokenNotRegistered',
      msg: 'tokenNotRegistered',
    },
    {
      code: 6032,
      name: 'ChainNotRegistered',
      msg: 'chainNotRegistered',
    },
    {
      code: 6033,
      name: 'TokenAlreadyRegistered',
      msg: 'tokenAlreadyRegistered',
    },
    {
      code: 6034,
      name: 'FeeCalculationError',
      msg: 'tokenFeeCalculationError',
    },
    {
      code: 6035,
      name: 'InvalidSwapCalculation',
      msg: 'invalidSwapCalculation',
    },
    {
      code: 6036,
      name: 'InsufficientFunds',
      msg: 'insufficientFunds',
    },
    {
      code: 6037,
      name: 'FailedToParseVaaBody',
      msg: 'failedToParseVaaBody',
    },
  ],
};
