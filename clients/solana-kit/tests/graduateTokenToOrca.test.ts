import { describe, it } from "vitest";
import { createGraduateTokenToOrcaInstruction } from "../src/graduateTokenToOrca";
import { rpc, sendTransaction, signer } from "./utils/mockRpc";
import { WHIRLPOOL_CPI_PROGRAM_ADDRESS } from "../codama/generated";
import {
  Address,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { setupAta, setupMint } from "./utils/token";
import { WHIRLPOOLS_CONFIG_ADDRESS, orderMints } from "@orca-so/whirlpools";
import {
  fetchLockConfig,
  fetchWhirlpool,
  getPositionAddress,
  LockType,
  WHIRLPOOL_PROGRAM_ADDRESS,
} from "@orca-so/whirlpools-client";
import { fetchToken } from "@solana-program/token-2022";
import { priceToSqrtPrice } from "@orca-so/whirlpools-core";
import assert from "assert";
import Decimal from "decimal.js";
import { setupAta2022, setupMint2022 } from "./utils/token2022";

describe("Launchpad CPI", () => {
  // Run multiple tests to account for randomness in token ordering.
  // When pairing a token and token-2022, the client code must reorder them
  // based on canonical ordering, which introduces variability in how tokens
  // are processed. Running multiple tests ensures we cover different ordering scenarios.
  it.each(Array.from({ length: 10 }, (_, i) => i + 1))("Should graduate token to orca (Test %s)", async (testNumber) => {
    // Setup test values
    const decimals0: number = 9;
    const decimals1: number = 6;
    const tokenAmount0: bigint = 138000000000n;
    const tokenAmount1: bigint = 1000000000000000001n;

    // Get position owner address
    const positionOwner = (
      await getProgramDerivedAddress({
        programAddress: WHIRLPOOL_CPI_PROGRAM_ADDRESS,
        seeds: ["position_owner"],
      })
    )[0];

    // Setup mints and ATAs
    const mint0 = await setupMint({ decimals: decimals0 });
    const mint1 = await setupMint2022({ decimals: decimals1 });
    const ata0 = await setupAta(mint0, {
      amount: tokenAmount0,
      owner: positionOwner,
    });
    const ata1 = await setupAta2022(mint1, {
      amount: tokenAmount1,
      owner: positionOwner,
    });

    // Create graduate token instruction
    const { ix, whirlpoolAddress, positionMintAddress, tokenMintA, tokenMintB } =
      await createGraduateTokenToOrcaInstruction(
        rpc,
        WHIRLPOOLS_CONFIG_ADDRESS,
        signer,
        tokenAmount0,
        tokenAmount1,
        mint0,
        mint1
      );
    await sendTransaction([ix]);

    // THE FOLLOWING PART IS ONLY NEEDED TO ASSERT THE RESULTS
    // Determine token ordering - 
    const [mintA, mintB] = orderMints(mint0, mint1);
    const isReordered = mintA !== mint0;
    let tokenAmountA: bigint;
    let tokenAmountB: bigint;
    let decimalsA: number;
    let decimalsB: number;
    let ataA: Address;
    let ataB: Address;
    if (isReordered) {
      tokenAmountA = tokenAmount1;
      tokenAmountB = tokenAmount0;
      decimalsA = decimals1;
      decimalsB = decimals0;
      ataA = ata1;
      ataB = ata0;
    } else {
      tokenAmountA = tokenAmount0;
      tokenAmountB = tokenAmount1;
      decimalsA = decimals0;
      decimalsB = decimals1;
      ataA = ata0;
      ataB = ata1;
    }

    // Calculate expected price
    const price = new Decimal(tokenAmountB.toString())
      .mul(new Decimal(10).pow(decimalsA))
      .div(new Decimal(tokenAmountA.toString()).mul(new Decimal(10).pow(decimalsB)));
    const sqrtPrice = priceToSqrtPrice(
      price.toNumber(),
      decimalsA,
      decimalsB
    );

    // Fetch pool data
    const whirlpool = await fetchWhirlpool(rpc, whirlpoolAddress);
    const tokenVaultA = whirlpool.data.tokenVaultA;
    const tokenVaultB = whirlpool.data.tokenVaultB;
    const positionAddress = (await getPositionAddress(positionMintAddress))[0];
    const lockConfig = (
      await getProgramDerivedAddress({
        programAddress: WHIRLPOOL_PROGRAM_ADDRESS,
        seeds: ["lock_config", getAddressEncoder().encode(positionAddress)],
      })
    )[0];

    // Get token balances
    const balanceAtaA = (await fetchToken(rpc, ataA)).data.amount;
    const balanceAtaB = (await fetchToken(rpc, ataB)).data.amount;
    const balanceTokenVaultA = (await fetchToken(rpc, tokenVaultA)).data.amount;
    const balanceTokenVaultB = (await fetchToken(rpc, tokenVaultB)).data.amount;
    const lockType = (await fetchLockConfig(rpc, lockConfig)).data.lockType;

    // Allow for small differences due to rounding
    const maxDiffPercentage = 0.005;

    const tokenVaultADiff = balanceTokenVaultA > tokenAmountA
      ? balanceTokenVaultA - tokenAmountA
      : tokenAmountA - balanceTokenVaultA;
    const tokenVaultBDiff = balanceTokenVaultB > tokenAmountB
      ? balanceTokenVaultB - tokenAmountB
      : tokenAmountB - balanceTokenVaultB;

    const tokenVaultADiffPercentage = Number(tokenVaultADiff) / Number(tokenAmountA);
    const tokenVaultBDiffPercentage = Number(tokenVaultBDiff) / Number(tokenAmountB);

    // Assertions
    assert.strictEqual(whirlpool.data.sqrtPrice, sqrtPrice);
    assert.ok(tokenVaultADiffPercentage <= maxDiffPercentage);
    assert.ok(tokenVaultBDiffPercentage <= maxDiffPercentage);
    assert.strictEqual(balanceAtaA, tokenVaultADiff);
    assert.strictEqual(balanceAtaB, tokenVaultBDiff);
    assert.strictEqual(lockType, LockType.Permanent);
  });
});
