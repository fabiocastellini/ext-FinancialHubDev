-- Funds are priced like the other market-traded holdings, with an explicit
-- look-through allocation for portfolio analysis.
alter table public.holdings
  add column if not exists stock_percentage numeric,
  add column if not exists bond_percentage numeric;

alter table public.holdings
  drop constraint if exists holdings_fund_allocation_check;

alter table public.holdings
  add constraint holdings_fund_allocation_check
  check (
    type <> 'fund'
    or (
      stock_percentage is not null
      and bond_percentage is not null
      and stock_percentage >= 0
      and stock_percentage <= 100
      and bond_percentage >= 0
      and bond_percentage <= 100
      and stock_percentage + bond_percentage = 100
    )
  );
