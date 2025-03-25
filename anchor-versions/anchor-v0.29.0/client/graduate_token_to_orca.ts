import {
  Address,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  KeyPairSigner,
  Rpc,
  SolanaRpcApi,
} from "@solana/kit";
import {
  getFeeTierAddress,
  getPositionAddress,
  getTickArrayAddress,
  getTokenBadgeAddress,
  getWhirlpoolAddress,
  WHIRLPOOL_PROGRAM_ADDRESS,
} from "@orca-so/whirlpools-client";
import {
  priceToSqrtPrice,
  getTickArrayStartTickIndex,
  increaseLiquidityQuoteA,
  getFullRangeTickIndexes,
} from "@orca-so/whirlpools-core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  fetchMint,
  findAssociatedTokenPda,
} from "@solana-program/token-2022";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { MEMO_PROGRAM_ADDRESS } from "@solana-program/memo";
import { SYSVAR_RENT_ADDRESS } from "@solana/sysvars";
import { orderMints } from "./utils/token";
import {
  METADATA_UPDATE_AUTH,
  SPLASH_POOL_TICK_SPACING,
} from "./utils/constants";
import {
  getGraduateTokenToOrcaInstruction,
  GraduateTokenToOrcaInstruction,
  WHIRLPOOL_CPI_PROGRAM_ADDRESS,
} from "../codama/generated";

export async function createGraduateTokenToOrcaInstruction(
  rpc: Rpc<SolanaRpcApi>,
  whirlpools_config_address: Address,
  funder: KeyPairSigner,
  tokenMaxA: bigint,
  tokenMaxB: bigint,
  tokenMintAddressA: Address,
  tokenMintAddressB: Address
): Promise<{
  ix: GraduateTokenToOrcaInstruction;
  whirlpoolAddress: Address;
  positionMintAddress: Address;
}> {
  const [orderedTokenMintAddressA, orderedTokenMintAddressB] = orderMints(
    tokenMintAddressA,
    tokenMintAddressB
  );

  const tokenMintA = await fetchMint(rpc, orderedTokenMintAddressA);
  const tokenMintB = await fetchMint(rpc, orderedTokenMintAddressB);
  const decimalsA = tokenMintA.data.decimals;
  const decimalsB = tokenMintB.data.decimals;

  const initialPrice = Number(
    (tokenMaxB * BigInt(10 ** decimalsA)) /
      (tokenMaxA * BigInt(10 ** decimalsB))
  );
  const initialSqrtPrice = priceToSqrtPrice(initialPrice, decimalsA, decimalsB);

  const tickSpacing = SPLASH_POOL_TICK_SPACING;
  const { tickLowerIndex, tickUpperIndex } =
    getFullRangeTickIndexes(tickSpacing);
  const startTickIndexLower = getTickArrayStartTickIndex(
    tickLowerIndex,
    tickSpacing
  );
  const startTickIndexUpper = getTickArrayStartTickIndex(
    tickUpperIndex,
    tickSpacing
  );
  const withTokenMetadataExtension = true;
  const liquidityAmountQuote = increaseLiquidityQuoteA(
    BigInt(tokenMaxA.toString()),
    0,
    initialSqrtPrice,
    tickLowerIndex,
    tickUpperIndex
  );

  const [
    whirlpoolAddress,
    feeTier,
    tokenBadgeA,
    tokenBadgeB,
    tokenVaultA,
    tokenVaultB,
  ] = await Promise.all([
    getWhirlpoolAddress(
      whirlpools_config_address,
      tokenMintA.address,
      tokenMintB.address,
      tickSpacing
    ).then((x) => x[0]),
    getFeeTierAddress(whirlpools_config_address, tickSpacing).then((x) => x[0]),
    getTokenBadgeAddress(whirlpools_config_address, tokenMintA.address).then(
      (x) => x[0]
    ),
    getTokenBadgeAddress(whirlpools_config_address, tokenMintB.address).then(
      (x) => x[0]
    ),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);

  const tickArrayAddressLower = (
    await getTickArrayAddress(whirlpoolAddress, startTickIndexLower)
  )[0];
  const tickArrayAddressUpper = (
    await getTickArrayAddress(whirlpoolAddress, startTickIndexUpper)
  )[0];

  const positionMint = await generateKeyPairSigner();
  const positionAddress = (await getPositionAddress(positionMint.address))[0];
  const positionOwner = (
    await getProgramDerivedAddress({
      programAddress: WHIRLPOOL_CPI_PROGRAM_ADDRESS,
      seeds: ["position_owner"],
    })
  )[0];
  const positionTokenAccount = (
    await findAssociatedTokenPda({
      owner: positionOwner,
      mint: positionMint.address,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    })
  )[0];

  const tokenProgramA = tokenMintA.programAddress;
  const tokenProgramB = tokenMintB.programAddress;
  const tokenOwnerAccountA = (
    await findAssociatedTokenPda({
      owner: positionOwner,
      mint: orderedTokenMintAddressA,
      tokenProgram: tokenProgramA,
    })
  )[0];

  const tokenOwnerAccountB = (
    await findAssociatedTokenPda({
      owner: positionOwner,
      mint: orderedTokenMintAddressB,
      tokenProgram: tokenProgramB,
    })
  )[0];

  const metadataUpdateAuth = METADATA_UPDATE_AUTH;

  const lockConfig = (
    await getProgramDerivedAddress({
      programAddress: WHIRLPOOL_PROGRAM_ADDRESS,
      seeds: ["lock_config", getAddressEncoder().encode(positionAddress)],
    })
  )[0];

  const ix = getGraduateTokenToOrcaInstruction({
    whirlpoolProgram: WHIRLPOOL_PROGRAM_ADDRESS,
    whirlpoolsConfig: whirlpools_config_address,
    whirlpool: whirlpoolAddress,
    tokenMintA: orderedTokenMintAddressA,
    tokenMintB: orderedTokenMintAddressB,
    tokenBadgeA,
    tokenBadgeB,
    funder: funder,
    tokenVaultA: tokenVaultA,
    tokenVaultB: tokenVaultB,
    feeTier,
    tickArrayLower: tickArrayAddressLower,
    tickArrayUpper: tickArrayAddressUpper,
    positionOwner,
    position: positionAddress,
    positionMint,
    positionTokenAccount,
    tokenOwnerAccountA,
    tokenOwnerAccountB,
    tokenProgramA,
    tokenProgramB,
    lockConfig,
    token2022Program: TOKEN_2022_PROGRAM_ADDRESS,
    metadataUpdateAuth,
    systemProgram: SYSTEM_PROGRAM_ADDRESS,
    rent: SYSVAR_RENT_ADDRESS,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    memoProgram: MEMO_PROGRAM_ADDRESS,
    tickSpacing,
    initialSqrtPrice,
    startTickIndexLower,
    startTickIndexUpper,
    tickLowerIndex,
    tickUpperIndex,
    withTokenMetadataExtension,
    liquidityAmount: liquidityAmountQuote.liquidityDelta,
    tokenMaxA,
    tokenMaxB,
  });

  return { ix, whirlpoolAddress, positionMintAddress: positionMint.address };
}
