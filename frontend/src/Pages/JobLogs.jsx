import React, { useState, useEffect, useRef } from "react";
import axios from '../API/axios';
import { useLenisScroll } from '../Hooks/useLenisScroll.js';
import herculesLogo from '../Assets/herculeslogo.png';
import salalahLogo from '../Assets/salalah_logo.png';
import asmLogo from '../Assets/Asm_Logo.png';

const REPORT_OPTIONS = [
  { value: 'FCL', label: 'FCL' },
  { value: 'SCL', label: 'SCL' },
  { value: 'MILL-A', label: 'Mill-A' },
  { value: 'FTRA', label: 'FTRA' },
];

const transformOrderNameForDisplay = (orderName) => {
  if (!orderName) return orderName;
  return orderName.toString().replace(/MILA/gi, 'Mill-A');
};

const getReportTypeDisplayName = (reportType) => {
  if (reportType === 'MILL-A') return 'Mill-A';
  return reportType;
};

// Parse archive created_at to a valid Date or null (ISO "YYYY-MM-DD HH:MM:SS", RFC 822, or as-is)
function parseArchiveDate(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s) return null;
  // Only normalize ISO-style "YYYY-MM-DD HH:MM:SS" (replace single space between date and time with 'T')
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
  if (isoMatch) {
    s = isoMatch[1] + 'T' + isoMatch[2];
    const dot = s.indexOf('.');
    if (dot !== -1) s = s.substring(0, dot);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const MAX_SUMMARY_LEN = 28;

// Build full and short receiver/bran-receiver text from last archive row (for MIL-A job list)
function buildMilaReceiverStrings(lastRow) {
  if (!lastRow) return { full: '', short: '—' };
  let receiver = lastRow.receiver;
  let bran_receiver = lastRow.bran_receiver;
  if (typeof receiver === 'string') {
    try { receiver = JSON.parse(receiver || '[]'); } catch { receiver = []; }
  }
  if (!Array.isArray(receiver)) receiver = [];
  if (typeof bran_receiver === 'string') {
    try { bran_receiver = JSON.parse(bran_receiver || '{}'); } catch { bran_receiver = {}; }
  }
  if (bran_receiver === null || typeof bran_receiver !== 'object') bran_receiver = {};
  const parts = [];
  receiver.forEach((r) => {
    const binId = r?.bin_id ?? r?.id ?? '—';
    const name = (r?.material_name ?? r?.material ?? r?.name ?? '').toString().trim() || '—';
    const w = typeof r?.weight_kg === 'number' ? r.weight_kg : (r?.weight ?? 0);
    parts.push(`${binId}: ${name} — ${Number(w).toFixed(1)} kg`);
  });
  Object.entries(bran_receiver).forEach(([key, val]) => {
    const w = typeof val === 'number' ? val : parseFloat(val);
    if (!Number.isNaN(w)) parts.push(`${key}: ${Number(w).toFixed(1)} kg`);
  });
  const full = parts.length ? parts.join('; ') : '—';
  const short = full.length <= MAX_SUMMARY_LEN
    ? full || '—'
    : full.slice(0, MAX_SUMMARY_LEN).trim();
  return { full, short };
}

function toShort(full) {
  const s = (full || '').trim() || '—';
  return s.length <= MAX_SUMMARY_LEN ? s : s.slice(0, MAX_SUMMARY_LEN).trim();
}

// Build receiver/sender strings from last FCL archive row (for job list table)
function buildFclReceiverStrings(lastRow) {
  if (!lastRow) return { full: '—', short: '—' };
  let fcl = lastRow.fcl_receivers;
  if (typeof fcl === 'string') {
    try { fcl = JSON.parse(fcl || '[]'); } catch { fcl = []; }
  }
  if (!Array.isArray(fcl)) fcl = [];
  const parts = fcl.map((r) => {
    const id = r?.id ?? r?.bin_id ?? '—';
    const name = (r?.name ?? r?.location ?? r?.receiver_material_name ?? '').toString().trim() || '—';
    const w = typeof r?.weight_kg === 'number' ? r.weight_kg : (r?.weight ?? 0);
    return `${id} ${name} — ${Number(w).toFixed(1)} kg`;
  });
  const full = parts.length ? parts.join('; ') : '—';
  return { full, short: toShort(full) };
}

function fcl520weWeightKgFromReceivers(row) {
  if (!row) return null;
  let fcl = row.fcl_receivers;
  if (typeof fcl === 'string') {
    try { fcl = JSON.parse(fcl || '[]'); } catch { fcl = []; }
  }
  if (!Array.isArray(fcl)) return null;
  for (const r of fcl) {
    const id = String(r?.id ?? '');
    if (id === 'FCL_2_520WE' || id.includes('520WE')) {
      const w = typeof r?.weight_kg === 'number' ? r.weight_kg : parseFloat(r?.weight);
      if (Number.isFinite(w)) return w;
    }
  }
  return null;
}

/** PLC snapshot columns on archive rows, else first/last row fcl_receivers fallback. */
function aggregateFclOrderTotalizers(rows) {
  if (!rows?.length) return { startTotalizer: null, endTotalizer: null };
  const twStarts = [];
  const twEnds = [];
  rows.forEach((row) => {
    const s = row.fcl_2_520we_at_order_start;
    const e = row.fcl_2_520we_at_order_end;
    if (s != null && s !== '') {
      const n = parseFloat(s);
      if (Number.isFinite(n)) twStarts.push(n);
    }
    if (e != null && e !== '') {
      const n = parseFloat(e);
      if (Number.isFinite(n)) twEnds.push(n);
    }
  });
  let startTotalizer = twStarts.length ? Math.min(...twStarts) : null;
  let endTotalizer = twEnds.length ? Math.max(...twEnds) : null;
  const sorted = [...rows].sort((a, b) => {
    const ta = parseArchiveDate(a.created_at)?.getTime() ?? 0;
    const tb = parseArchiveDate(b.created_at)?.getTime() ?? 0;
    return ta - tb;
  });
  if (startTotalizer == null) startTotalizer = fcl520weWeightKgFromReceivers(sorted[0]);
  if (endTotalizer == null) endTotalizer = fcl520weWeightKgFromReceivers(sorted[sorted.length - 1]);
  return { startTotalizer, endTotalizer };
}

/** FCL job produced (kg) = end − start on FCL_2_520WE; null if either side unknown. */
function fclProducedFromTotalizers(startKg, endKg) {
  const a = parseFloat(startKg);
  const b = parseFloat(endKg);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const d = b - a;
  return d >= 0 ? d : 0;
}

function mergeFclTotalizerSnapshot(summary, fclOrderRow) {
  let s = summary?.fcl_2_520we_at_order_start;
  let e = summary?.fcl_2_520we_at_order_end;
  if (fclOrderRow) {
    if ((s == null || s === '') && fclOrderRow.startTotalizer != null) s = fclOrderRow.startTotalizer;
    if ((e == null || e === '') && fclOrderRow.endTotalizer != null) e = fclOrderRow.endTotalizer;
  }
  return { start: s, end: e };
}

function fclOutputBinLocationLabel(binId) {
  const n = Number(binId);
  if (!Number.isFinite(n) || n <= 0) return 'Output Bin';
  return `Bin ${Math.trunc(n)}`;
}

function fclDisplayReceiverRowId(binId) {
  const n = Number(binId);
  if (!Number.isFinite(n) || n <= 0) return '0000';
  return String(Math.trunc(n)).padStart(4, '0');
}

function buildFclReceiverDetailRows({
  receiverBinId,
  receiverMaterialName,
  outputBinKg,
  startTotalizerKg,
  endTotalizerKg,
}) {
  return [
    {
      id: fclDisplayReceiverRowId(receiverBinId),
      product: receiverMaterialName || 'N/A',
      location: fclOutputBinLocationLabel(receiverBinId),
      weight: outputBinKg,
    },
    {
      id: 'Start totalizer',
      product: '',
      location: '',
      fclReceiverShortLabel: 'Start totalizer',
      weight:
        startTotalizerKg != null && startTotalizerKg !== '' && Number.isFinite(Number(startTotalizerKg))
          ? Number(startTotalizerKg)
          : null,
    },
    {
      id: 'End totalizer',
      product: '',
      location: '',
      fclReceiverShortLabel: 'End totalizer',
      weight:
        endTotalizerKg != null && endTotalizerKg !== '' && Number.isFinite(Number(endTotalizerKg))
          ? Number(endTotalizerKg)
          : null,
    },
  ];
}

// Build material lookup from active_sources: bin_key -> material_name
function getMaterialSummaryFromActiveSources(row) {
  let sources = row?.active_sources;
  if (typeof sources === 'string') {
    try { sources = JSON.parse(sources || '[]'); } catch { sources = []; }
  }
  if (!Array.isArray(sources)) return {};
  const map = {};
  sources.forEach((s) => {
    const binId = s?.bin_id ?? s?.id;
    if (binId == null) return;
    const key = String(binId).startsWith('bin_') ? binId : `bin_${binId}`;
    const name = (s?.material && typeof s.material === 'object' && s.material?.material_name) || s?.prd_name || s?.material_name || null;
    if (name) map[key] = name;
  });
  return map;
}

function buildFclSenderStrings(lastRow) {
  if (!lastRow) return { full: '—', short: '—' };
  let bins = lastRow.per_bin_weights;
  if (typeof bins === 'string') {
    try { bins = JSON.parse(bins || '{}'); } catch { bins = {}; }
  }
  if (bins === null || typeof bins !== 'object') bins = {};
  const materialSummary = getMaterialSummaryFromActiveSources(lastRow);
  const entries = Array.isArray(bins)
    ? (bins.map((e) => {
        const binId = e?.bin_id ?? e?.id ?? '—';
        const binKey = String(binId).startsWith('bin_') ? binId : `bin_${binId}`;
        const name = materialSummary[binKey] || null;
        const w = parseFloat(e?.total_weight ?? e?.weight ?? 0) || 0;
        return { key: binId, name, w };
      }))
    : Object.entries(bins).map(([key, w]) => {
        const binId = key.replace('bin_', '');
        const name = materialSummary[key] || materialSummary[`bin_${binId}`] || null;
        return { key: binId, name, w: parseFloat(w) || 0 };
      });
  const parts = entries.filter((e) => e.w >= 0).map((e) => (e.name ? `${e.name} (${e.key}) — ${Number(e.w).toFixed(1)} kg` : `${e.key}: ${Number(e.w).toFixed(1)} kg`));
  const full = parts.length ? parts.join('; ') : '—';
  return { full, short: toShort(full) };
}

// Build receiver/sender strings from last SCL archive row (for job list table)
function buildSclReceiverStrings(lastRow) {
  if (!lastRow) return { full: '—', short: '—' };
  let dest = lastRow.active_destination;
  if (typeof dest === 'string') {
    try { dest = JSON.parse(dest || '{}'); } catch { dest = {}; }
  }
  if (!dest || typeof dest !== 'object') dest = {};
  const binId = dest?.bin_id ?? dest?.id ?? '—';
  const name = (dest?.material && dest.material?.material_name) || dest?.prd_name || dest?.material_name || '—';
  const w = parseFloat(lastRow?.receiver ?? 0) || 0;
  const full = `${binId} ${name} — ${Number(w).toFixed(1)} kg`;
  return { full: full.trim() || '—', short: toShort(full) };
}

function buildSclSenderStrings(lastRow) {
  if (!lastRow) return { full: '—', short: '—' };
  let bins = lastRow.per_bin_weights;
  if (typeof bins === 'string') {
    try { bins = JSON.parse(bins || '{}'); } catch { bins = {}; }
  }
  if (bins === null || typeof bins !== 'object') bins = {};
  const materialSummary = getMaterialSummaryFromActiveSources(lastRow);
  const entries = Array.isArray(bins)
    ? (bins.map((e) => {
        const binId = e?.bin_id ?? e?.id ?? '—';
        const binKey = String(binId).startsWith('bin_') ? binId : `bin_${binId}`;
        const name = materialSummary[binKey] || null;
        const w = parseFloat(e?.total_weight ?? e?.weight ?? 0) || 0;
        return { key: binId, name, w };
      }))
    : Object.entries(bins).map(([key, w]) => {
        const binId = key.replace('bin_', '');
        const name = materialSummary[key] || null;
        return { key: binId, name, w: parseFloat(w) || 0 };
      });
  const parts = entries.filter((e) => e.w >= 0).map((e) => (e.name ? `${e.name} (${e.key}) — ${Number(e.w).toFixed(1)} kg` : `${e.key}: ${Number(e.w).toFixed(1)} kg`));
  const full = parts.length ? parts.join('; ') : '—';
  return { full, short: toShort(full) };
}

// Build receiver/sender strings from last FTRA archive row (for job list table)
function buildFtraReceiverStrings(lastRow) {
  if (!lastRow) return { full: '—', short: '—' };
  const binId = lastRow.receiver_bin_id ?? '—';
  const w = parseFloat(lastRow?.receiver_weight ?? 0) || 0;
  const full = `Receiver ${binId} — ${Number(w).toFixed(1)} kg`;
  return { full, short: toShort(full) };
}

function buildFtraSenderStrings(lastRow) {
  if (!lastRow) return { full: '—', short: '—' };
  return buildSclSenderStrings(lastRow);
}

// Get produced and consumed from archive rows for table columns (all report types)
function getProducedConsumedFromRows(rows, reportType) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return { produced: 0, consumed: 0 };

  if (reportType === 'MILL-A') {
    const firstRow = rows[0];
    const lastRow = rows[rows.length - 1];
    let firstBran = firstRow?.bran_receiver;
    let lastBran = lastRow?.bran_receiver;
    if (typeof firstBran === 'string') {
      try { firstBran = JSON.parse(firstBran || '{}'); } catch { firstBran = {}; }
    }
    if (typeof lastBran === 'string') {
      try { lastBran = JSON.parse(lastBran || '{}'); } catch { lastBran = {}; }
    }
    if (!firstBran || typeof firstBran !== 'object') firstBran = {};
    if (!lastBran || typeof lastBran !== 'object') lastBran = {};
    const getVal = (obj, key, altKeys = []) => {
      let v = obj[key];
      for (const alt of altKeys) {
        if (v != null && v !== '') break;
        v = obj[alt];
      }
      return parseFloat(v) || 0;
    };
    const getDelta = (key, altKeys = []) => getVal(lastBran, key, altKeys) - getVal(firstBran, key, altKeys);
    // Single record: use values directly (match backend behaviour); multiple: use delta
    const isSingle = rows.length === 1;
    const producedKeys = [
      ['Semolina (kg)', 'Semolina', '9103 Durum Semolina'],
      ['MILA_Flour1 (kg)', 'MILA_Flour1'],
      ['9105 Bran fine (kg)', '9105 Bran fine', 'Bran fine'],
      ['9106 Bran coarse (kg)', '9106 Bran coarse', 'Bran coarse'],
    ];
    const consumedKeys = ['B1Scale (kg)', 'B1Scale', 'B1 Scale', 'MILA_B1_scale (kg)'];
    let produced = 0;
    let consumed = 0;
    if (isSingle) {
      produced = producedKeys.reduce((s, [key, ...alts]) => s + getVal(lastBran, key, alts), 0);
      consumed = getVal(lastBran, consumedKeys[0], consumedKeys.slice(1));
    } else {
      produced = producedKeys.reduce((s, [key, ...alts]) => s + getDelta(key, alts), 0);
      consumed = getDelta(consumedKeys[0], consumedKeys.slice(1));
    }
    return { produced, consumed };
  }

  let produced = 0;
  let consumed = 0;
  rows.forEach((row) => {
    if (reportType === 'FCL') {
      produced += parseFloat(row.produced_weight) || 0;
      let bins = row.per_bin_weights;
      if (typeof bins === 'string') {
        try { bins = JSON.parse(bins || '[]'); } catch { bins = []; }
      }
      if (Array.isArray(bins)) {
        bins.forEach((e) => { consumed += parseFloat(e?.total_weight ?? e?.weight ?? 0) || 0; });
      } else if (bins && typeof bins === 'object') {
        Object.values(bins).forEach((w) => { consumed += parseFloat(w) || 0; });
      }
    } else if (reportType === 'SCL' || reportType === 'FTRA') {
      const rw = parseFloat(row.receiver ?? row.receiver_weight ?? 0) || 0;
      produced += rw;
      let bins = row.per_bin_weights;
      if (typeof bins === 'string') {
        try { bins = JSON.parse(bins || '[]'); } catch { bins = []; }
      }
      if (Array.isArray(bins)) {
        bins.forEach((e) => { consumed += parseFloat(e?.total_weight ?? e?.weight ?? 0) || 0; });
      } else if (bins && typeof bins === 'object') {
        Object.values(bins).forEach((w) => { consumed += parseFloat(w) || 0; });
      }
    }
  });
  return { produced, consumed };
}

