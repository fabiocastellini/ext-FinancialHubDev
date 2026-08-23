export const state = {
  holdings: [],

  // Cashflow
  cfCategories: [],
  cfTransactions: [],
  cfRecurrences: [],
  cfType: 'expense',
  cfIType: 'purchase',
  cfCtx: 'account',
  cfSearchQuery: '',
  dragSrcType: null,

  // Transactions
  transactions: [],
  transactionFilter: 'all',

  prices: {},
  snapshots: [],
  activePeriod: 30,
  charts: {},
  dpState: { field: null, onChange: null, viewYear: null, viewMonth: null, value: '', withTime: false },
  selectModalOnChoose: null,
  catCreateTargetField: null,
  rptYearOptionsCache: [{ value: 'all', label: 'All time' }],
  bulkSelectMode: false,
  selectedTxIds: new Set(),
  cfOpenTypes: new Set(),
  rptFilterYear: 'all'
};