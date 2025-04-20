use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, memo::Memo, token_2022::Token2022};
use orca_whirlpools_client::{
    IncreaseLiquidityV2Cpi, IncreaseLiquidityV2CpiAccounts, IncreaseLiquidityV2InstructionArgs,
    InitializePoolV2Cpi, InitializePoolV2CpiAccounts, InitializePoolV2InstructionArgs,
    InitializeTickArrayCpi, InitializeTickArrayCpiAccounts, InitializeTickArrayInstructionArgs,
    LockPositionCpi, LockPositionCpiAccounts, LockPositionInstructionArgs, LockType,
    OpenPositionWithTokenExtensionsCpi, OpenPositionWithTokenExtensionsCpiAccounts,
    OpenPositionWithTokenExtensionsInstructionArgs,
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
    pub token_mint_a: UncheckedAccount<'info>,
    pub token_mint_b: UncheckedAccount<'info>,
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
    pub token_program_a: UncheckedAccount<'info>,
    pub token_program_b: UncheckedAccount<'info>,
    /// CHECK: Account is checked by the Whirlpool program
    #[account(mut)]
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
    let position_owner_seeds = &[b"position_owner".as_ref(), &[ctx.bumps.position_owner]];

    initialize_pool_cpi(
        &whirlpool_program,
        &ctx.accounts,
        tick_spacing,
        initial_sqrt_price,
    )?;

    initialize_tick_array_cpi(
        &whirlpool_program,
        &ctx.accounts,
        start_tick_index_lower,
        &ctx.accounts.tick_array_lower,
    )?;

    initialize_tick_array_cpi(
        &whirlpool_program,
        &ctx.accounts,
        start_tick_index_upper,
        &ctx.accounts.tick_array_upper,
    )?;

    open_position_with_token_extensions_cpi(
        &whirlpool_program,
        &ctx.accounts,
        tick_lower_index,
        tick_upper_index,
        with_token_metadata_extension,
    )?;

    increase_liquidity_cpi(
        &whirlpool_program,
        &ctx.accounts,
        liquidity_amount,
        token_max_a,
        token_max_b,
        position_owner_seeds,
    )?;

    lock_position_cpi(&whirlpool_program, &ctx.accounts, position_owner_seeds)?;

    Ok(())
}

// Helper functions for CPI calls

fn initialize_pool_cpi<'a>(
    whirlpool_program: &AccountInfo<'a>,
    accounts: &GraduateTokenToOrca<'a>,
    tick_spacing: u16,
    initial_sqrt_price: u128,
) -> Result<()> {
    let cpi_accounts = InitializePoolV2CpiAccounts {
        whirlpools_config: &accounts.whirlpools_config.to_account_info(),
        token_mint_a: &accounts.token_mint_a.to_account_info(),
        token_mint_b: &accounts.token_mint_b.to_account_info(),
        token_badge_a: &accounts.token_badge_a.to_account_info(),
        token_badge_b: &accounts.token_badge_b.to_account_info(),
        funder: &accounts.funder.to_account_info(),
        whirlpool: &accounts.whirlpool.to_account_info(),
        token_vault_a: &accounts.token_vault_a.to_account_info(),
        token_vault_b: &accounts.token_vault_b.to_account_info(),
        fee_tier: &accounts.fee_tier.to_account_info(),
        token_program_a: &accounts.token_program_a.to_account_info(),
        token_program_b: &accounts.token_program_b.to_account_info(),
        system_program: &accounts.system_program.to_account_info(),
        rent: &accounts.rent.to_account_info(),
    };

    let instruction_args = InitializePoolV2InstructionArgs {
        tick_spacing,
        initial_sqrt_price,
    };

    InitializePoolV2Cpi::new(whirlpool_program, cpi_accounts, instruction_args).invoke()?;

    Ok(())
}

fn initialize_tick_array_cpi<'a>(
    whirlpool_program: &AccountInfo<'a>,
    accounts: &GraduateTokenToOrca<'a>,
    start_tick_index: i32,
    tick_array: &UncheckedAccount<'a>,
) -> Result<()> {
    let cpi_accounts = InitializeTickArrayCpiAccounts {
        whirlpool: &accounts.whirlpool.to_account_info(),
        tick_array: &tick_array.to_account_info(),
        funder: &accounts.funder.to_account_info(),
        system_program: &accounts.system_program.to_account_info(),
    };

    let instruction_args = InitializeTickArrayInstructionArgs { start_tick_index };

    InitializeTickArrayCpi::new(whirlpool_program, cpi_accounts, instruction_args).invoke()?;

    Ok(())
}

