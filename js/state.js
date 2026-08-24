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
  dpState: {
    field: null,
    onChange: null,
    viewYear: null,
    viewMonth: null,
    value: '',
    withTime: false
  },
  selectModalOnChoose: null,
  catCreateTargetField: null,
  categoryDetailId: null,
  rptYearOptionsCache: [{ value: 'all', label: 'All time' }],
  bulkSelectMode: false,
  selectedTxIds: new Set(),
  cfOpenTypes: new Set(),
  rptFilterYear: 'all',

  editTxId: null,
  allTxHoldingId: null,
  allTxFilter: 'all',
  allTxFrom: '',
  allTxTo: '',
  allTxDateFilterOpen: false,
  allTxSearchQuery: '',
};


// ─────────────────────────────────────────────
// Getters
// ─────────────────────────────────────────────

export function getHoldings() {
  return state.holdings;
}

export function getCfCategories() {
  return state.cfCategories;
}

export function getCfTransactions() {
  return state.cfTransactions;
}

export function getCfRecurrences() {
  return state.cfRecurrences;
}

export function getCfType() {
  return state.cfType;
}

export function getCfIType() {
  return state.cfIType;
}

export function getCfCtx() {
  return state.cfCtx;
}

export function getCfSearchQuery() {
  return state.cfSearchQuery;
}

export function getDragSrcType() {
  return state.dragSrcType;
}

export function getTransactions() {
  return state.transactions;
}

export function getTransactionFilter() {
  return state.transactionFilter;
}

export function getPrices() {
  return state.prices;
}

export function getSnapshots() {
  return state.snapshots;
}

export function getActivePeriod() {
  return state.activePeriod;
}

export function getCharts() {
  return state.charts;
}

export function getDpState() {
  return state.dpState;
}

export function getSelectModalOnChoose() {
  return state.selectModalOnChoose;
}

export function getCatCreateTargetField() {
  return state.catCreateTargetField;
}

export function getCategoryDetailId() {
  return state.categoryDetailId;
}

export function getRptYearOptionsCache() {
  return state.rptYearOptionsCache;
}

export function getBulkSelectMode() {
  return state.bulkSelectMode;
}

export function getSelectedTxIds() {
  return state.selectedTxIds;
}

export function getCfOpenTypes() {
  return state.cfOpenTypes;
}

export function getRptFilterYear() {
  return state.rptFilterYear;
}

export function getEditTxId() {
  return state.editTxId;
}

export function getAllTxHoldingId() {
  return state.allTxHoldingId;
}

export function getAllTxFilter() {
  return state.allTxFilter;
}

export function getAllTxFrom() {
  return state.allTxFrom;
}

export function getAllTxTo() {
  return state.allTxTo;
}

export function getAllTxDateFilterOpen() {
  return state.allTxDateFilterOpen;
}

export function getAllTxSearchQuery() {
  return state.allTxSearchQuery;
}


// ─────────────────────────────────────────────
// Setters
// ─────────────────────────────────────────────

export function setHoldings(value) {
  state.holdings = value;
}

export function setCfCategories(value) {
  state.cfCategories = value;
}

export function setCfTransactions(value) {
  state.cfTransactions = value;
}

export function setCfRecurrences(value) {
  state.cfRecurrences = value;
}

export function setCfType(value) {
  state.cfType = value;
}

export function setCfIType(value) {
  state.cfIType = value;
}

export function setCfCtx(value) {
  state.cfCtx = value;
}

export function setCfSearchQuery(value) {
  state.cfSearchQuery = value;
}

export function setDragSrcType(value) {
  state.dragSrcType = value;
}

export function setTransactions(value) {
  state.transactions = value;
}

export function setTransactionFilter(value) {
  state.transactionFilter = value;
}

export function setPrices(value) {
  state.prices = value;
}

export function setSnapshots(value) {
  state.snapshots = value;
}

export function setActivePeriod(value) {
  state.activePeriod = value;
}

export function setCharts(value) {
  state.charts = value;
}

export function setDpState(value) {
  state.dpState = value;
}

export function setSelectModalOnChoose(value) {
  state.selectModalOnChoose = value;
}

export function setCatCreateTargetField(value) {
  state.catCreateTargetField = value;
}

export function setCategoryDetailId(value) {
  state.categoryDetailId = value;
}

export function setRptYearOptionsCache(value) {
  state.rptYearOptionsCache = value;
}

export function setBulkSelectMode(value) {
  state.bulkSelectMode = value;
}

export function setSelectedTxIds(value) {
  state.selectedTxIds = value;
}

export function setCfOpenTypes(value) {
  state.cfOpenTypes = value;
}

export function setRptFilterYear(value) {
  state.rptFilterYear = value;
}

export function setEditTxId(value) {
  state.editTxId = value;
}

export function setAllTxHoldingId(value) {
  state.allTxHoldingId = value;
}

export function setAllTxFilter(value) {
  state.allTxFilter = value;
}

export function setAllTxFrom(value) {
  state.allTxFrom = value;
}

export function setAllTxTo(value) {
  state.allTxTo = value;
}

export function setAllTxDateFilterOpen(value) {
  state.allTxDateFilterOpen = value;
}

export function setAllTxSearchQuery(value) {
  state.allTxSearchQuery = value;
}


// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────

exposeLegacyFunctions({
  getHoldings,
  getCfCategories,
  getCfTransactions,
  getCfRecurrences,
  getCfType,
  getCfIType,
  getCfCtx,
  getCfSearchQuery,
  getDragSrcType,

  getTransactions,
  getTransactionFilter,

  getPrices,
  getSnapshots,
  getActivePeriod,
  getCharts,
  getDpState,
  getSelectModalOnChoose,
  getCatCreateTargetField,
  getCategoryDetailId,
  getRptYearOptionsCache,
  getBulkSelectMode,
  getSelectedTxIds,
  getCfOpenTypes,
  getRptFilterYear,

  getEditTxId,
  getAllTxHoldingId,
  getAllTxFilter,
  getAllTxFrom,
  getAllTxTo,
  getAllTxDateFilterOpen,
  getAllTxSearchQuery,

  setHoldings,
  setCfCategories,
  setCfTransactions,
  setCfRecurrences,
  setCfType,
  setCfIType,
  setCfCtx,
  setCfSearchQuery,
  setDragSrcType,

  setTransactions,
  setTransactionFilter,

  setPrices,
  setSnapshots,
  setActivePeriod,
  setCharts,
  setDpState,
  setSelectModalOnChoose,
  setCatCreateTargetField,
  setCategoryDetailId,
  setRptYearOptionsCache,
  setBulkSelectMode,
  setSelectedTxIds,
  setCfOpenTypes,
  setRptFilterYear,

  setEditTxId,
  setAllTxHoldingId,
  setAllTxFilter,
  setAllTxFrom,
  setAllTxTo,
  setAllTxDateFilterOpen,
  setAllTxSearchQuery,
});