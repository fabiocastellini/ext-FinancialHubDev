import { exposeLegacyFunctions } from './utils/legacy.js';

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
  rptFilterYear: 'all',

  editTxId : null,
  allTxHoldingId: null,
  allTxFilter: 'all',
  allTxFrom: '',
  allTxTo: '',
  allTxDateFilterOpen: false,
  allTxSearchQuery: '',
};

export function getAllTxFrom(){
  return state.allTxFrom;
}

export function getAllTxTo(){
  return state.allTxTo;
}

export function setAllTxFrom(value){
  state.allTxFrom = value;
}

export function setAllTxTo(value){
  state.allTxTo = value;
}

exposeLegacyFunctions({
  getAllTxFrom,
  getAllTxTo,
  setAllTxFrom,
  setAllTxTo,
});