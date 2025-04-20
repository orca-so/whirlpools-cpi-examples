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
import { getAccount } from "@solana/spl-token";
import {
  buildDefaultAccountFetcher,
  LockConfigUtil,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  PriceMath,
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";

describe("Launchpad CPI", () => {
  let positionOwner: PublicKey;
  let mintA: PublicKey;
  let mintB: PublicKey;
  let ataA: PublicKey;
  let ataB: PublicKey;
  const tokenMax0 = new BN("1000000000000000000");
  const tokenMax1 = new BN("1000000000000000000");

  beforeAll(async () => {
    positionOwner = AddressUtil.findProgramAddress(
      [Buffer.from("position_owner")],
      WHIRLPOOL_CPI_PROGRAM_ID
    ).publicKey;
    mintA = await setupMint({ decimals: 6 });
    mintB = await setupMint({ decimals: 6 });
    ataA = await setupAta(mintA, { owner: positionOwner, amount: tokenMax0 });
    ataB = await setupAta(mintB, { owner: positionOwner, amount: tokenMax1 });
  });

  it("Should graduate token to orca", async () => {
    const { tx, whirlpoolAddress, positionMintAddress, tokenMintA, tokenMintB } =
      await createGraduateTokenToOrcaTransaction(
        connection,
        whirlpoolsConfigAddress,
        signer,
        tokenMax0,
        tokenMax1,
        mintA,
        mintB
      );

    const txRes = await connection.sendTransaction(tx);

    const price = new Decimal(1);
    const sqrtPrice = PriceMath.priceToSqrtPriceX64(price, 6, 6);

    const fetcher = buildDefaultAccountFetcher(connection);
    const whirlpool = await fetcher.getPool(whirlpoolAddress);
    const tokenVaultA = whirlpool.tokenVaultA;
    const tokenVaultB = whirlpool.tokenVaultB;
    const positionAddress = PDAUtil.getPosition(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      positionMintAddress
    ).publicKey;

    const balanceAtaA = (await getAccount(connection, ataA)).amount;
    const balanceAtaB = (await getAccount(connection, ataB)).amount;
    const balanceTokenVaultA = (await getAccount(connection, tokenVaultA))
      .amount;
    const balanceTokenVaultB = (await getAccount(connection, tokenVaultB))
      .amount;

    const lockConfig = await fetcher.getLockConfig(
      PDAUtil.getLockConfig(ORCA_WHIRLPOOL_PROGRAM_ID, positionAddress)
        .publicKey
    );
    const lockType = lockConfig.lockType;

    assert.strictEqual(BigInt(whirlpool.sqrtPrice), BigInt(sqrtPrice));
    assert.strictEqual(balanceAtaA, 0n);
    assert.strictEqual(balanceAtaB, 0n);
    assert.strictEqual(balanceTokenVaultA, BigInt(tokenMax0));
    assert.strictEqual(balanceTokenVaultB, BigInt(tokenMax1));
    assert.deepStrictEqual(lockType, LockConfigUtil.getPermanentLockType());
  });
});