// Build job list from archive: group by order_name, take last 100 orders (by max created_at)
function buildJobList(archiveData, reportType) {
  if (!archiveData || !Array.isArray(archiveData) || archiveData.length === 0) return [];
  const byOrder = {};
  archiveData.forEach((row) => {
    const name = (row.order_name || '').toString().trim();
    if (!name) return;
    const created = parseArchiveDate(row.created_at);
    if (!byOrder[name]) {
      byOrder[name] = { order_name: name, startDate: created, endDate: created, rows: [row] };
    } else {
      byOrder[name].rows.push(row);
      if (created) {
        if (!byOrder[name].startDate || created < byOrder[name].startDate) byOrder[name].startDate = created;
        if (!byOrder[name].endDate || created > byOrder[name].endDate) byOrder[name].endDate = created;
      }
    }
  });

  // Use real order_start_time / order_end_time from archive rows when available (falls back to created_at for old data)
  Object.values(byOrder).forEach((order) => {
    let realStart = null;
    let realEnd = null;
    order.rows.forEach((row) => {
      const st = row.order_start_time ? parseArchiveDate(row.order_start_time) : null;
      const et = row.order_end_time ? parseArchiveDate(row.order_end_time) : null;
      if (st && (!realStart || st < realStart)) realStart = st;
      if (et && (!realEnd || et > realEnd)) realEnd = et;
    });
    if (realStart) order.startDate = realStart;
    if (realEnd) order.endDate = realEnd;
  });

  const list = Object.values(byOrder)
    .sort((a, b) => (b.endDate && a.endDate ? b.endDate - a.endDate : 0))
    .slice(0, 100)
    .map((j) => {
      const lastRow = j.rows[j.rows.length - 1];
      const { produced, consumed } = getProducedConsumedFromRows(j.rows, reportType);
      const base = {
        order_name: j.order_name,
        startDate: j.startDate,
        endDate: j.endDate,
        produced,
        consumed,
      };
      if (reportType === 'MILL-A') {
        const { full, short } = buildMilaReceiverStrings(lastRow);
        return {
          ...base,
          receiverSummary: short,
          senderSummary: short,
          receiverFullText: full,
          senderFullText: full,
        };
      }
      if (reportType === 'FCL') {
        const rec = buildFclReceiverStrings(lastRow);
        const snd = buildFclSenderStrings(lastRow);
        const { startTotalizer, endTotalizer } = aggregateFclOrderTotalizers(j.rows);
        const producedFromTz = fclProducedFromTotalizers(startTotalizer, endTotalizer);
        return {
          ...base,
          produced: producedFromTz,
          startTotalizer,
          endTotalizer,
          receiverSummary: rec.short,
          senderSummary: snd.short,
          receiverFullText: rec.full,
          senderFullText: snd.full,
        };
      }
      if (reportType === 'SCL') {
        const rec = buildSclReceiverStrings(lastRow);
        const snd = buildSclSenderStrings(lastRow);
        return {
          ...base,
          receiverSummary: rec.short,
          senderSummary: snd.short,
          receiverFullText: rec.full,
          senderFullText: snd.full,
        };
      }
      if (reportType === 'FTRA') {
        const rec = buildFtraReceiverStrings(lastRow);
        const snd = buildFtraSenderStrings(lastRow);
        return {
          ...base,
          receiverSummary: rec.short,
          senderSummary: snd.short,
          receiverFullText: rec.full,
          senderFullText: snd.full,
        };
      }
      return {
        ...base,
        receiverSummary: '—',
        senderSummary: '—',
        receiverFullText: undefined,
        senderFullText: undefined,
      };
    });
  return list;
}

