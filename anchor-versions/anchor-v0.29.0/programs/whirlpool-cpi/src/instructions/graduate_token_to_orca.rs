use std::str::FromStr;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    memo::Memo,
    token::{Mint, Token},
    token_2022::Token2022,
};
use orca_whirlpools_client::{
    IncreaseLiquidityV2Cpi, IncreaseLiquidityV2CpiAccounts, IncreaseLiquidityV2InstructionArgs,
    InitializePoolV2Cpi, InitializePoolV2CpiAccounts, InitializePoolV2InstructionArgs,
    InitializeTickArrayCpi, InitializeTickArrayCpiAccounts, InitializeTickArrayInstructionArgs,
    LockPositionInstructionArgs, OpenPositionWithTokenExtensionsCpi,
    OpenPositionWithTokenExtensionsCpiAccounts, OpenPositionWithTokenExtensionsInstructionArgs,
};
use solana_program::pubkey::Pubkey;

#[derive(Accounts)]
pub struct GraduateTokenToOrca<'info> {
    /// CHECK: Account is checked by the Whirlpool program
    pub whirlpool_program: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    pub whirlpools_config: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub whirlpool: UncheckedAccount<'info>,
    pub token_mint_a: Account<'info, Mint>,
    pub token_mint_b: Account<'info, Mint>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub token_badge_a: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub token_badge_b: UncheckedAccount<'info>,
    #[account(mut)]
    pub funder: Signer<'info>,
    #[account(mut)]
    pub token_vault_a: Signer<'info>,
    #[account(mut)]
    pub token_vault_b: Signer<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    pub fee_tier: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub tick_array_lower: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub tick_array_upper: UncheckedAccount<'info>,
    /// CHECK: This is a PDA used as a signer, not an account with data
    #[account(
        seeds = [b"position_owner".as_ref()],
        bump,
    )]
    pub position_owner: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub position: UncheckedAccount<'info>,
    #[account(mut)]
    pub position_mint: Signer<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub position_token_account: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub token_owner_account_a: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
    pub token_owner_account_b: UncheckedAccount<'info>,
    pub token_program_a: Program<'info, Token>,
    pub token_program_b: Program<'info, Token>,
    /// CHECK: Account is checked by the Whirlpool program
    pub lock_config: UncheckedAccount<'info>,
    pub token_2022_program: Program<'info, Token2022>,
    /// CHECK: Account is checked by the Whirlpool program
    pub metadata_update_auth: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub memo_program: Program<'info, Memo>,
}