fn open_position_with_token_extensions_cpi<'a>(
    whirlpool_program: &AccountInfo<'a>,
    accounts: &GraduateTokenToOrca<'a>,
    tick_lower_index: i32,
    tick_upper_index: i32,
    with_token_metadata_extension: bool,
) -> Result<()> {
    let cpi_accounts = OpenPositionWithTokenExtensionsCpiAccounts {
        funder: &accounts.funder.to_account_info(),
        owner: &accounts.position_owner.to_account_info(),
        position: &accounts.position.to_account_info(),
        position_mint: &accounts.position_mint.to_account_info(),
        position_token_account: &accounts.position_token_account.to_account_info(),
        whirlpool: &accounts.whirlpool.to_account_info(),
        token2022_program: &accounts.token_2022_program.to_account_info(),
        system_program: &accounts.system_program.to_account_info(),
        associated_token_program: &accounts.associated_token_program.to_account_info(),
        metadata_update_auth: &accounts.metadata_update_auth.to_account_info(),
    };

    let instruction_args = OpenPositionWithTokenExtensionsInstructionArgs {
        tick_lower_index,
        tick_upper_index,
        with_token_metadata_extension,
    };

    OpenPositionWithTokenExtensionsCpi::new(whirlpool_program, cpi_accounts, instruction_args)
        .invoke()?;

    Ok(())
}

fn increase_liquidity_cpi<'a>(
    whirlpool_program: &AccountInfo<'a>,
    accounts: &GraduateTokenToOrca<'a>,
    liquidity_amount: u128,
    token_max_a: u64,
    token_max_b: u64,
    position_owner_seeds: &[&[u8]],
) -> Result<()> {
    let cpi_accounts = IncreaseLiquidityV2CpiAccounts {
        whirlpool: &accounts.whirlpool.to_account_info(),
        token_program_a: &accounts.token_program_a.to_account_info(),
        token_program_b: &accounts.token_program_b.to_account_info(),
        memo_program: &accounts.memo_program.to_account_info(),
        position_authority: &accounts.position_owner.to_account_info(),
        position: &accounts.position.to_account_info(),
        position_token_account: &accounts.position_token_account.to_account_info(),
        token_mint_a: &accounts.token_mint_a.to_account_info(),
        token_mint_b: &accounts.token_mint_b.to_account_info(),
        token_owner_account_a: &accounts.token_owner_account_a.to_account_info(),
        token_owner_account_b: &accounts.token_owner_account_b.to_account_info(),
        token_vault_a: &accounts.token_vault_a.to_account_info(),
        token_vault_b: &accounts.token_vault_b.to_account_info(),
        tick_array_lower: &accounts.tick_array_lower.to_account_info(),
        tick_array_upper: &accounts.tick_array_upper.to_account_info(),
    };

    let instruction_args = IncreaseLiquidityV2InstructionArgs {
        liquidity_amount,
        token_max_a,
        token_max_b,
        remaining_accounts_info: None, // Transfer hook is not supported
    };

    IncreaseLiquidityV2Cpi::new(whirlpool_program, cpi_accounts, instruction_args)
        .invoke_signed(&[position_owner_seeds])?;

    Ok(())
}

fn lock_position_cpi<'a>(
    whirlpool_program: &AccountInfo<'a>,
    accounts: &GraduateTokenToOrca<'a>,
    position_owner_seeds: &[&[u8]],
) -> Result<()> {
    let cpi_accounts = LockPositionCpiAccounts {
        funder: &accounts.funder.to_account_info(),
        position_authority: &accounts.position_owner.to_account_info(),
        position: &accounts.position.to_account_info(),
        position_mint: &accounts.position_mint.to_account_info(),
        position_token_account: &accounts.position_token_account.to_account_info(),
        lock_config: &accounts.lock_config.to_account_info(),
        whirlpool: &accounts.whirlpool.to_account_info(),
        token2022_program: &accounts.token_2022_program.to_account_info(),
        system_program: &accounts.system_program.to_account_info(),
    };

    let instruction_args = LockPositionInstructionArgs {
        lock_type: LockType::Permanent,
    };

    LockPositionCpi::new(whirlpool_program, cpi_accounts, instruction_args)
        .invoke_signed(&[position_owner_seeds])?;

    Ok(())
}