export default function JobLogs() {
  useLenisScroll();
  const [selectedReport, setSelectedReport] = useState('MILL-A');
  const [archiveData, setArchiveData] = useState([]);
  const [ordersList, setOrdersList] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [orderDateRange, setOrderDateRange] = useState({ startDate: null, endDate: null });
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [popoverJob, setPopoverJob] = useState(null);
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const [popoverContent, setPopoverContent] = useState(null);

  const archiveEndpoint = selectedReport === 'FCL' ? 'orders/archive/fcl/full'
    : selectedReport === 'SCL' ? 'orders/archive/scl/full'
    : selectedReport === 'MILL-A' ? 'orders/mila/archive/all'
    : 'orders/archive/ftra/full';

  useEffect(() => {
    setLoadingArchive(true);
    setSelectedOrder(null);
    setSummaryData(null);
    setPopoverJob(null);
    setPopoverAnchor(null);
    setPopoverPosition(null);
    setPopoverContent(null);
    const limit = selectedReport === 'MILL-A' ? 1500 : undefined;
    const params = limit ? { limit } : {};
    axios.get(archiveEndpoint, { params })
      .then((res) => {
        if (res.data?.status === 'success' && Array.isArray(res.data.data)) {
          setArchiveData(res.data.data);
          const list = buildJobList(res.data.data, selectedReport);
          setOrdersList(list);
          setSelectedOrder(list.length > 0 ? list[0] : null);
        } else {
          setArchiveData([]);
          setOrdersList([]);
          setSelectedOrder(null);
        }
      })
      .catch(() => {
        setArchiveData([]);
        setOrdersList([]);
        setSelectedOrder(null);
      })
      .finally(() => setLoadingArchive(false));
  }, [selectedReport, archiveEndpoint]);

  useEffect(() => {
    if (!selectedOrder?.order_name) {
      setSummaryData(null);
      return;
    }
    setLoadingSummary(true);
    let endpoint = '';
    if (selectedReport === 'MILL-A') endpoint = 'orders/analytics/mila/summary';
    else if (selectedReport === 'SCL') endpoint = 'orders/analytics/scl/summary';
    else if (selectedReport === 'FCL') endpoint = 'orders/analytics/fcl/summary';
    else if (selectedReport === 'FTRA') endpoint = 'orders/analytics/ftra/summary';
    if (!endpoint) {
      setLoadingSummary(false);
      return;
    }
    const params = { order_name: selectedOrder.order_name };
    const startD = selectedOrder.startDate;
    const endD = selectedOrder.endDate;
    const validStart = startD instanceof Date && !isNaN(startD.getTime());
    const validEnd = endD instanceof Date && !isNaN(endD.getTime());
    // Only send date range for MILL-A; FCL/SCL/FTRA use order's full range from backend (avoids "No records found in selected time range")
    if (selectedReport === 'MILL-A' && validStart && validEnd) {
      params.start_date = new Date(startD.getTime() - 2 * 60 * 1000).toISOString();
      params.end_date = endD.toISOString();
    }
    axios.get(endpoint, { params })
      .then((res) => {
          if (res.data?.status === 'success' && res.data.summary) {
          setSummaryData(res.data.summary);
          const s = res.data.summary;
          const summaryStart = s.start_time ? parseArchiveDate(String(s.start_time).replace(' ', 'T')) : null;
          const summaryEnd = s.end_time ? parseArchiveDate(String(s.end_time).replace(' ', 'T')) : null;
          if (!params.start_date && summaryStart && summaryEnd) {
            setOrderDateRange({
              startDate: summaryStart,
              endDate: summaryEnd,
            });
          } else if (validStart && validEnd) {
            setOrderDateRange({
              startDate: startD,
              endDate: endD,
            });
          } else {
            setOrderDateRange({ startDate: null, endDate: null });
          }
        } else {
          setSummaryData(res.data?.summary || { error: true, message: res.data?.message || 'No data' });
        }
      })
      .catch((err) => {
        setSummaryData({ error: true, message: err.response?.data?.message || err.message || 'Error fetching report' });
      })
      .finally(() => setLoadingSummary(false));
  }, [selectedReport, selectedOrder]);

  const closePopover = () => {
    setPopoverJob(null);
    setPopoverContent(null);
  };
  useEffect(() => {
    if (!popoverJob) return;
    const onKey = (e) => { if (e.key === 'Escape') closePopover(); };
    const onDocClick = (e) => {
      const el = e.target;
      if (popoverAnchor && !popoverAnchor.contains(el) && !el.closest?.('[data-job-logs-popover]')) closePopover();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocClick);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDocClick); };
  }, [popoverJob, popoverAnchor]);

  const formatDate = (d) => {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  };

  const reportPrintRef = useRef(null);
  const handlePrintReport = () => {
    if (!reportPrintRef.current) return;
    const prevTitle = document.title;
    document.title = `${getReportTypeDisplayName(selectedReport)} Report - ${selectedOrder?.order_name || 'Job Logs'}`;
    window.print();
    document.title = prevTitle;
  };

  // Print-only header (logos) – same layout as NewReport.jsx
  const PrintHeader = () => (
    <>
      <style>{`
        @media print {
          .job-logs-print-header {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 2px solid #d1d5db;
            page-break-inside: avoid;
          }
          .job-logs-print-header-left { flex: 0 0 auto; display: flex; align-items: center; gap: 1rem; }
          .job-logs-print-header-right { display: flex; align-items: center; gap: 1.5rem; flex: 0 0 auto; }
          .job-logs-print-logo { height: 3.5rem; max-width: 180px; object-fit: contain; }
          .job-logs-print-logo-right { height: 3rem; max-width: 120px; object-fit: contain; }
          .job-logs-print-date { font-size: 0.9rem; color: #374151; }
          .job-logs-print-v2 { font-weight: 700; font-size: 1rem; color: #111; }
        }
        @media screen {
          .job-logs-print-header { display: none !important; }
        }
      `}</style>
      <div className="job-logs-print-header">
        <div className="job-logs-print-header-left">
          <span className="job-logs-print-date">
            {new Date().toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
          </span>
          <img src={herculesLogo} alt="HERCULES" className="job-logs-print-logo" />
        </div>
        <div className="job-logs-print-header-right">
          <span className="job-logs-print-v2">HERCULES-V2</span>
          <img src={asmLogo} alt="ASM" className="job-logs-print-logo-right" />
          <img src={salalahLogo} alt="Salalah" className="job-logs-print-logo-right" />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 px-4 md:px-8 pt-2 pb-8">
      <style>{`
        @media print {
          .job-logs-no-print { display: none !important; }
          /* Ensure only the report card is visible and on top; avoid empty page from layout */
          body * { visibility: hidden; }
          .job-logs-report-print,
          .job-logs-report-print * { visibility: visible !important; }
          .job-logs-report-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: 1px solid #ccc !important;
            background: #fff !important;
            color: #000 !important;
            overflow: visible !important;
            min-height: auto !important;
          }
          /* Force readable colors in print (override dark mode) */
          .job-logs-report-print,
          .job-logs-report-print * { color: #111 !important; }
          .job-logs-report-print { background: #fff !important; }
          .job-logs-report-print * { background-color: transparent !important; }
          .job-logs-report-print thead th,
          .job-logs-report-print tr.bg-gray-100 { background: #f3f4f6 !important; }
          .job-logs-report-print table,
          .job-logs-report-print th,
          .job-logs-report-print td { border-color: #333 !important; }
          body { background: #fff !important; }
          .job-logs-screen-only { display: none !important; }
          .job-logs-print-only { display: block !important; }
        }
        @media screen {
          .job-logs-print-only { display: none !important; }
        }
      `}</style>
      <div className="job-logs-no-print bg-white dark:bg-zinc-800 rounded-2xl shadow-md border border-gray-200 dark:border-zinc-700 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
          <div className="flex flex-col w-full sm:w-48">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Report Type</label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-600 text-sm font-semibold bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
            >
              {REPORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Jobs table */}
      <div className="job-logs-no-print bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-700 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Jobs (last 100 orders)</h2>
        </div>
        <div className="overflow-x-auto max-h-[37.5vh] overflow-y-auto">
          {loadingArchive ? (
            <div className="p-8 text-center text-gray-500">Loading jobs…</div>
          ) : (
            <table className="w-full text-base">
              <thead className="bg-gray-100 dark:bg-zinc-700 sticky top-0">
                <tr>
                  <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">Ident</th>
                  <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">Start Date</th>
                  <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">End Date</th>
                  <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">{selectedReport === 'MILL-A' ? 'Bran Receiver' : 'Receiver'}</th>
                  <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">Sender</th>
                  <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">Produced</th>
                  {selectedReport === 'FCL' ? (
                    <>
                      <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">Start totalizer</th>
                      <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">End totalizer</th>
                    </>
                  ) : (
                    <th className="text-center px-3 py-2.5 border-b dark:border-zinc-600 font-semibold">Consumed</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {ordersList.map((job) => (
                  <tr
                    key={job.order_name}
                    onClick={() => setSelectedOrder(job)}
                    className={`border-b dark:border-zinc-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-zinc-600 ${selectedOrder?.order_name === job.order_name ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-center">{transformOrderNameForDisplay(job.order_name)}</td>
                    <td className="px-3 py-2.5 text-center">{formatDate(job.startDate)}</td>
                    <td className="px-3 py-2.5 text-center">{formatDate(job.endDate)}</td>
                    <td
                      className="px-3 py-2.5 text-center break-words whitespace-normal"
                      title={job.receiverFullText || undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (job.receiverFullText) {
                          const el = e.currentTarget;
                          setPopoverJob(job);
                          setPopoverAnchor(el);
                          setPopoverPosition(el.getBoundingClientRect());
                          setPopoverContent(job.receiverFullText);
                        }
                      }}
                    >
                      {job.receiverSummary || '—'}
                    </td>
                    <td
                      className="px-3 py-2.5 text-center break-words whitespace-normal"
                      title={job.senderFullText || undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (job.senderFullText) {
                          const el = e.currentTarget;
                          setPopoverJob(job);
                          setPopoverAnchor(el);
                          setPopoverPosition(el.getBoundingClientRect());
                          setPopoverContent(job.senderFullText);
                        }
                      }}
                    >
                      {job.senderSummary || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      {selectedReport === 'FCL' ? formatFclProducedKg(job.produced) : formatReportKg(job.produced)}
                    </td>
                    {selectedReport === 'FCL' ? (
                      <>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap" title="Start totalizer at order start">{formatFclTotalizerKg(job.startTotalizer)}</td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap" title="End totalizer at order end">{formatFclTotalizerKg(job.endTotalizer)}</td>
                      </>
                    ) : (
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">{formatReportKg(job.consumed)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loadingArchive && ordersList.length === 0 && (
            <div className="p-8 text-center text-gray-500">No orders found</div>
          )}
        </div>
        {popoverJob && popoverContent && popoverPosition && (
          <div
            data-job-logs-popover
            className="fixed z-50 max-w-sm rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-xl p-3 text-sm text-gray-800 dark:text-gray-100"
            style={{
              top: popoverPosition.bottom + 4,
              left: Math.min(popoverPosition.left, window.innerWidth - 320),
              maxWidth: 320,
            }}
          >
            <div className="whitespace-pre-wrap break-words">{popoverContent}</div>
          </div>
        )}
      </div>

      {/* Report section - UI like reference: job name + date, then PRODUCED/CONSUMED, then cards (no Status, no Active, no EFF) */}
      {selectedOrder && (
        <div ref={reportPrintRef} className="job-logs-report-print bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-700 p-4 md:p-8">
          <PrintHeader />
          {/* Screen: card layout */}
          <div className="job-logs-screen-only">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                  {transformOrderNameForDisplay(selectedOrder.order_name)}
                </h2>
                {selectedOrder.startDate && !isNaN(selectedOrder.startDate.getTime()) && (
                  <div className="text-base text-gray-600 dark:text-gray-400">
                    {formatDate(selectedOrder.startDate)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {summaryData && !loadingSummary && (() => {
                  const metrics = getProducedConsumedFromSummary(
                    summaryData,
                    selectedReport,
                    selectedReport === 'FCL' ? selectedOrder : null,
                  );
                  if (!metrics) return null;
                  if (selectedReport === 'FCL') {
                    return (
                      <>
                        <div className="rounded-xl bg-gray-50 dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 px-4 py-3 text-center min-w-[120px]">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-0.5">Produced</div>
                          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatFclProducedKg(metrics.produced)}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 px-4 py-3 text-center min-w-[120px]">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-0.5">Start totalizer</div>
                          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatFclTotalizerKg(metrics.fclStartTotalizer)}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 px-4 py-3 text-center min-w-[120px]">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-0.5">End totalizer</div>
                          <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatFclTotalizerKg(metrics.fclEndTotalizer)}</div>
                        </div>
                      </>
                    );
                  }
                  return (
                    <>
                      <div className="rounded-xl bg-gray-50 dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 px-4 py-3 text-center min-w-[120px]">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-0.5">Produced</div>
                        <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatReportKg(metrics.produced)}</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 px-4 py-3 text-center min-w-[120px]">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-0.5">Consumed</div>
                        <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{formatReportKg(metrics.consumed)}</div>
                      </div>
                    </>
                  );
                })()}
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="job-logs-no-print px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow transition"
                >
                  Print
                </button>
              </div>
            </div>
            {loadingSummary ? (
              <div className="text-center py-12 text-gray-500">Loading report…</div>
            ) : summaryData && selectedReport === 'MILL-A' ? (
              <MilaReportView summary={summaryData} selectedOrderName={selectedOrder.order_name} />
            ) : summaryData && (selectedReport === 'FCL' || selectedReport === 'SCL' || selectedReport === 'FTRA') ? (
              (() => {
                const fclMetrics =
                  selectedReport === 'FCL'
                    ? getProducedConsumedFromSummary(summaryData, 'FCL', selectedOrder)
                    : null;
                return (
                  <SummaryCardReportView
                    summary={summaryData}
                    reportType={selectedReport}
                    selectedOrderName={selectedOrder.order_name}
                    fclOutputBinKg={fclMetrics ? fclMetrics.produced : undefined}
                    fclStartTotalizer={fclMetrics ? fclMetrics.fclStartTotalizer : undefined}
                    fclEndTotalizer={fclMetrics ? fclMetrics.fclEndTotalizer : undefined}
                  />
                );
              })()
            ) : summaryData?.error ? (
              <div className="text-center py-8 text-gray-500">{summaryData.message || 'No data'}</div>
            ) : (
              <div className="text-center py-8 text-gray-500">No report data</div>
            )}
          </div>
          {/* Print only: NewReport-style table layout */}
          {summaryData && !summaryData.error && !loadingSummary && (
            <JobLogsPrintLayout
              summary={summaryData}
              reportType={selectedReport}
              orderName={selectedOrder.order_name}
              startDate={selectedOrder.startDate}
              endDate={selectedOrder.endDate}
              fclOrderRow={selectedReport === 'FCL' ? selectedOrder : null}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Reusable card for report sections (title + content); no icon, bold heading, larger body text
function ReportCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-zinc-700/50 rounded-xl border border-gray-300 dark:border-zinc-600 p-4 h-full shadow-sm">
      <div className="mb-3 pb-2 border-b border-gray-200 dark:border-zinc-600 bg-gray-100/80 dark:bg-zinc-600/50 rounded px-2 py-1.5">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="text-base text-gray-700 dark:text-gray-300">{children}</div>
    </div>
  );
}

// Format big number with commas for PRODUCED/CONSUMED
function formatReportKg(value) {
  const n = Math.abs(parseFloat(value) || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';
}

function formatFclTotalizerKg(value) {
  if (value == null || Number.isNaN(parseFloat(value))) return '—';
  return formatReportKg(value);
}

function formatFclProducedKg(value) {
  if (value == null || Number.isNaN(parseFloat(value))) return '—';
  return formatReportKg(value);
}

function formatFclReceiverRowWeightKg(row) {
  if (row.weight === null || row.weight === undefined || Number.isNaN(Number(row.weight))) return '—';
  if (row.fclReceiverShortLabel || row.id === 'Start totalizer' || row.id === 'End totalizer') {
    return formatReportKg(row.weight);
  }
  return `${Number(row.weight).toFixed(1)} kg`;
}

/** Single-line label for FCL receiver rows (card list) — totalizer rows: plain names only. */
function formatFclReceiverCardLabel(row) {
  if (row.fclReceiverShortLabel) return row.fclReceiverShortLabel;
  const loc = row.location ? ` (${row.location})` : '';
  return `${row.id} ${row.product || ''}${loc}`.replace(/\s+/g, ' ').trim();
}

// Get produced/consumed from summary for header (MILL-A vs FCL/SCL/FTRA)
function getProducedConsumedFromSummary(summary, reportType, fclOrderRow = null) {
  if (!summary || summary.error) return null;
  if (reportType === 'MILL-A') {
    const bt = summary.bran_receiver_totals || {};
    const produced =
      (bt['Semolina (kg)'] ?? bt['Semolina'] ?? bt['9103 Durum Semolina'] ?? 0) +
      (bt['MILA_Flour1 (kg)'] ?? bt['MILA_Flour1'] ?? 0) +
      (bt['9105 Bran fine (kg)'] ?? bt['9105 Bran fine'] ?? bt['Bran fine'] ?? 0) +
      (bt['9106 Bran coarse (kg)'] ?? bt['9106 Bran coarse'] ?? bt['Bran coarse'] ?? 0);
    const consumed = bt['B1Scale (kg)'] ?? bt['B1Scale'] ?? bt['B1 Scale'] ?? bt['MILA_B1_scale (kg)'] ?? 0;
    return { produced, consumed };
  }
  if (reportType === 'FCL' || reportType === 'SCL' || reportType === 'FTRA') {
    const senderTotal = Object.values(summary.per_bin_weight_totals || {}).reduce((s, w) => s + (parseFloat(w) || 0), 0);
    let receiverTotal = 0;
    if (reportType === 'FCL') {
      const { start, end } = mergeFclTotalizerSnapshot(summary, fclOrderRow);
      const delta = fclProducedFromTotalizers(start, end);
      return {
        produced: delta,
        consumed: senderTotal,
        fclStartTotalizer: start ?? null,
        fclEndTotalizer: end ?? null,
      };
    }
    const rw = summary.receiver_weight || {};
    receiverTotal = Object.values(rw).reduce((s, w) => s + (parseFloat(w) || 0), 0) || (summary.main_receiver_weight || 0);
    return { produced: receiverTotal, consumed: senderTotal };
  }
  return null;
}

// Print-only layout: same table design as NewReport.jsx (old layout)
function JobLogsPrintLayout({ summary, reportType, orderName, startDate, endDate, fclOrderRow = null }) {
  if (!summary || summary.error) return null;
  const removeUOM = (label) => (label ? label.replace(/\s*\(.*?\)\s*$/g, '').trim() : label);
  const formatDateRange = () => {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '';
    return `(${startDate.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} to ${endDate.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })})`;
  };
  const metrics = getProducedConsumedFromSummary(summary, reportType, fclOrderRow);
  const reportTitle = reportType === 'MILL-A' ? 'Mill-A' : reportType;
  const displayName = orderName ? String(orderName).replace(/MILA/gi, 'Mill-A') : reportTitle;

  if (reportType === 'MILL-A') {
    const { bran_receiver_totals = {}, average_yield_log = {}, average_setpoints_percentages = {}, average_yield_flows = {}, receiver_weight_totals = {} } = summary;
    const receiverRows = [];
    if (receiver_weight_totals) {
      Object.entries(receiver_weight_totals).forEach(([key, data]) => {
        let binId = null, materialName, weight = 0;
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          binId = data.bin_id != null ? data.bin_id : null;
          materialName = data.material_name || key;
          weight = data.weight_kg || 0;
        } else { materialName = key; weight = typeof data === 'number' ? data : 0; }
        receiverRows.push({ id: binId != null ? String(binId).padStart(2, '0') : key, name: removeUOM(materialName) || 'Flour Silo', weight });
      });
    }
    const semolinaWeight = bran_receiver_totals['Semolina (kg)'] ?? bran_receiver_totals['Semolina'] ?? 0;
    const milaFlour1Weight = bran_receiver_totals['MILA_Flour1 (kg)'] ?? bran_receiver_totals['MILA_Flour1'] ?? 0;
    const branFineWeight = bran_receiver_totals['9105 Bran fine (kg)'] ?? bran_receiver_totals['Bran fine'] ?? 0;
    const branCoarseWeight = bran_receiver_totals['9106 Bran coarse (kg)'] ?? bran_receiver_totals['Bran coarse'] ?? 0;
    const b1ScaleWeight = bran_receiver_totals['B1Scale (kg)'] ?? bran_receiver_totals['B1Scale'] ?? bran_receiver_totals['MILA_B1_scale (kg)'] ?? 0;
    const f2ScaleWeight = bran_receiver_totals['F2 Scale (kg)'] ?? bran_receiver_totals['F2 Scale'] ?? 0;
    const actualProducedWeight = semolinaWeight + milaFlour1Weight + branFineWeight + branCoarseWeight;
    const branReceiverRows = [
      { id: 'F1', weight: milaFlour1Weight },
      { id: 'F2', weight: f2ScaleWeight },
      { id: 'Bran coarse', weight: branCoarseWeight },
      { id: 'Bran fine', weight: branFineWeight },
      { id: 'semolina', weight: semolinaWeight },
      { id: 'Actual weight', weight: actualProducedWeight, isActualWeight: true },
    ];
    const mainScaleRow = { id: 'B1', weight: b1ScaleWeight };
    const yieldLogOrder = ['Yield Max Flow', 'Yield Min Flow', 'B1', 'F1', 'F2', 'Bran coarse', 'Bran fine', 'semolina'];
    const yieldLogMap = {};
    if (average_yield_flows) Object.entries(average_yield_flows).forEach(([key, value]) => {
      let displayKey = removeUOM(key);
      const numVal = parseFloat(value);
      yieldLogMap[displayKey] = { key: displayKey, value: (!isNaN(numVal) ? numVal.toFixed(3) : value) + (displayKey.toLowerCase().indexOf('flow') !== -1 ? ' kg/s' : ' kg') };
    });
    if (average_yield_log) Object.entries(average_yield_log).forEach(([key, value]) => {
      let displayKey = removeUOM(key);
      if (displayKey === 'MILA_B1') displayKey = 'B1';
      if (displayKey === 'MILA_Flour1') displayKey = 'F1';
      if (displayKey === 'MILA_BranCoarse') displayKey = 'Bran coarse';
      if (displayKey === 'MILA_BranFine') displayKey = 'Bran fine';
      if (displayKey === 'MILA_Semolina') displayKey = 'semolina';
      if (displayKey === 'flow_percentage') displayKey = 'F2';
      yieldLogMap[displayKey] = { key: displayKey, value: value + ' %' };
    });
    const yieldLogRows = [];
    yieldLogOrder.forEach((k) => { if (yieldLogMap[k]) yieldLogRows.push(yieldLogMap[k]); });
    Object.keys(yieldLogMap).forEach((k) => { if (!yieldLogOrder.includes(k)) yieldLogRows.push(yieldLogMap[k]); });
    const setpointsEntries = average_setpoints_percentages && Object.keys(average_setpoints_percentages).length > 0
      ? Object.entries(average_setpoints_percentages).filter(([key]) => !key.toLowerCase().includes('depot') && !key.toLowerCase().includes('flap') && !key.toLowerCase().includes('mila_2') && !key.toLowerCase().includes('b789we'))
      : [];

    return (
      <div className="job-logs-print-only">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <div>
            <div className="font-bold text-lg">{displayName} Report</div>
            <div className="text-gray-600 text-base">{formatDateRange()}</div>
          </div>
          {metrics && (
            <div className="text-right">
              <div className="font-semibold">Produced: <span>{Math.abs(Number(metrics.produced)).toFixed(1)} kg</span></div>
              <div className="font-semibold">Consumed: {Math.abs(Number(metrics.consumed)).toFixed(1)} kg</div>
            </div>
          )}
        </div>
        <div className="mb-6">
          <div className="font-semibold mb-2">Receiver</div>
          <table className="w-full border mb-1">
            <thead><tr className="bg-gray-100"><th className="border px-2 py-1">ID</th><th className="border px-2 py-1">Product name</th><th className="border px-2 py-1">Weight</th></tr></thead>
            <tbody>
              {receiverRows.map((row, i) => (
                <tr key={i}><td className="border px-2 py-1">{row.id}</td><td className="border px-2 py-1">{row.name}</td><td className="border px-2 py-1 text-right">{Math.abs(parseFloat(row.weight)).toFixed(1)} kg</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mb-6">
          <div className="font-semibold mb-2">Main Scale</div>
          <table className="w-full border mb-1">
            <thead><tr className="bg-gray-100"><th className="border px-2 py-1">ID</th><th className="border px-2 py-1">Weight</th></tr></thead>
            <tbody>
              <tr><td className="border px-2 py-1">{mainScaleRow.id}</td><td className="border px-2 py-1 text-right">{Math.abs(parseFloat(mainScaleRow.weight)).toFixed(1)} kg</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mb-6">
          <div className="font-semibold mb-2">Bran Receiver</div>
          <table className="w-full border mb-1">
            <thead><tr className="bg-gray-100"><th className="border px-2 py-1">ID</th><th className="border px-2 py-1">Weight</th></tr></thead>
            <tbody>
              {branReceiverRows.map((row, i) => (
                <tr key={i} className={row.isActualWeight ? 'font-semibold bg-zinc-100' : ''}><td className="border px-2 py-1">{row.id}</td><td className="border px-2 py-1 text-right">{Math.abs(parseFloat(row.weight)).toFixed(1)} kg</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mb-6">
          <div className="font-semibold mb-2">Yield</div>
          <table className="w-full border mb-1">
            <tbody>
              {yieldLogRows.map((row, i) => (
                <tr key={i}><td className="border px-2 py-1">{row.key}</td><td className="border px-2 py-1 text-right">{row.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mb-6">
          <div className="font-semibold mb-2">Setpoints</div>
          <table className="w-full border mb-1">
            <thead><tr className="bg-gray-100"><th className="border px-2 py-1">Parameter</th><th className="border px-2 py-1">Value</th></tr></thead>
            <tbody>
              {setpointsEntries.map(([key, value], i) => {
                const isBool = key.includes('Bool') || key.includes('Selected');
                return (
                  <tr key={i}>
                    <td className="border px-2 py-1">{removeUOM(key)}</td>
                    <td className="border px-2 py-1 text-right">{isBool ? <input type="checkbox" checked={!!value} readOnly className="w-4 h-4 cursor-default" /> : `${Number(value).toFixed(1)} %`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // FCL / SCL / FTRA
  const {
    material_summary = {},
    per_bin_weight_totals = {},
    receiver_weight = {},
    receiver_bin_id = null,
    receiver_material_name = null,
    main_receiver_weight = 0,
    record_count = 0,
    average_flow_rate = 0,
    average_moisture_setpoint = 0,
    average_moisture_offset = 0,
    cleaning_scale_bypass = false,
    total_water_consumed = 0,
    feeder_3_target = 0, feeder_3_selected = false,
    feeder_4_target = 0, feeder_4_selected = false,
    feeder_5_target = 0, feeder_5_selected = false,
    feeder_6_target = 0, feeder_6_selected = false,
    speed_discharge_50 = 0, speed_discharge_51_55 = 0,
    bag_collection = false, mixing_screw = false,
  } = summary;

  const minWeight = reportType === 'FTRA' ? 0 : 0.1;
  const senderRows = Object.entries(per_bin_weight_totals || {})
    .filter(([, w]) => (parseFloat(w) || 0) >= minWeight)
    .map(([binKey, weight]) => {
      const binNum = binKey.replace('bin_', '');
      let displayId = binNum;
      if (binNum === '211') displayId = '21A'; if (binNum === '212') displayId = '21B'; if (binNum === '213') displayId = '21C';
      return { id: displayId.padStart(4, '0'), product: material_summary[binKey] || 'N/A', weight: parseFloat(weight) || 0 };
    });
  let receiverRows = [];
  if (reportType === 'FCL') {
    let outputBinWeight = main_receiver_weight || 0;
    if (metrics && Object.prototype.hasOwnProperty.call(metrics, 'produced')) {
      if (metrics.produced === null) outputBinWeight = null;
      else if (Number.isFinite(Number(metrics.produced))) outputBinWeight = Number(metrics.produced);
    }
    receiverRows = buildFclReceiverDetailRows({
      receiverBinId: receiver_bin_id,
      receiverMaterialName: receiver_material_name,
      outputBinKg: outputBinWeight,
      startTotalizerKg: metrics?.fclStartTotalizer,
      endTotalizerKg: metrics?.fclEndTotalizer,
    });
  } else {
    const rbid = receiver_bin_id ? String(receiver_bin_id).padStart(4, '0') : '0000';
    receiverRows = Object.entries(receiver_weight || {}).length > 0
      ? Object.entries(receiver_weight).map(([mat, w]) => ({ id: rbid, product: mat, location: 'Output Bin', weight: w || 0 }))
      : [{ id: rbid, product: 'N/A', location: 'Output Bin', weight: 0 }];
  }
  const senderTotal = senderRows.reduce((s, r) => s + r.weight, 0);

  const setpointsList = [];
  if (reportType === 'FTRA') {
    setpointsList.push({ key: 'Bag Collection', isBoolean: true, boolValue: !!bag_collection });
    setpointsList.push({ key: 'Mixing Screw', isBoolean: true, boolValue: !!mixing_screw });
    setpointsList.push({ key: 'Feeder 3 Target %', value: `${Number(feeder_3_target).toFixed(1)} %` });
    setpointsList.push({ key: 'Feeder 3 Selected', isBoolean: true, boolValue: !!feeder_3_selected });
    setpointsList.push({ key: 'Feeder 4 Target %', value: `${Number(feeder_4_target).toFixed(1)} %` });
    setpointsList.push({ key: 'Feeder 4 Selected', isBoolean: true, boolValue: !!feeder_4_selected });
    setpointsList.push({ key: 'Feeder 5 Target %', value: `${Number(feeder_5_target).toFixed(1)} %` });
    setpointsList.push({ key: 'Feeder 5 Selected', isBoolean: true, boolValue: !!feeder_5_selected });
    setpointsList.push({ key: 'Feeder 6 Target %', value: `${Number(feeder_6_target).toFixed(1)} %` });
    setpointsList.push({ key: 'Feeder 6 Selected', isBoolean: true, boolValue: !!feeder_6_selected });
    setpointsList.push({ key: 'Speed Discharge 50 %', value: `${Number(speed_discharge_50).toFixed(1)} %` });
    setpointsList.push({ key: 'Speed Discharge 51-55 %', value: `${Number(speed_discharge_51_55).toFixed(1)} %` });
  } else {
    setpointsList.push({ key: 'Flowrate', value: `${Number(average_flow_rate).toFixed(1)}%` });
    setpointsList.push({ key: 'Moisture Setpoint', value: `${Number(average_moisture_setpoint).toFixed(1)}%` });
    setpointsList.push({ key: 'Moisture Offset', value: `${Number(average_moisture_offset).toFixed(1)}%` });
    setpointsList.push({ key: 'Cleaning Scale bypass', isBoolean: true, boolValue: !!cleaning_scale_bypass });
    if (reportType === 'FCL') setpointsList.push({ key: 'Water consumption', value: total_water_consumed != null ? `${Number(total_water_consumed).toFixed(1)} L` : 'N/A' });
  }

  return (
    <div className="job-logs-print-only">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
        <div>
          <div className="font-bold text-lg">{reportTitle} Daily Report</div>
          <div className="text-gray-600 text-base">{formatDateRange()}</div>
        </div>
        {metrics && (
          <div className="text-right">
            <div className="font-semibold">
              Produced:{' '}
              <span>
                {reportType === 'FCL' && (metrics.produced == null || Number.isNaN(parseFloat(metrics.produced)))
                  ? '—'
                  : `${Math.abs(Number(metrics.produced)).toFixed(1)} kg`}
              </span>
            </div>
            {reportType === 'FCL' ? (
              <>
                <div className="font-semibold">
                  Start totalizer:{' '}
                  {metrics.fclStartTotalizer != null && !Number.isNaN(parseFloat(metrics.fclStartTotalizer))
                    ? `${Math.abs(Number(metrics.fclStartTotalizer)).toFixed(1)} kg`
                    : '—'}
                </div>
                <div className="font-semibold">
                  End totalizer:{' '}
                  {metrics.fclEndTotalizer != null && !Number.isNaN(parseFloat(metrics.fclEndTotalizer))
                    ? `${Math.abs(Number(metrics.fclEndTotalizer)).toFixed(1)} kg`
                    : '—'}
                </div>
              </>
            ) : (
              <div className="font-semibold">Consumed: {Math.abs(Number(metrics.consumed)).toFixed(1)} kg</div>
            )}
          </div>
        )}
      </div>
      <div className="mb-6">
        <div className="font-semibold mb-2">Sender</div>
        <table className="w-full border mb-1">
          <thead><tr className="bg-gray-100"><th className="border px-2 py-1">ID</th><th className="border px-2 py-1">Product</th><th className="border px-2 py-1">Weight</th></tr></thead>
          <tbody>
            {senderRows.map((row, i) => (
              <tr key={i}><td className="border px-2 py-1">{row.id}</td><td className="border px-2 py-1">{row.product}</td><td className="border px-2 py-1 text-right">{Math.abs(row.weight).toFixed(1)} kg</td></tr>
            ))}
            <tr className="font-semibold bg-zinc-100"><td colSpan={2} className="border px-2 py-1 text-right">Actual weight</td><td className="border px-2 py-1 text-right">{senderTotal.toFixed(1)} kg</td></tr>
          </tbody>
        </table>
      </div>
      <div className="mb-6">
        <div className="font-semibold mb-2">Receiver</div>
        <table className="w-full border mb-1">
          <thead><tr className="bg-gray-100"><th className="border px-2 py-1">ID</th><th className="border px-2 py-1">Product</th><th className="border px-2 py-1">Location</th><th className="border px-2 py-1">Weight</th></tr></thead>
          <tbody>
            {receiverRows.map((row, i) => (
              <tr key={i}>
                {reportType === 'FCL' && row.fclReceiverShortLabel ? (
                  <>
                    <td className="border px-2 py-1" colSpan={3}>{row.fclReceiverShortLabel}</td>
                    <td className="border px-2 py-1 text-right">{formatFclReceiverRowWeightKg(row)}</td>
                  </>
                ) : (
                  <>
                    <td className="border px-2 py-1">{row.id}</td>
                    <td className="border px-2 py-1">{row.product}</td>
                    <td className="border px-2 py-1">{row.location}</td>
                    <td className="border px-2 py-1 text-right">
                      {reportType === 'FCL' ? formatFclReceiverRowWeightKg(row) : (row.weight === null ? '—' : `${Math.abs(parseFloat(row.weight)).toFixed(1)} kg`)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-6">
        <div className="font-semibold mb-2">Setpoints</div>
        <table className="w-full border mb-1">
          <thead><tr className="bg-gray-100"><th className="border px-2 py-1">Parameter</th><th className="border px-2 py-1">Value</th></tr></thead>
          <tbody>
            {setpointsList.map((item, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{item.key}</td>
                <td className="border px-2 py-1 text-right">{item.isBoolean ? <input type="checkbox" checked={!!item.boolValue} readOnly className="w-4 h-4 cursor-default" /> : item.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500">Records: {record_count || 0}</div>
    </div>
  );
}

// MIL-A report view – card layout like reference image (no Status, no Active, no EFF)
function MilaReportView({ summary, selectedOrderName }) {
  if (!summary) return null;
  if (summary.error) {
    return (
      <div className="text-center py-8 text-gray-500">
        {summary.message || (selectedOrderName ? 'No data for this order.' : 'No data')}
      </div>
    );
  }
  const removeUOM = (label) => (label ? label.replace(/\s*\(.*?\)\s*$/g, '').trim() : label);
  const {
    bran_receiver_totals = {},
    average_yield_log = {},
    average_setpoints_percentages = {},
    average_yield_flows = {},
    receiver_weight_totals = {},
  } = summary;

  const receiverRows = [];
  if (receiver_weight_totals) {
    Object.entries(receiver_weight_totals).forEach(([key, data]) => {
      let binId = null, materialName, weight = 0;
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        binId = data.bin_id != null ? data.bin_id : null;
        materialName = data.material_name || key;
        weight = data.weight_kg || 0;
      } else {
        materialName = key;
        weight = typeof data === 'number' ? data : 0;
      }
      const displayId = binId != null ? String(binId).padStart(2, '0') : key;
      receiverRows.push({ id: displayId, name: removeUOM(materialName) || 'Flour Silo', weight });
    });
  }

  const semolinaWeight = bran_receiver_totals['Semolina (kg)'] ?? bran_receiver_totals['Semolina'] ?? bran_receiver_totals['9103 Durum Semolina'] ?? 0;
  const milaFlour1Weight = bran_receiver_totals['MILA_Flour1 (kg)'] ?? bran_receiver_totals['MILA_Flour1'] ?? 0;
  const branFineWeight = bran_receiver_totals['9105 Bran fine (kg)'] ?? bran_receiver_totals['9105 Bran fine'] ?? bran_receiver_totals['Bran fine'] ?? 0;
  const branCoarseWeight = bran_receiver_totals['9106 Bran coarse (kg)'] ?? bran_receiver_totals['9106 Bran coarse'] ?? bran_receiver_totals['Bran coarse'] ?? 0;
  const b1ScaleWeight = bran_receiver_totals['B1Scale (kg)'] ?? bran_receiver_totals['B1Scale'] ?? bran_receiver_totals['B1 Scale'] ?? bran_receiver_totals['MILA_B1_scale (kg)'] ?? 0;
  const f2ScaleWeight = bran_receiver_totals['F2 Scale (kg)'] ?? bran_receiver_totals['F2 Scale'] ?? 0;
  const actualProducedWeight = semolinaWeight + milaFlour1Weight + branFineWeight + branCoarseWeight;
  const branReceiverRows = [
    { id: 'F1', weight: milaFlour1Weight },
    { id: 'F2', weight: f2ScaleWeight },
    { id: 'Bran coarse', weight: branCoarseWeight },
    { id: 'Bran fine', weight: branFineWeight },
    { id: 'semolina', weight: semolinaWeight },
    { id: 'Actual weight', weight: actualProducedWeight, isActualWeight: true },
  ];
  const mainScaleRow = { id: 'B1', weight: b1ScaleWeight };

  const yieldLogOrder = ['Yield Max Flow', 'Yield Min Flow', 'B1', 'F1', 'F2', 'Bran coarse', 'Bran fine', 'semolina'];
  const yieldLogMap = {};
  if (average_yield_flows) {
    Object.entries(average_yield_flows).forEach(([key, value]) => {
      let displayKey = removeUOM(key);
      const numVal = parseFloat(value);
      const uom = displayKey.toLowerCase().indexOf('flow') !== -1 ? 'kg/s' : 'kg';
      yieldLogMap[displayKey] = { key: displayKey, value: (!isNaN(numVal) ? numVal.toFixed(3) : value) + ' ' + uom };
    });
  }
  if (average_yield_log) {
    Object.entries(average_yield_log).forEach(([key, value]) => {
      let displayKey = removeUOM(key);
      if (displayKey === 'MILA_B1') displayKey = 'B1';
      if (displayKey === 'MILA_Flour1') displayKey = 'F1';
      if (displayKey === 'MILA_BranCoarse') displayKey = 'Bran coarse';
      if (displayKey === 'MILA_BranFine') displayKey = 'Bran fine';
      if (displayKey === 'MILA_Semolina') displayKey = 'semolina';
      if (displayKey === 'flow_percentage') displayKey = 'F2';
      yieldLogMap[displayKey] = { key: displayKey, value: value + ' %' };
    });
  }
  const yieldLogRows = [];
  yieldLogOrder.forEach((k) => { if (yieldLogMap[k]) yieldLogRows.push(yieldLogMap[k]); });
  Object.keys(yieldLogMap).forEach((k) => { if (!yieldLogOrder.includes(k)) yieldLogRows.push(yieldLogMap[k]); });

  const setpointsEntries = average_setpoints_percentages && Object.keys(average_setpoints_percentages).length > 0
    ? Object.entries(average_setpoints_percentages).filter(([key]) => !key.toLowerCase().includes('depot') && !key.toLowerCase().includes('flap') && !key.toLowerCase().includes('mila_2') && !key.toLowerCase().includes('b789we'))
    : [];

  return (
    <div className="rounded-xl">
      <div className="grid grid-cols-5 gap-4">
        <ReportCard title="Receiver">
          <ul className="space-y-1">
            {receiverRows.map((row, i) => (
              <li key={i} className="flex justify-between">
                <span>{row.id} {row.name}</span>
                <span>{Math.abs(parseFloat(row.weight)).toFixed(1)} kg</span>
              </li>
            ))}
            {receiverRows.length === 0 && <li className="text-gray-500">—</li>}
          </ul>
        </ReportCard>
        <ReportCard title="Main Scale">
          <ul className="space-y-1">
            <li className="flex justify-between">
              <span>{mainScaleRow.id}</span>
              <span>{Math.abs(parseFloat(mainScaleRow.weight)).toFixed(1)} kg</span>
            </li>
          </ul>
        </ReportCard>
        <ReportCard title="Bran Receiver">
          <ul className="space-y-1">
            {branReceiverRows.map((row, i) => (
              <li key={i} className={`flex justify-between ${row.isActualWeight ? 'font-semibold' : ''}`}>
                <span>{row.id}</span>
                <span>{Math.abs(parseFloat(row.weight)).toFixed(1)} kg</span>
              </li>
            ))}
          </ul>
        </ReportCard>
        <ReportCard title="Yield">
          <ul className="space-y-1">
            {yieldLogRows.map((row, i) => (
              <li key={i} className="flex justify-between">
                <span>{row.key}</span>
                <span>{row.value}</span>
              </li>
            ))}
            {yieldLogRows.length === 0 && <li className="text-gray-500">—</li>}
          </ul>
        </ReportCard>
        <ReportCard title="Setpoints">
          <ul className="space-y-1">
            {setpointsEntries.map(([key, value], i) => {
              const isBool = key.includes('Bool') || key.includes('Selected');
              return (
                <li key={i} className="flex justify-between items-center">
                  <span>{removeUOM(key)}</span>
                  {isBool ? (
                    <input type="checkbox" checked={!!value} readOnly className="w-4 h-4 cursor-default rounded border-gray-400" />
                  ) : (
                    <span>{`${Number(value).toFixed(1)} %`}</span>
                  )}
                </li>
              );
            })}
            {setpointsEntries.length === 0 && <li className="text-gray-500">—</li>}
          </ul>
        </ReportCard>
      </div>
    </div>
  );
}

// FCL/SCL/FTRA summary card report view (simplified; full version matches Orders SummaryCardLayout)
function SummaryCardReportView({
  summary,
  reportType,
  selectedOrderName,
  fclOutputBinKg,
  fclStartTotalizer,
  fclEndTotalizer,
}) {
  if (!summary) return null;
  if (summary.error) {
    return (
      <div className="text-center py-8 text-gray-500">
        {summary.message || (selectedOrderName ? 'No data for this order.' : 'No data')}
      </div>
    );
  }
  const {
    total_produced_weight = 0,
    material_summary = {},
    per_bin_weight_totals = {},
    receiver_weight = {},
    receiver_bin_id = null,
    receiver_material_name = null,
    main_receiver_weight = 0,
    record_count = 0,
    average_flow_rate = 0,
    average_moisture_setpoint = 0,
    average_moisture_offset = 0,
    cleaning_scale_bypass = false,
    total_water_consumed = 0,
    feeder_3_target = 0,
    feeder_3_selected = false,
    feeder_4_target = 0,
    feeder_4_selected = false,
    feeder_5_target = 0,
    feeder_5_selected = false,
    feeder_6_target = 0,
    feeder_6_selected = false,
    speed_discharge_50 = 0,
    speed_discharge_51_55 = 0,
    bag_collection = false,
    mixing_screw = false,
  } = summary;

  const minWeight = reportType === 'FTRA' ? 0 : 0.1;
  const senderRows = Object.entries(per_bin_weight_totals || {})
    .filter(([, w]) => (parseFloat(w) || 0) >= minWeight)
    .map(([binKey, weight]) => {
      const binNum = binKey.replace('bin_', '');
      let displayId = binNum;
      if (binNum === '211') displayId = '21A';
      if (binNum === '212') displayId = '21B';
      if (binNum === '213') displayId = '21C';
      return {
        id: displayId.padStart(4, '0'),
        product: material_summary[binKey] || 'N/A',
        weight: parseFloat(weight) || 0,
      };
    });

  let receiverRows = [];
  if (reportType === 'FCL') {
    let outputBinWeight = main_receiver_weight || 0;
    if (fclOutputBinKg !== undefined) {
      outputBinWeight = fclOutputBinKg === null ? null : Number(fclOutputBinKg);
    }
    const startTz = fclStartTotalizer !== undefined ? fclStartTotalizer : summary.fcl_2_520we_at_order_start;
    const endTz = fclEndTotalizer !== undefined ? fclEndTotalizer : summary.fcl_2_520we_at_order_end;
    receiverRows = buildFclReceiverDetailRows({
      receiverBinId: receiver_bin_id,
      receiverMaterialName: receiver_material_name,
      outputBinKg: outputBinWeight,
      startTotalizerKg: startTz,
      endTotalizerKg: endTz,
    });
  } else {
    const rbid = receiver_bin_id ? String(receiver_bin_id).padStart(4, '0') : '0000';
    receiverRows = Object.entries(receiver_weight || {}).length > 0
      ? Object.entries(receiver_weight).map(([mat, w]) => ({ id: rbid, product: mat, location: 'Output Bin', weight: w || 0 }))
      : [{ id: rbid, product: 'N/A', location: 'Output Bin', weight: 0 }];
  }

  const senderTotal = senderRows.reduce((s, r) => s + r.weight, 0);
  const receiverTotal = receiverRows.reduce(
    (s, r) => s + (r.weight === null || r.weight === undefined || Number.isNaN(Number(r.weight)) ? 0 : Number(r.weight)),
    0,
  );

  const setpointsList = [];
  if (reportType === 'FTRA') {
    setpointsList.push({ key: 'Bag Collection', value: bag_collection ? 'Yes' : 'No', isBoolean: true, boolValue: !!bag_collection });
    setpointsList.push({ key: 'Mixing Screw', value: mixing_screw ? 'Yes' : 'No', isBoolean: true, boolValue: !!mixing_screw });
    setpointsList.push({ key: 'Feeder 3 Target %', value: `${Number(feeder_3_target).toFixed(1)} %` });
    setpointsList.push({ key: 'Feeder 3 Selected', value: feeder_3_selected ? 'Yes' : 'No', isBoolean: true, boolValue: !!feeder_3_selected });
    setpointsList.push({ key: 'Feeder 4 Target %', value: `${Number(feeder_4_target).toFixed(1)} %` });
    setpointsList.push({ key: 'Feeder 4 Selected', value: feeder_4_selected ? 'Yes' : 'No', isBoolean: true, boolValue: !!feeder_4_selected });
    setpointsList.push({ key: 'Feeder 5 Target %', value: `${Number(feeder_5_target).toFixed(1)} %` });
    setpointsList.push({ key: 'Feeder 5 Selected', value: feeder_5_selected ? 'Yes' : 'No', isBoolean: true, boolValue: !!feeder_5_selected });
    setpointsList.push({ key: 'Feeder 6 Target %', value: `${Number(feeder_6_target).toFixed(1)} %` });
    setpointsList.push({ key: 'Feeder 6 Selected', value: feeder_6_selected ? 'Yes' : 'No', isBoolean: true, boolValue: !!feeder_6_selected });
    setpointsList.push({ key: 'Speed Discharge 50 %', value: `${Number(speed_discharge_50).toFixed(1)} %` });
    setpointsList.push({ key: 'Speed Discharge 51-55 %', value: `${Number(speed_discharge_51_55).toFixed(1)} %` });
  } else {
    setpointsList.push({ key: 'Flowrate', value: `${Number(average_flow_rate).toFixed(1)}%` });
    setpointsList.push({ key: 'Moisture Setpoint', value: `${Number(average_moisture_setpoint).toFixed(1)}%` });
    setpointsList.push({ key: 'Moisture Offset', value: `${Number(average_moisture_offset).toFixed(1)}%` });
    setpointsList.push({ key: 'Cleaning Scale bypass', value: cleaning_scale_bypass ? 'Yes' : 'No', isBoolean: true, boolValue: !!cleaning_scale_bypass });
    if (reportType === 'FCL') setpointsList.push({ key: 'Water consumption', value: total_water_consumed != null ? `${Number(total_water_consumed).toFixed(1)} L` : 'N/A' });
  }

  return (
    <div className="rounded-xl">
      <div className="grid grid-cols-3 gap-4">
        <ReportCard title="Sender">
          <ul className="space-y-1">
            {senderRows.map((row, i) => (
              <li key={i} className="flex justify-between">
                <span>{row.id} {row.product}</span>
                <span>{row.weight.toFixed(1)} kg</span>
              </li>
            ))}
            <li className="flex justify-between font-semibold border-t border-gray-200 dark:border-zinc-600 pt-2 mt-2">
              <span>Actual weight</span>
              <span>{senderTotal.toFixed(1)} kg</span>
            </li>
            {senderRows.length === 0 && <li className="text-gray-500">—</li>}
          </ul>
        </ReportCard>
        <ReportCard title="Receiver">
          <ul className="space-y-1">
            {receiverRows.map((row, i) => (
              <li key={i} className="flex justify-between">
                <span>{reportType === 'FCL' ? formatFclReceiverCardLabel(row) : `${row.id} ${row.product} ${row.location ? `(${row.location})` : ''}`}</span>
                <span>
                  {reportType === 'FCL' ? formatFclReceiverRowWeightKg(row) : (
                    row.weight === null || row.weight === undefined || Number.isNaN(Number(row.weight))
                      ? '—'
                      : `${Number(row.weight).toFixed(1)} kg`
                  )}
                </span>
              </li>
            ))}
            {receiverRows.length === 0 && <li className="text-gray-500">—</li>}
          </ul>
        </ReportCard>
        <ReportCard title="Setpoints">
          <ul className="space-y-1">
            {setpointsList.map((item, i) => (
              <li key={i} className="flex justify-between items-center">
                <span>{item.key}</span>
                {item.isBoolean ? (
                  <input type="checkbox" checked={!!item.boolValue} readOnly className="w-4 h-4 cursor-default rounded border-gray-400" />
                ) : (
                  <span>{item.value}</span>
                )}
              </li>
            ))}
            {setpointsList.length === 0 && <li className="text-gray-500">—</li>}
          </ul>
        </ReportCard>
      </div>
      <div className="mt-4 text-base text-gray-500 dark:text-gray-400">Records: {record_count || 0}</div>
    </div>
  );
}

