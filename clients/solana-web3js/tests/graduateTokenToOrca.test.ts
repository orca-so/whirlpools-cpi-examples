import { Or } from "./../../solana-kit/node_modules/expect-type/dist/utils.d";
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
import { BN, Wallet } from "@coral-xyz/anchor";
import { ctx, WHIRLPOOL_CPI_PROGRAM_ID } from "./utils/program";
import { getAccount } from "@solana/spl-token";
import {
  buildWhirlpoolClient,
  LockConfigUtil,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  PDAUtil,
  PriceMath,
  WhirlpoolContext,
} from "@orca-so/whirlpools-sdk";
import Decimal from "decimal.js";
import { rpc } from "@coral-xyz/anchor/dist/cjs/utils";

describe("Launchpad CPI", () => {
  let positionOwner: PublicKey;
  let mintA: PublicKey;
  let mintB: PublicKey;
  let ataA: PublicKey;
  let ataB: PublicKey;
  const tokenMaxA = new BN("1000000000000000000");
  const tokenMaxB = new BN("1000000000000000000");

  beforeAll(async () => {
    positionOwner = AddressUtil.findProgramAddress(
      [Buffer.from("position_owner")],
      WHIRLPOOL_CPI_PROGRAM_ID
    ).publicKey;
    mintA = await setupMint({ decimals: 6 });
    mintB = await setupMint({ decimals: 6 });
    ataA = await setupAta(mintA, { owner: positionOwner, amount: tokenMaxA });
    ataB = await setupAta(mintB, { owner: positionOwner, amount: tokenMaxB });
  });

  it("Should graduate token to orca", async () => {
    const { tx, positionMintAddress, whirlpoolAddress } =
      await createGraduateTokenToOrcaTransaction(
        connection,
        whirlpoolsConfigAddress,
        signer,
        tokenMaxA,
        tokenMaxB,
        mintA,
        mintB
      );

    const txRes = await connection.sendTransaction(tx);
    console.log("txRes", txRes);

    const price = new Decimal(1);
    const sqrtPrice = PriceMath.priceToSqrtPriceX64(price, 6, 6);

    const ctx = WhirlpoolContext.from(
      connection,
      new Wallet(signer),
      ORCA_WHIRLPOOL_PROGRAM_ID
    );
    const wAccount = await connection.getAccountInfo(whirlpoolAddress);
    console.log("wAccount", wAccount);
    const client = buildWhirlpoolClient(ctx);
    const whirlpoool = await client.getPool(whirlpoolAddress);
    const whirlpoolData = whirlpoool.getData();
    const tokenVaultA = whirlpoolData.tokenVaultA;
    const tokenVaultB = whirlpoolData.tokenVaultB;
    const positionAddress = PDAUtil.getPosition(
      ORCA_WHIRLPOOL_PROGRAM_ID,
      positionMintAddress
    )[0];

    const balanceAtaA = (await getAccount(connection, ataA)).amount;
    const balanceAtaB = (await getAccount(connection, ataB)).amount;
    const balanceTokenVaultA = (await getAccount(connection, tokenVaultA))
      .amount;
    const balanceTokenVaultB = (await getAccount(connection, tokenVaultB))
      .amount;
    const position = await client.getPosition(positionAddress);
    const lockType = (await position.getLockConfigData()).lockType;

    assert.strictEqual(balanceAtaA, 0n);
    assert.strictEqual(balanceAtaB, 0n);
    assert.strictEqual(balanceTokenVaultA, tokenMaxA);
    assert.strictEqual(balanceTokenVaultB, tokenMaxB);
    assert.strictEqual(lockType, LockConfigUtil.getPermanentLockType());
  });
});