pub fn handler(
    ctx: Context<GraduateTokenToOrca>,
    tick_spacing: u16,
    initial_sqrt_price: u128,
    start_tick_index_lower: i32,
    start_tick_index_upper: i32,
    tick_lower_index: i32,
    tick_upper_index: i32,
    with_token_metadata_extension: bool,
    liquidity_amount: u128,
    token_max_a: u64,
    token_max_b: u64,
) -> Result<()> {
    let whirlpool_program = ctx.accounts.whirlpool_program.to_account_info();
    let initialize_pool_v2_cpi_accounts: InitializePoolV2CpiAccounts =
        InitializePoolV2CpiAccounts {
            whirlpools_config: &ctx.accounts.whirlpools_config.to_account_info(),
            token_mint_a: &ctx.accounts.token_mint_a.to_account_info(),
            token_mint_b: &ctx.accounts.token_mint_b.to_account_info(),
            token_badge_a: &ctx.accounts.token_badge_a.to_account_info(),
            token_badge_b: &ctx.accounts.token_badge_b.to_account_info(),
            funder: &ctx.accounts.funder.to_account_info(),
            whirlpool: &ctx.accounts.whirlpool.to_account_info(),
            token_vault_a: &ctx.accounts.token_vault_a.to_account_info(),
            token_vault_b: &ctx.accounts.token_vault_b.to_account_info(),
            fee_tier: &ctx.accounts.fee_tier.to_account_info(),
            token_program_a: &ctx.accounts.token_program_a.to_account_info(),
            token_program_b: &ctx.accounts.token_program_b.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
            rent: &ctx.accounts.rent.to_account_info(),
        };
    let initialize_tick_array_lower_cpi_accounts: InitializeTickArrayCpiAccounts =
        InitializeTickArrayCpiAccounts {
            whirlpool: &ctx.accounts.whirlpool.to_account_info(),
            tick_array: &ctx.accounts.tick_array_lower.to_account_info(),
            funder: &ctx.accounts.funder.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        };
    let initialize_tick_array_upper_cpi_accounts: InitializeTickArrayCpiAccounts =
        InitializeTickArrayCpiAccounts {
            whirlpool: &ctx.accounts.whirlpool.to_account_info(),
            tick_array: &ctx.accounts.tick_array_upper.to_account_info(),
            funder: &ctx.accounts.funder.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        };
    let open_position_with_token_extensions_cpi_accounts: OpenPositionWithTokenExtensionsCpiAccounts =
        OpenPositionWithTokenExtensionsCpiAccounts {
            funder: &ctx.accounts.funder.to_account_info(),
            owner: &ctx.accounts.position_owner.to_account_info(),
            position: &ctx.accounts.position.to_account_info(),
            position_mint: &ctx.accounts.position_mint.to_account_info(),
            position_token_account: &ctx.accounts.position_token_account.to_account_info(),
            whirlpool: &ctx.accounts.whirlpool.to_account_info(),
            token2022_program: &ctx.accounts.token_2022_program.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
            associated_token_program: &ctx.accounts.associated_token_program.to_account_info(),
            metadata_update_auth: &ctx.accounts.metadata_update_auth.to_account_info(),
        };
    let increase_liquidity_cpi_accounts: IncreaseLiquidityV2CpiAccounts =
        IncreaseLiquidityV2CpiAccounts {
            whirlpool: &ctx.accounts.whirlpool.to_account_info(),
            token_program_a: &ctx.accounts.token_program_a.to_account_info(),
            token_program_b: &ctx.accounts.token_program_b.to_account_info(),
            memo_program: &ctx.accounts.memo_program.to_account_info(),
            position_authority: &ctx.accounts.position_owner.to_account_info(),
            position: &ctx.accounts.position.to_account_info(),
            position_token_account: &ctx.accounts.position_token_account.to_account_info(),
            token_mint_a: &ctx.accounts.token_mint_a.to_account_info(),
            token_mint_b: &ctx.accounts.token_mint_b.to_account_info(),
            token_owner_account_a: &ctx.accounts.token_owner_account_a.to_account_info(),
            token_owner_account_b: &ctx.accounts.token_owner_account_b.to_account_info(),
            token_vault_a: &ctx.accounts.token_vault_a.to_account_info(),
            token_vault_b: &ctx.accounts.token_vault_b.to_account_info(),
            tick_array_lower: &ctx.accounts.tick_array_lower.to_account_info(),
            tick_array_upper: &ctx.accounts.tick_array_upper.to_account_info(),
        };
    // let lock_positition_cpi_accounts: LockPositionCpiAccounts = LockPositionCpiAccounts {
    //     funder: &ctx.accounts.funder.to_account_info(),
    //     position_authority: &ctx.accounts.position_owner.to_account_info(),
    //     position: &ctx.accounts.position.to_account_info(),
    //     position_mint: &ctx.accounts.position_mint.to_account_info(),
    //     position_token_account: &ctx.accounts.position_token_account.to_account_info(),
    //     lock_config: &ctx.accounts.lock_config.to_account_info(),
    //     whirlpool: &ctx.accounts.whirlpool.to_account_info(),
    //     token2022_program: &ctx.accounts.token_2022_program.to_account_info(),
    //     system_program: &ctx.accounts.system_program.to_account_info(),
    // };

    let initialize_pool_v2_instruction_args: InitializePoolV2InstructionArgs =
        InitializePoolV2InstructionArgs {
            tick_spacing,
            initial_sqrt_price,
        };
    let initialize_tick_array_lower_instruction_args: InitializeTickArrayInstructionArgs =
        InitializeTickArrayInstructionArgs {
            start_tick_index: start_tick_index_lower,
        };
    let initialize_tick_array_upper_instruction_args: InitializeTickArrayInstructionArgs =
        InitializeTickArrayInstructionArgs {
            start_tick_index: start_tick_index_upper,
        };
    let open_position_with_token_extensions_instruction_args: OpenPositionWithTokenExtensionsInstructionArgs =
        OpenPositionWithTokenExtensionsInstructionArgs {
            tick_lower_index,
            tick_upper_index,
            with_token_metadata_extension,
        };
    let increase_liquidity_instruction_args: IncreaseLiquidityV2InstructionArgs =
        IncreaseLiquidityV2InstructionArgs {
            liquidity_amount,
            token_max_a,
            token_max_b,
            remaining_accounts_info: None, // Transfer hook is not supported
        };
    // let lock_position_instruction_args: LockPositionInstructionArgs =
    //     LockPositionInstructionArgs {
    //         lock_config: 0,
    //     };

    let initialize_pool_v2_cpi: InitializePoolV2Cpi = InitializePoolV2Cpi::new(
        &whirlpool_program,
        initialize_pool_v2_cpi_accounts,
        initialize_pool_v2_instruction_args,
    );
    let initialize_tick_array_lower_cpi: InitializeTickArrayCpi = InitializeTickArrayCpi::new(
        &whirlpool_program,
        initialize_tick_array_lower_cpi_accounts,
        initialize_tick_array_lower_instruction_args,
    );
    let initialize_tick_array_upper_cpi: InitializeTickArrayCpi = InitializeTickArrayCpi::new(
        &whirlpool_program,
        initialize_tick_array_upper_cpi_accounts,
        initialize_tick_array_upper_instruction_args,
    );
    let open_position_with_token_extensions_cpi: OpenPositionWithTokenExtensionsCpi =
        OpenPositionWithTokenExtensionsCpi::new(
            &whirlpool_program,
            open_position_with_token_extensions_cpi_accounts,
            open_position_with_token_extensions_instruction_args,
        );
    let increase_liquidity_cpi: IncreaseLiquidityV2Cpi = IncreaseLiquidityV2Cpi::new(
        &whirlpool_program,
        increase_liquidity_cpi_accounts,
        increase_liquidity_instruction_args,
    );
    // let lock_position_cpi: LockPositionCpi = LockPositionCpi::new(
    //     &ctx.accounts.whirlpool_program.to_account_info(),
    //     lock_position_cpi_accounts,
    //     lock_position_instruction_args,
    // );

    let _ = initialize_pool_v2_cpi.invoke();
    let _ = initialize_tick_array_lower_cpi.invoke();
    let _ = initialize_tick_array_upper_cpi.invoke();
    let _ = open_position_with_token_extensions_cpi.invoke();
    let _ = increase_liquidity_cpi
        .invoke_signed(&[&[b"position_owner".as_ref(), &[ctx.bumps.position_owner]]]);

    Ok(())
}
