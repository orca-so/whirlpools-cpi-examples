import { beforeAll, describe, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import assert from "assert";
import { setupAta, setupMint } from "./utils/token";
import { AddressUtil } from "@orca-so/common-sdk";
import { createGraduateTokenToOrcaTransaction } from "../src/graduateTokenToOrca";
import {
  connection,
  signer,
  whirlpoolsConfigAddress,
} from "./utils/mockConnection";
import { BN } from "@coral-xyz/anchor";
import { WHIRLPOOL_CPI_PROGRAM_ID } from "./utils/program";
import { getAccount, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  buildDefaultAccountFetcher,
  LockConfigUtil,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  PoolUtil,
  PriceMath,
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";
import { setupAta2022, setupMint2022 } from "./utils/token2022";

describe("Launchpad CPI", () => {
  // Run multiple tests to account for randomness in token ordering.
  // When pairing a token and token-2022, the client code must reorder them
  // based on canonical ordering, which introduces variability in how tokens
  // are processed. Running multiple tests ensures we cover different ordering scenarios.
  it.each(Array.from({ length: 10 }, (_, i) => i + 1))("Should graduate token to orca (Test %s)", async (testNumber) => {
    const positionOwner = AddressUtil.findProgramAddress(
      [Buffer.from("position_owner")],
      WHIRLPOOL_CPI_PROGRAM_ID
    ).publicKey;
    const decimals0 = 9;
    const decimals1 = 6;
    const mint0 = await setupMint({ decimals: decimals0 });
    const mint1 = await setupMint2022({ decimals: decimals1 });
    const tokenAmount0 = new BN("138000000000");
    const tokenAmount1 = new BN("1000000000000000001");
    const ata0 = await setupAta(mint0, { owner: positionOwner, amount: tokenAmount0 });
    const ata1 = await setupAta2022(mint1, { owner: positionOwner, amount: tokenAmount1 });


    const { tx, whirlpoolAddress, positionMintAddress, tokenMintA, tokenMintB } =
      await createGraduateTokenToOrcaTransaction(
        connection,
        whirlpoolsConfigAddress,
        signer,
        tokenAmount0,
        tokenAmount1,
        mint0,
        mint1
      );

    const txRes = await connection.sendTransaction(tx);

    // THE FOLLOWING PART IS ONLY NEEDED TO ASSERT THE RESULTS
    // Determine token ordering - 
    const [mintA, mintB] = PoolUtil.orderMints(mint0, mint1);
    const isReordered = mintA !== mint0;
    let tokenAmountA: BN;
    let tokenAmountB: BN;
    let decimalsA: number;
    let decimalsB: number;
    let ataA: PublicKey;
    let ataB: PublicKey;
    let tokenProgramA: PublicKey;
    let tokenProgramB: PublicKey;
    if (isReordered) {
      tokenAmountA = tokenAmount1;
      tokenAmountB = tokenAmount0;
      decimalsA = decimals1;
      decimalsB = decimals0;
      ataA = ata1;
      ataB = ata0;
      tokenProgramA = TOKEN_2022_PROGRAM_ID;
      tokenProgramB = TOKEN_PROGRAM_ID;
    } else {
      tokenAmountA = tokenAmount0;
      tokenAmountB = tokenAmount1;
      decimalsA = decimals0;
      decimalsB = decimals1;
      ataA = ata0;
      ataB = ata1;
      tokenProgramA = TOKEN_PROGRAM_ID;
      tokenProgramB = TOKEN_2022_PROGRAM_ID;
    }

    const price = new Decimal((tokenAmountB * 10 ** decimalsA) / (tokenAmountA * 10 ** decimalsB));
    const sqrtPrice = PriceMath.priceToSqrtPriceX64(price, decimalsA, decimalsB);

    const fetcher = buildDefaultAccountFetcher(connection);
    const whirlpool = await fetcher.getPool(whirlpoolAddress);
    const tokenVaultA = whirlpool.tokenVaultA;
    const tokenVaultB = whirlpool.tokenVaultB;
    const positionAddress = PDAUtil.getPosition(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      positionMintAddress
    ).publicKey;

    const balanceAtaA = (await getAccount(connection, ataA, undefined, tokenProgramA)).amount;
    const balanceAtaB = (await getAccount(connection, ataB, undefined, tokenProgramB)).amount;
    const balanceTokenVaultA = (await getAccount(connection, tokenVaultA, undefined, tokenProgramA))
      .amount;
    const balanceTokenVaultB = (await getAccount(connection, tokenVaultB, undefined, tokenProgramB))
      .amount;

    const lockConfig = await fetcher.getLockConfig(
      PDAUtil.getLockConfig(ORCA_WHIRLPOOL_PROGRAM_ID, positionAddress)
        .publicKey
    );
    const lockType = lockConfig.lockType;

    // Allow for small differences due to rounding
    const maxDiffPercentage = 0.005;

    const tokenVaultADiff = balanceTokenVaultA > BigInt(tokenAmountA)
      ? balanceTokenVaultA - BigInt(tokenAmountA)
      : BigInt(tokenAmountA) - balanceTokenVaultA;
    const tokenVaultBDiff = balanceTokenVaultB > BigInt(tokenAmountB)
      ? balanceTokenVaultB - BigInt(tokenAmountB)
      : BigInt(tokenAmountB) - balanceTokenVaultB;

    const tokenVaultADiffPercentage = Number(tokenVaultADiff) / Number(tokenAmountA);
    const tokenVaultBDiffPercentage = Number(tokenVaultBDiff) / Number(tokenAmountB);

    assert.strictEqual(BigInt(whirlpool.sqrtPrice), BigInt(sqrtPrice));
    assert(tokenVaultADiffPercentage <= maxDiffPercentage);
    assert(tokenVaultBDiffPercentage <= maxDiffPercentage);
    assert.strictEqual(balanceAtaA, tokenVaultADiff);
    assert.strictEqual(balanceAtaB, tokenVaultBDiff);
    assert.deepStrictEqual(lockType, LockConfigUtil.getPermanentLockType());
  });
});
