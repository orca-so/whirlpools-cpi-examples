import type { ExtensionArgs } from "@solana-program/token-2022";
import {
    findAssociatedTokenPda,
    TOKEN_2022_PROGRAM_ADDRESS,
    getCreateAssociatedTokenIdempotentInstruction,
    getMintToInstruction,
    getMintSize,
    getInitializeMint2Instruction,
    getInitializeTransferFeeConfigInstruction,
    getSetTransferFeeInstruction,
} from "@solana-program/token-2022";
import { generateKeyPairSigner, type Address, type IInstruction } from "@solana/kit";
import { sendTransaction, signer } from "./mockRpc";
import { getCreateAccountInstruction } from "@solana-program/system";

export async function setupAta2022(
    mint: Address,
    config: { amount?: number | bigint; owner?: Address } = {},
): Promise<Address> {
    const ata = await findAssociatedTokenPda({
        mint,
        owner: config.owner ?? signer.address,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const instructions: IInstruction[] = [];

    instructions.push(
        getCreateAssociatedTokenIdempotentInstruction({
            mint,
            owner: config.owner ?? signer.address,
            ata: ata[0],
            payer: signer,
            tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
        }),
    );

    if (config.amount) {
        instructions.push(
            getMintToInstruction({
                mint,
                token: ata[0],
                mintAuthority: signer,
                amount: config.amount,
            }),
        );
    }

    await sendTransaction(instructions);

    return ata[0];
}

export async function setupMint2022(
    config: { decimals?: number; extensions?: ExtensionArgs[] } = {},
): Promise<Address> {
    const keypair = await generateKeyPairSigner();
    const instructions: IInstruction[] = [];

    instructions.push(
        getCreateAccountInstruction({
            payer: signer,
            newAccount: keypair,
            lamports: 1e8,
            space: getMintSize(config.extensions),
            programAddress: TOKEN_2022_PROGRAM_ADDRESS,
        }),
    );

    instructions.push(
        getInitializeMint2Instruction({
            mint: keypair.address,
            mintAuthority: signer.address,
            freezeAuthority: null,
            decimals: config.decimals ?? 6,
        }),
    );

    await sendTransaction(instructions);

    return keypair.address;
}

