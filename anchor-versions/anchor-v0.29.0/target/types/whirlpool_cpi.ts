export type WhirlpoolCpi = {
  "version": "0.1.0",
  "name": "whirlpool_cpi",
  "instructions": [
    {
      "name": "testCpi",
      "accounts": [],
      "args": []
    },
    {
      "name": "graduateTokenToOrca",
      "accounts": [
        {
          "name": "whirlpoolProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whirlpoolsConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whirlpool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMintA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenMintB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenBadgeA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenBadgeB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "funder",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenVaultA",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenVaultB",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "feeTier",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tickArrayLower",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tickArrayUpper",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "positionOwner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "positionMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "positionTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenOwnerAccountA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenOwnerAccountB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgramA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgramB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lockConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "token2022Program",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "metadataUpdateAuth",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "memoProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "tickSpacing",
          "type": "u16"
        },
        {
          "name": "initialSqrtPrice",
          "type": "u128"
        },
        {
          "name": "startTickIndexLower",
          "type": "i32"
        },
        {
          "name": "startTickIndexUpper",
          "type": "i32"
        },
        {
          "name": "tickLowerIndex",
          "type": "i32"
        },
        {
          "name": "tickUpperIndex",
          "type": "i32"
        },
        {
          "name": "withTokenMetadataExtension",
          "type": "bool"
        },
        {
          "name": "liquidityAmount",
          "type": "u128"
        },
        {
          "name": "tokenMaxA",
          "type": "u64"
        },
        {
          "name": "tokenMaxB",
          "type": "u64"
        }
      ]
    }
  ]
};

export const IDL: WhirlpoolCpi = {
  "version": "0.1.0",
  "name": "whirlpool_cpi",
  "instructions": [
    {
      "name": "testCpi",
      "accounts": [],
      "args": []
    },
    {
      "name": "graduateTokenToOrca",
      "accounts": [
        {
          "name": "whirlpoolProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whirlpoolsConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "whirlpool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenMintA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenMintB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenBadgeA",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenBadgeB",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "funder",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenVaultA",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenVaultB",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "feeTier",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tickArrayLower",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tickArrayUpper",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "positionOwner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "positionMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "positionTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenOwnerAccountA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenOwnerAccountB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgramA",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgramB",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lockConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "token2022Program",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "metadataUpdateAuth",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "memoProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "tickSpacing",
          "type": "u16"
        },
        {
          "name": "initialSqrtPrice",
          "type": "u128"
        },
        {
          "name": "startTickIndexLower",
          "type": "i32"
        },
        {
          "name": "startTickIndexUpper",
          "type": "i32"
        },
        {
          "name": "tickLowerIndex",
          "type": "i32"
        },
        {
          "name": "tickUpperIndex",
          "type": "i32"
        },
        {
          "name": "withTokenMetadataExtension",
          "type": "bool"
        },
        {
          "name": "liquidityAmount",
          "type": "u128"
        },
        {
          "name": "tokenMaxA",
          "type": "u64"
        },
        {
          "name": "tokenMaxB",
          "type": "u64"
        }
      ]
    }
  ]
};
