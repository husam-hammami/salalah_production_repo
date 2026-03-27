import React, { useState, useEffect } from "react";
import axios from '../API/axios';
import { useLenisScroll } from '../Hooks/useLenisScroll.js'; // ✅ Add this
import herculesLogo from "../Assets/herculeslogo.png";
import salalahLogo from "../Assets/salalah_logo.png";
import asmLogo from "../Assets/Asm_Logo.png";

const REPORT_OPTIONS = [
  { value: 'FCL', label: 'FCL' },
  { value: 'SCL', label: 'SCL' },
  { value: 'MILL-A', label: 'Mill-A' },
  { value: 'FTRA', label: 'FTRA' },
];

// Helper function to transform order names: MILA -> Mill-A
const transformOrderNameForDisplay = (orderName) => {
  if (!orderName) return orderName;
  return orderName.toString().replace(/MILA/gi, 'Mill-A');
};

// Helper function to get report type display name
const getReportTypeDisplayName = (reportType) => {
  if (reportType === 'MILL-A') return 'Mill-A';
  return reportType;
};

const Orders = () => {
  useLenisScroll(); // ✅ Add this
  const [selectedReport, setSelectedReport] = useState('FCL');
  const [selectedOrderName, setSelectedOrderName] = useState('');
  const [availableOrderNames, setAvailableOrderNames] = useState([]);
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [milaSummaryData, setMilaSummaryData] = useState(null);
  const [sclSummaryData, setSclSummaryData] = useState(null);
  const [fclSummaryData, setFclSummaryData] = useState(null);
  const [ftraSummaryData, setFtraSummaryData] = useState(null);
  const [orderDateRange, setOrderDateRange] = useState({
    startDate: null,
    endDate: null,
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Helper to get local ISO string for datetime-local input (YYYY-MM-DDTHH:MM)
  const toLocalISOString = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Archive created_at: DB stores Dubai time (no TZ). Parse so summary API gets correct range.
  const DUBAI_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;
  const parseCreatedAtAsDubai = (dateStr) => {
    if (!dateStr) return null;
    const s = String(dateStr).trim().replace(' ', 'T');
    // If backend sent UTC (Z or GMT), use as-is so we send correct UTC to summary API
    if (/Z$|GMT$|\+\d{2}:?\d{2}$/i.test(s) || s.includes('GMT')) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
    if (!m) {
      const fallback = new Date(dateStr);
      return isNaN(fallback.getTime()) ? null : fallback;
    }
    const [, y, mo, d, h, min, sec, ms] = m;
    const msVal = ms ? parseInt(ms.slice(0, 3).padEnd(3, '0'), 10) : 0;
    const utcMs = Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10), parseInt(h, 10), parseInt(min, 10), parseInt(sec, 10) || 0, msVal) - DUBAI_UTC_OFFSET_MS;
    const date = new Date(utcMs);
    return isNaN(date.getTime()) ? null : date;
  };
  // Try Dubai parsing first, then any parseable date (for RFC 1123 / other server formats)
  const parseDateForRange = (dateStr) => {
    if (!dateStr) return null;
    const d = parseCreatedAtAsDubai(dateStr);
    if (d) return d;
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  };

  // Function to calculate date range from filtered data (use Dubai parsing so summary range is correct)
  const calculateDateRange = (data) => {
    if (!data || data.length === 0) {
      setOrderDateRange({ startDate: null, endDate: null });
      return;
    }

    const dates = data
      .map(item => {
        const dateField = item.created_at || item.start_time || item.end_time || item.date || item.timestamp;
        if (dateField) {
          const date = parseCreatedAtAsDubai(dateField);
          return date;
        }
        return null;
      })
      .filter(date => date !== null);

    if (dates.length === 0) {
      setOrderDateRange({ startDate: null, endDate: null });
      return;
    }

    const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

    setOrderDateRange({ startDate, endDate });
  };

  // Reusable summary card layout for SCL and FCL
  function SummaryCardLayout({ summary, reportType, consumedOverride }) {
    if (!summary) return <div>No summary data available</div>;

    // ✅ Handle empty/error: show order context when an order is selected but has 0 data
    if (summary.error) {
      const message = summary.message || (selectedOrderName
        ? 'No data for this order in the selected time range.'
        : 'No data available');
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              {selectedOrderName ? 'No data in selected period' : 'No records found'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              {message}
            </div>
            <div className="text-xs text-gray-500 mt-2">Records: 0</div>
          </div>
        </div>
      );
    }

    const {
      total_produced_weight = 0,
      average_flow_rate = 0,
      average_moisture_setpoint = 0,
      average_moisture_offset = 0,
      cleaning_scale_bypass = false, // ✅ New field
      material_summary = {},
      per_bin_weight_totals = {},
      receiver_weight = {},
      receiver_bin_id = null,  // ✅ Get actual receiver bin ID from backend (SCL/FCL/FTRA)
      receiver_material_name = null,  // ✅ Get receiver material name (FCL)
      total_receiver_weight = 0,
      main_receiver_weight = 0,  // ✅ Main receiver weight (bin 028, 030, etc.) - FCL only
      fcl_2_520we_weight = 0,  // ✅ Get FCL_2_520WE separately - FCL only
      fcl_2_520we_last_value = 0, // ✅ Absolute last value for FCL_2_520WE row
      record_count = 0,
      total_water_consumed = 0,  // ✅ FCL: sum of water (L) from archive
      // ✅ FTRA-specific fields
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

    const [materialName] = Object.entries(material_summary)[0] || [null];

    let senderRows, receiverRows, receiverActualWeight;
    if (reportType === 'FCL') {
      senderRows = Object.entries(per_bin_weight_totals)
        .filter(([binKey, weight]) => {
          // Filter out bins with zero or very small weights (< 0.1 kg)
          const weightValue = parseFloat(weight) || 0;
          return weightValue >= 0.1;
        })
        .map(([binKey, weight]) => {
          const binNum = binKey.replace('bin_', '');
          
          // ✅ FCL Bin Mapping (211->21A, 212->21B, 213->21C)
          let displayId = binNum;
          if (binNum === '211') displayId = '21A';
          if (binNum === '212') displayId = '21B';
          if (binNum === '213') displayId = '21C';
          
          // ✅ Get material name from material_summary
          const productName = material_summary[binKey] || "N/A";
          return {
            id: displayId.padStart(4, '0'),
            product: productName,
            weight: weight || 0
          };
        });
      
      // ✅ For FCL: Build receiver rows
      // Order: Bin 0028/Dest (FIRST), then FCL_2_520WE
      receiverRows = [];
      
      // Row 1: Main receiver bin (028, 030, etc.)
      // ✅ Use fcl_2_520we_weight (Delta) for this row as "Produced" weight
      const receiverBinDisplay = receiver_bin_id ? String(receiver_bin_id).padStart(4, "0") : "0028";
      const receiverProductName = receiver_material_name || "N/A";
      
      receiverRows.push({
        id: receiverBinDisplay,
        product: receiverProductName,
        location: "Output Bin",
        weight: main_receiver_weight || 0, // ✅ Delta (end - start)
      });

      // Row 2: FCL_2_520WE (Cumulative Counter - last absolute value)
      // Always show FCL_2_520WE for FCL reports
      receiverRows.push({
        id: "FCL_2_520WE",
        product: "FCL 2_520WE",
        location: "Cumulative Counter",
        weight: fcl_2_520we_weight || 0, // ✅ Last cumulative counter value
      });
      
      receiverActualWeight = main_receiver_weight; // ✅ Use delta for actual weight 
    } else if (reportType === 'FTRA') {
      // ✅ FTRA: Sender rows with material names from material_summary (similar to SCL)
      senderRows = Object.entries(per_bin_weight_totals)
        .filter(([binKey, weight]) => {
          // Filter out bins with zero or very small weights (< 0.1 kg)
          const weightValue = parseFloat(weight) || 0;
          return weightValue >= 0.1;
        })
        .map(([binKey, weight]) => {
          const binNum = binKey.replace("bin_", "");
          // ✅ Get material name from material_summary
          const productName = material_summary[binKey] || "N/A";
          return {
            id: binNum.padStart(4, "0"),
            product: productName,
            weight: weight || 0,
          };
        });
      
      // ✅ FTRA: Receiver rows - similar to SCL
      const receiverBinDisplay = receiver_bin_id ? String(receiver_bin_id).padStart(4, "0") : "0000";
      receiverRows =
        Object.entries(receiver_weight).length > 0
          ? Object.entries(receiver_weight).map(
            ([materialName, weight]) => ({
              id: receiverBinDisplay,
              product: materialName,
              location: "Output Bin",
              weight: weight || 0,
            })
          )
          : [
            {
              id: receiverBinDisplay,
              product: "N/A",
              location: "Output Bin",
              weight: 0,
            },
          ];
      receiverActualWeight = receiverRows.reduce(
        (sum, row) => sum + (row.weight || 0),
        0
      );
    } else {
      // ✅ SCL: Sender rows with material names from material_summary
      senderRows = Object.entries(per_bin_weight_totals)
        .filter(([binKey, weight]) => {
          // Filter out bins with zero or very small weights (< 0.1 kg)
          const weightValue = parseFloat(weight) || 0;
          return weightValue >= 0.1;
        })
        .map(([binKey, weight]) => {
          const binNum = binKey.replace("bin_", "");
          // ✅ Get material name from material_summary
          const productName = material_summary[binKey] || "N/A";
          return {
            id: binNum.padStart(4, "0"),
            product: productName,
            weight: weight || 0,
          };
        });
      
      // ✅ SCL: Receiver rows - keys are material names, not bin IDs
      const receiverBinDisplay = receiver_bin_id ? String(receiver_bin_id).padStart(4, "0") : "0031";
      receiverRows =
        Object.entries(receiver_weight).length > 0
          ? Object.entries(receiver_weight).map(
            ([materialName, weight]) => ({
              id: receiverBinDisplay, // ✅ Use actual receiver bin ID from backend
              product: materialName, // Use actual material name from backend
              location: "Output Bin",
              weight: weight || 0,
            })
          )
          : [
            {
              id: receiverBinDisplay,
              product: "N/A",
              location: "Output Bin",
              weight: 0,
            },
          ];
      receiverActualWeight = receiverRows.reduce(
        (sum, row) => sum + (row.weight || 0),
        0
      );
    }

    const senderActualWeight = senderRows.reduce((sum, row) => sum + (row.weight || 0), 0);
    // FCL: Produced = Output Bin delta; Consumed = Sender actual weight. SCL/FTRA: produced = receiver sum, consumed = sender sum.
    const producedWeight = reportType === "FCL"
      ? receiverActualWeight  // FCL: Output Bin delta (e.g. 46376.0 kg)
      : receiverActualWeight;
    const consumedWeight = senderActualWeight;  // Consumed = sender actual weight (all report types)

    return (
      <div className="bg-white dark:bg-[#232c3d] rounded-2xl p-6 w-full px-4 md:px-10 xl:px-20 mx-auto mt-4 mb-8 border border-gray-300 dark:border-gray-700 dark:text-gray-100" style={{ boxSizing: 'border-box' }}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <div></div>
          <div className="text-right">
            <div className="font-semibold">Produced: <span>{Number(producedWeight).toFixed(1)} kg</span></div>
            <div className="font-semibold">Consumed: {Number(consumedWeight).toFixed(1)} kg</div>
          </div>
        </div>

        {/* Sender Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Sender</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">ID</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Product</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Weight</th>
              </tr>
            </thead>
            <tbody>
              {senderRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.id}</td>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.product}</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{parseFloat(row.weight).toFixed(1)} kg</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="border px-2 py-1 font-semibold text-right dark:border-gray-700 dark:text-gray-100">Actual weight</td>
                <td className="border px-2 py-1 font-semibold text-right dark:border-gray-700 dark:text-gray-100">{Number(senderActualWeight).toFixed(1)} kg</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Receiver Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Receiver</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">ID</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Product</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Location</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Weight</th>
              </tr>
            </thead>
            <tbody>
              {receiverRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.id}</td>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.product}</td>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.location}</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{parseFloat(row.weight).toFixed(1)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Setpoints Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Setpoints</div>
          {reportType === 'FTRA' ? (
            // ✅ FTRA Setpoints with grouped headings
            <table className="w-full border mb-1">
              <thead>
                <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                  <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Identification</th>
                  <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
                </tr>
              </thead>
              <tbody>
                {/* Filter Flour Destination */}
                <tr>
                  <td className="pt-4 pb-1 font-semibold text-blue-600 dark:text-blue-400 border px-2 py-1 dark:border-gray-700" colSpan="2">Filter Flour Destination</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Bag Collection</td>
                  <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                    <input type="checkbox" checked={!!bag_collection} readOnly className="w-4 h-4 cursor-default" />
                  </td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Mixing Screw</td>
                  <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                    <input type="checkbox" checked={!!mixing_screw} readOnly className="w-4 h-4 cursor-default" />
                  </td>
                </tr>
                {/* Micro Ingredient 1 */}
                <tr>
                  <td className="pt-4 pb-1 font-semibold text-blue-600 dark:text-blue-400 border px-2 py-1 dark:border-gray-700" colSpan="2">Micro Ingredient 1</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Feeder 3 Target %</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(feeder_3_target).toFixed(1)} %</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Feeder 3 Selected</td>
                  <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                    <input type="checkbox" checked={!!feeder_3_selected} readOnly className="w-4 h-4 cursor-default" />
                  </td>
                </tr>
                {/* Micro Ingredient 2 */}
                <tr>
                  <td className="pt-4 pb-1 font-semibold text-blue-600 dark:text-blue-400 border px-2 py-1 dark:border-gray-700" colSpan="2">Micro Ingredient 2</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Feeder 4 Target %</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(feeder_4_target).toFixed(1)} %</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Feeder 4 Selected</td>
                  <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                    <input type="checkbox" checked={!!feeder_4_selected} readOnly className="w-4 h-4 cursor-default" />
                  </td>
                </tr>
                {/* Micro Ingredient 3 */}
                <tr>
                  <td className="pt-4 pb-1 font-semibold text-blue-600 dark:text-blue-400 border px-2 py-1 dark:border-gray-700" colSpan="2">Micro Ingredient 3</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Feeder 5 Target %</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(feeder_5_target).toFixed(1)} %</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Feeder 5 Selected</td>
                  <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                    <input type="checkbox" checked={!!feeder_5_selected} readOnly className="w-4 h-4 cursor-default" />
                  </td>
                </tr>
                {/* Micro Ingredient 4 */}
                <tr>
                  <td className="pt-4 pb-1 font-semibold text-blue-600 dark:text-blue-400 border px-2 py-1 dark:border-gray-700" colSpan="2">Micro Ingredient 4</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Feeder 6 Target %</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(feeder_6_target).toFixed(1)} %</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Feeder 6 Selected</td>
                  <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                    <input type="checkbox" checked={!!feeder_6_selected} readOnly className="w-4 h-4 cursor-default" />
                  </td>
                </tr>
                {/* Discharger Speed */}
                <tr>
                  <td className="pt-4 pb-1 font-semibold text-blue-600 dark:text-blue-400 border px-2 py-1 dark:border-gray-700" colSpan="2">Discharger Speed</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Speed Discharge 50 %</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(speed_discharge_50).toFixed(1)} %</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 pl-4 dark:border-gray-700 dark:text-gray-100">Speed Discharge 51-55 %</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(speed_discharge_51_55).toFixed(1)} %</td>
                </tr>
              </tbody>
            </table>
          ) : (
            // ✅ FCL/SCL Setpoints
            <table className="w-full border mb-1">
              <thead>
                <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                  <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Parameter</th>
                  <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Flowrate</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(average_flow_rate).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Moisture Setpoint</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(average_moisture_setpoint).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Moisture Offset</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(average_moisture_offset).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Cleaning Scale bypass</td>
                  <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                    <input
                      type="checkbox"
                      checked={!!cleaning_scale_bypass}
                      readOnly
                      className="w-4 h-4 cursor-default"
                    />
                  </td>
                </tr>
                {reportType === 'FCL' && (
                  <tr>
                    <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Water consumption</td>
                    <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                      {total_water_consumed != null ? `${Number(total_water_consumed).toFixed(1)} L` : 'N/A'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Records footer */}
        <div className="text-xs text-gray-500">Records: {record_count || 0}</div>
      </div>
    );
  }

  function MilaSummaryLayout({ summary }) {
    if (!summary) return <div>No summary data available</div>;

    // ✅ Helper function to remove UOM from labels
    const removeUOM = (label) => {
      if (!label) return label;
      // Remove (kg), (kg/h), (kg/s), (%), (Bool), etc.
      return label.replace(/\s*\(.*?\)\s*$/g, '').trim();
    };

    // ✅ Handle empty/error: show order context when an order is selected but has 0 data
    if (summary.error) {
      const message = selectedOrderName
        ? (summary.message || 'No data for this order in the selected time range.')
        : (summary.message || 'No data available');
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              {selectedOrderName ? 'No data in selected period' : 'No records found'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              {message}
            </div>
            <div className="text-xs text-gray-500 mt-2">Records: 0</div>
          </div>
        </div>
      );
    }

    const {
      total_produced_weight,
      bran_receiver_totals,
      average_yield_log,
      average_setpoints_percentages,
      average_yield_flows,
      receiver_weight_totals,
    } = summary;

    // Build Receiver rows from receiver_weight_totals; backend sends F1 weight for first receiver, F2 for second
    const receiverRows = [];
    if (receiver_weight_totals) {
      Object.entries(receiver_weight_totals).forEach(([key, data]) => {
        let binId = null;
        let materialName, weight;

        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          binId = data.bin_id != null ? data.bin_id : null;
          materialName = data.material_name || key;
          weight = data.weight_kg || 0;  // use per-row weight: first = F1, second = F2
        } else {
          materialName = key;
          weight = typeof data === 'number' ? data : 0;
        }

        const cleanName = removeUOM(materialName);
        const displayId = binId != null ? String(binId).padStart(2, '0') : key;

        receiverRows.push({
          id: displayId,
          name: cleanName || 'Flour Silo',
          weight,  // bin 50 = F1 weight, bin 55 = F2 weight (from backend)
        });
      });
    }

    // ✅ Build branReceiverRows
    const branReceiverRows = [];
    
    // Extract weights from bran_receiver_totals
    let semolinaWeight = 0;
    let milaFlour1Weight = 0;
    let branFineWeight = 0;
    let branCoarseWeight = 0;
    let b1ScaleWeight = 0;
    
    if (bran_receiver_totals) {
      semolinaWeight = bran_receiver_totals['Semolina (kg)'] || 
                       bran_receiver_totals['Semolina'] || 
                       bran_receiver_totals['9103 Durum Semolina'] || 0;
      
      milaFlour1Weight = bran_receiver_totals['MILA_Flour1 (kg)'] || 
                         bran_receiver_totals['MILA_Flour1'] || 0;
      
      branFineWeight = bran_receiver_totals['9105 Bran fine (kg)'] || 
                       bran_receiver_totals['9105 Bran fine'] || 
                       bran_receiver_totals['Bran fine'] || 0;
      
      branCoarseWeight = bran_receiver_totals['9106 Bran coarse (kg)'] || 
                         bran_receiver_totals['9106 Bran coarse'] || 
                         bran_receiver_totals['Bran coarse'] || 0;
      
      b1ScaleWeight = bran_receiver_totals['B1Scale (kg)'] || 
                      bran_receiver_totals['B1Scale'] || 
                      bran_receiver_totals['B1 Scale'] || 
                      bran_receiver_totals['MILA_B1_scale (kg)'] || 0;
    }
    
    // F2 Scale (kg) - from archive bran_receiver_totals
    const f2ScaleWeight = (bran_receiver_totals && (bran_receiver_totals['F2 Scale (kg)'] ?? bran_receiver_totals['F2 Scale'])) || 0;
    
    // Main Scale row (B1 - shown in separate table)
    const mainScaleRow = { id: 'B1', weight: b1ScaleWeight };
    
    // Bran Receiver rows (without B1): F1, F2, Bran coarse, Bran fine, semolina
    branReceiverRows.push({ id: 'F1', weight: milaFlour1Weight });
    branReceiverRows.push({ id: 'F2', weight: f2ScaleWeight });
    branReceiverRows.push({ id: 'Bran coarse', weight: branCoarseWeight });
    branReceiverRows.push({ id: 'Bran fine', weight: branFineWeight });
    branReceiverRows.push({ id: 'semolina', weight: semolinaWeight });
    
    const actualProducedWeight = semolinaWeight + milaFlour1Weight + branFineWeight + branCoarseWeight;
    branReceiverRows.push({
      id: 'Actual weight',
      weight: actualProducedWeight,
      isActualWeight: true
    });

    const displayProducedWeight = actualProducedWeight;
    const calculatedConsumedWeight = b1ScaleWeight;

    // ✅ Build yield log rows with proper order matching Bran Receiver
    const yieldLogRows = [];
    
    // Define the desired order for yield log items (include F2 from F2 scale)
    const yieldLogOrder = ['Yield Max Flow', 'Yield Min Flow', 'B1', 'F1', 'F2', 'Bran coarse', 'Bran fine', 'semolina'];
    
    // Build a map of display key -> row object
    const yieldLogMap = {};
    
    if (average_yield_flows) {
      Object.entries(average_yield_flows).forEach(([key, value]) => {
          let displayKey = removeUOM(key);
          const numVal = parseFloat(value);
          
          // ✅ FORCE kg/s for flow items
          let uom = "kg";
          if (displayKey.toLowerCase().indexOf("flow") !== -1) {
             uom = "kg/s";
          }
          
          let displayValue = !isNaN(numVal) ? numVal.toFixed(3) + " " + uom : value + " " + uom;
          yieldLogMap[displayKey] = { key: displayKey, value: displayValue };
      });
    }
    if (average_yield_log) {
      Object.entries(average_yield_log).forEach(([key, value]) => {
          let displayKey = removeUOM(key);
          
          // ✅ Rename keys as requested
          if (displayKey === 'MILA_B1') displayKey = 'B1';
          if (displayKey === 'MILA_Flour1') displayKey = 'F1';
          if (displayKey === 'MILA_BranCoarse') displayKey = 'Bran coarse';
          if (displayKey === 'MILA_BranFine') displayKey = 'Bran fine';
          if (displayKey === 'MILA_Semolina') displayKey = 'semolina';
          if (displayKey === 'flow_percentage') displayKey = 'F2';
          
          yieldLogMap[displayKey] = { key: displayKey, value: value + " %" };
      });
    }
    
    // ✅ Sort yield log rows according to defined order
    yieldLogOrder.forEach(orderedKey => {
      if (yieldLogMap[orderedKey]) {
        yieldLogRows.push(yieldLogMap[orderedKey]);
      }
    });
    
    // Add any remaining items that weren't in the order (fallback)
    Object.keys(yieldLogMap).forEach(key => {
      if (!yieldLogOrder.includes(key)) {
        yieldLogRows.push(yieldLogMap[key]);
      }
    });

    return (
      <div className="bg-white dark:bg-[#1a2233] rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <div>
            <div className="font-bold text-lg mb-1">Line Running</div>
            <div className="text-blue-700 font-semibold">MIL-A</div>
            <div className="text-gray-500">Status: Running</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">Produced: <span>{Math.abs(displayProducedWeight || 0).toFixed(1)} kg</span></div>
            <div className="font-semibold">Consumed: {Math.abs(calculatedConsumedWeight || 0).toFixed(1)} kg</div>
          </div>
        </div>
        {/* Receiver Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Receiver</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Identific Product ident</th>
                <th className="border px-2 py-1">Product name</th>
                <th className="border px-2 py-1">Weight</th>
              </tr>
            </thead>
            <tbody>
              {receiverRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{row.id}</td>
                  <td className="border px-2 py-1">{row.name}</td>
                  <td className="border px-2 py-1 text-right">{Math.abs(parseFloat(row.weight)).toFixed(1)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Main Scale Section (B1) */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Main Scale</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Identific Product ident</th>
                <th className="border px-2 py-1">Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">{mainScaleRow.id}</td>
                <td className="border px-2 py-1 text-right">{Math.abs(parseFloat(mainScaleRow.weight)).toFixed(1)} kg</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Bran Receiver Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Bran Receiver</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Identific Product ident</th>
                <th className="border px-2 py-1">Weight</th>
              </tr>
            </thead>
            <tbody>
              {branReceiverRows.map((row, i) => (
                <tr key={i} className={row.isActualWeight ? 'font-semibold bg-zinc-100 dark:bg-zinc-700' : ''}>
                  <td className="border px-2 py-1">{row.id}</td>
                  <td className="border px-2 py-1 text-right">{Math.abs(parseFloat(row.weight)).toFixed(1)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Yield Log Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Yield Log</div>
          <table className="w-full border mb-1">
            <tbody>
              {yieldLogRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{row.key}</td>
                  <td className="border px-2 py-1 text-right">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Setpoints Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Setpoints</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">Identification</th>
                <th className="border px-2 py-1 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {average_setpoints_percentages && Object.entries(average_setpoints_percentages)
                .filter(([key]) => {
                  const lowerKey = key.toLowerCase();
                  if (lowerKey.indexOf('depot') !== -1) return false;
                  if (lowerKey.indexOf('flap') !== -1) return false;
                  if (lowerKey.indexOf('mila_2') !== -1) return false;
                  if (lowerKey.indexOf('b789we') !== -1) return false;
                  return true;
                })
                .map(([key, value], i) => {
                  let displayKey = key.replace(/Feeder/g, 'Microd feeder');
                  displayKey = removeUOM(displayKey);
                  const isBooleanField = key.includes('Bool') || key.includes('Enabled') || key.includes('Selected');
                  const isPercentageField = key.includes('%') || key.includes('Target');
                  const isTonPerHour = key.includes('t/h');
                  
                  return (
                  <tr key={i}>
                      <td className="border px-2 py-1">{displayKey}</td>
                    <td className="border px-2 py-1 text-right">
                      {isBooleanField ? (
                        <div className="flex justify-end">
                          <input type="checkbox" checked={value === true || value === 1 || value === '1' || value === 'true'} readOnly className="w-4 h-4 cursor-default" />
                        </div>
                      ) : isTonPerHour ? (
                        `${Number(value).toFixed(1)} t/h`
                      ) : (
                        isPercentageField ? `${Number(value).toFixed(1)} %` : value
                      )}
                    </td>
                  </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Print Header Component
  const PrintHeader = () => (
    <>
      <style>{`
        @media print {
          .print-header {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #d1d5db;
            page-break-inside: avoid;
          }
          .print-header-left {
            flex: 0 0 auto;
          }
          .print-header-right {
            display: flex;
            align-items: center;
            gap: 2rem;
            flex: 0 0 auto;
          }
          .print-logo {
            height: 4rem;
            max-width: 200px;
            object-fit: contain;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
          .print-logo-right {
            height: 3.5rem;
            max-width: 150px;
            object-fit: contain;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
        }
        @media screen {
          .print-header {
            display: none !important;
          }
        }
      `}</style>
      <div className="print-header">
        <div className="print-header-left">
          <img src={herculesLogo} alt="Hercules Logo" className="print-logo" />
        </div>
        <div className="print-header-right">
          <img src={asmLogo} alt="ASM Logo" className="print-logo-right" />
          <img src={salalahLogo} alt="Salalah Logo" className="print-logo-right" />
        </div>
      </div>
    </>
  );

  const renderTable = () => {
    if (!selectedOrderName) {
      return (
        <div className="text-center py-8 text-gray-500">
          Please select an order name to view the report
        </div>
      );
    }

    if (loading) {
      return (
        <div className="text-center py-8 text-gray-500">
          Loading...
        </div>
      );
    }

    // Show summary cards for all report types, just like NewReport page
    if (selectedReport === 'MILL-A' && milaSummaryData) {
      return <MilaSummaryLayout summary={milaSummaryData} />;
    }

    if (selectedReport === 'SCL' && sclSummaryData) {
      return <SummaryCardLayout summary={sclSummaryData} reportType="SCL" />;
    }

    if (selectedReport === 'FCL' && fclSummaryData) {
      return <SummaryCardLayout summary={fclSummaryData} reportType="FCL" consumedOverride={fclSummaryData.total_receiver_weight} />;
    }

    if (selectedReport === 'FTRA' && ftraSummaryData) {
      return <SummaryCardLayout summary={ftraSummaryData} reportType="FTRA" />;
    }

    // If no summary data available, show message
    return (
      <div className="text-center py-8 text-gray-500">
        {selectedOrderName ? `No summary data found for order: ${selectedOrderName}` : 'No data available'}
      </div>
    );
  };

  // 🔄 Fetch Summary Data from Backend
  // Only send start_date/end_date when the user has explicitly set both date inputs.
  // When dates are empty we send only order_name so the backend uses full order range (MIN/MAX created_at).
  useEffect(() => {
    if (!selectedOrderName) {
      setMilaSummaryData(null);
      setSclSummaryData(null);
      setFclSummaryData(null);
      setFtraSummaryData(null);
      return;
    }

    const fetchSummary = async () => {
      setLoading(true);
      const userSetBothDates = startDate && endDate && String(startDate).trim() !== '' && String(endDate).trim() !== '';
      let start = null;
      let end = null;
      if (userSetBothDates) {
        start = new Date(startDate);
        end = new Date(endDate);
      }
      const hasRange = userSetBothDates && start && end && !isNaN(start.getTime()) && !isNaN(end.getTime());
      const startForApi = hasRange ? new Date(start.getTime() - 2 * 60 * 1000) : null;

      try {
        let endpoint = '';
        if (selectedReport === 'MILL-A') endpoint = 'orders/analytics/mila/summary';
        else if (selectedReport === 'SCL') endpoint = 'orders/analytics/scl/summary';
        else if (selectedReport === 'FCL') endpoint = 'orders/analytics/fcl/summary';
        else if (selectedReport === 'FTRA') endpoint = 'orders/analytics/ftra/summary';

        if (endpoint) {
          const params = { order_name: selectedOrderName };
          if (hasRange) {
            params.start_date = startForApi.toISOString();
            params.end_date = end.toISOString();
          }
          console.log(`Fetching summary for ${selectedReport} (${selectedOrderName})`, hasRange ? { start, end } : 'full order range');
          const response = await axios.get(endpoint, { params });

          if (response.data && response.data.status === 'success' && response.data.summary) {
             const summary = response.data.summary;
             if (selectedReport === 'MILL-A') setMilaSummaryData(summary);
             else if (selectedReport === 'SCL') setSclSummaryData(summary);
             else if (selectedReport === 'FCL') setFclSummaryData(summary);
             else if (selectedReport === 'FTRA') setFtraSummaryData(summary);
             // Update Order Period: from user range when dates set, else from summary (full order range)
             if (hasRange && start && end) {
               setOrderDateRange({ startDate: start, endDate: end });
             } else if (!hasRange && summary && !summary.error && (summary.start_time || summary.end_time)) {
               const startTime = summary.start_time ? new Date(summary.start_time) : null;
               const endTime = summary.end_time ? new Date(summary.end_time) : null;
               if (startTime && endTime && !isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
                 setOrderDateRange({ startDate: startTime, endDate: endTime });
               }
             }
          } else {
             const errorData = { error: true, message: response.data?.message || 'No data returned from server' };
             if (selectedReport === 'MILL-A') setMilaSummaryData(errorData);
             else if (selectedReport === 'SCL') setSclSummaryData(errorData);
             else if (selectedReport === 'FCL') setFclSummaryData(errorData);
             else if (selectedReport === 'FTRA') setFtraSummaryData(errorData);
          }
        }
      } catch (error) {
        console.error('Error fetching summary:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Error fetching data';
        const errorData = { error: true, message: errorMessage };
        
         if (selectedReport === 'MILL-A') setMilaSummaryData(errorData);
         else if (selectedReport === 'SCL') setSclSummaryData(errorData);
         else if (selectedReport === 'FCL') setFclSummaryData(errorData);
         else if (selectedReport === 'FTRA') setFtraSummaryData(errorData);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [selectedReport, selectedOrderName, allData, startDate, endDate]);

  // Fetch ALL archive data when report type changes (to get list of orders)
  useEffect(() => {
    // Clear all data immediately when report type changes
    setAllData([]);
    setFilteredData([]);
    setAvailableOrderNames([]);
    setSelectedOrderName('');
    setMilaSummaryData(null);
    setSclSummaryData(null);
    setFclSummaryData(null);
    setFtraSummaryData(null);
    
    const fetchData = async () => {
      setLoading(true);
      let endpoint = '';
      if (selectedReport === 'FCL') endpoint = 'orders/archive/fcl/full';
      else if (selectedReport === 'SCL') endpoint = 'orders/archive/scl/full';
      else if (selectedReport === 'MILL-A') endpoint = 'orders/mila/archive/all';
      else if (selectedReport === 'FTRA') endpoint = 'orders/archive/ftra/full';
      
      if (!endpoint) {
        console.warn(`[Orders] No endpoint defined for report type: ${selectedReport}`);
        setLoading(false);
        return;
      }
      
      const hasDateRange = startDate && endDate;
      const params = hasDateRange
        ? { start_date: new Date(startDate).toISOString(), end_date: new Date(endDate).toISOString() }
        : {};
      
      try {
        console.log(`[Orders] Fetching archive data for ${selectedReport} from ${endpoint}`, hasDateRange ? '(date range)' : '(last 100)');
        const response = await axios.get(endpoint, { params });
        if (response.data && response.data.status === 'success' && Array.isArray(response.data.data)) {
          console.log(`[Orders] Received ${response.data.data.length} records for ${selectedReport}`);
          setAllData(response.data.data);
          setFilteredData(response.data.data);
        } else {
          console.warn(`[Orders] Invalid response format for ${selectedReport}:`, response.data);
          setAllData([]);
          setFilteredData([]);
          setAvailableOrderNames([]);
        }
      } catch (error) {
        console.error(`[Orders] Error fetching ${selectedReport} archive data:`, error);
        setAllData([]);
        setFilteredData([]);
        setAvailableOrderNames([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedReport, startDate, endDate]);

  // Derive available order names based on selected date range (and loaded data)
  useEffect(() => {
    if (!allData || allData.length === 0) {
      setAvailableOrderNames([]);
      setSelectedOrderName('');
      return;
    }

    let candidates = [...allData];

    // Apply date range filter to determine which orders are available
    if (startDate || endDate) {
      // Parse datetime-local format directly (YYYY-MM-DDTHH:MM)
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      console.log('[Order Filter] Date range:', {
        startDate,
        endDate,
        startParsed: start?.toLocaleString(),
        endParsed: end?.toLocaleString(),
        totalRecords: allData.length
      });

      candidates = candidates.filter((item) => {
        let dateField =
          item.created_at ||
          item.start_time ||
          item.end_time ||
          item.date ||
          item.timestamp;

        if (!dateField) return false;

        // Handle SQL date format (YYYY-MM-DD HH:MM:SS) by replacing space with T
        if (typeof dateField === 'string' && dateField.includes(' ') && !dateField.includes('T')) {
          dateField = dateField.replace(' ', 'T');
        }

        const itemDate = new Date(dateField);
        if (isNaN(itemDate.getTime())) return false;

        let isAfterStart = true;
        let isBeforeEnd = true;

        if (start && !isNaN(start.getTime())) {
          isAfterStart = itemDate >= start;
        }

        if (end && !isNaN(end.getTime())) {
          isBeforeEnd = itemDate <= end;
        }

        return isAfterStart && isBeforeEnd;
      });

      console.log('[Order Filter] Filtered records:', candidates.length);
    }

    // Build unique order names: for MILL-A (and others) show latest-first in dropdown
    const getCreatedAt = (item) => {
      const dateField = item.created_at || item.start_time || item.end_time || item.date || item.timestamp;
      if (!dateField) return 0;
      const s = typeof dateField === 'string' && dateField.includes(' ') && !dateField.includes('T')
        ? dateField.replace(' ', 'T') : dateField;
      const d = new Date(s);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    const sortedByNewest = [...candidates].sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
    const seen = new Set();
    const uniqueOrderNames = sortedByNewest
      .map((item) => item.order_name)
      .filter((name) => {
        if (!name || name.toString().trim() === '') return false;
        const key = name.toString().trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    setAvailableOrderNames(uniqueOrderNames);

    // Ensure currently selected order is within this filtered list
    if (uniqueOrderNames.length === 0) {
      setSelectedOrderName('');
      return;
    }

    const hasSelectedInList = uniqueOrderNames.some((name) => {
      const n = name.toString().trim().toLowerCase();
      const sel = (selectedOrderName || '').toString().trim().toLowerCase();
      return n === sel;
    });

    if (!hasSelectedInList) {
      // Auto-select first order in range
      setSelectedOrderName(uniqueOrderNames[0]);
    }
  }, [allData, startDate, endDate]);

  // Filter data for selected order name and date range
  useEffect(() => {
    if (!allData || allData.length === 0) {
      setFilteredData([]);
      return;
    }

    let filtered = allData;

    // Filter by order name if selected
    if (selectedOrderName) {
      filtered = filtered.filter((item) => {
        const itemOrderName = (item.order_name || "").toString().trim();
        const selectedOrderNameTrimmed = selectedOrderName.toString().trim();
        return (
          itemOrderName.toLowerCase() ===
          selectedOrderNameTrimmed.toLowerCase()
        );
      });
    }

    // Filter by start/end date-time if provided
    if (startDate || endDate) {
      // Parse datetime-local format directly (YYYY-MM-DDTHH:MM)
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      filtered = filtered.filter((item) => {
        let dateField =
          item.created_at ||
          item.start_time ||
          item.end_time ||
          item.date ||
          item.timestamp;

        if (!dateField) return false;

        // Handle SQL date format (YYYY-MM-DD HH:MM:SS) by replacing space with T
        if (typeof dateField === 'string' && dateField.includes(' ') && !dateField.includes('T')) {
          dateField = dateField.replace(' ', 'T');
        }

        const itemDate = new Date(dateField);
        if (isNaN(itemDate.getTime())) return false;

        let isAfterStart = true;
        let isBeforeEnd = true;

        if (start) {
          isAfterStart = itemDate >= start;
        }
        if (end) {
          isBeforeEnd = itemDate <= end;
        }

        return isAfterStart && isBeforeEnd;
      });
    }

    setFilteredData(filtered);
    // Calculate date range for the filtered data (for display AND for fetching summary)
    calculateDateRange(filtered);
  }, [selectedOrderName, allData, startDate, endDate]);

  // Reset selected order name and set default date filters when report type changes
  // On report type change: clear order selection and date range. Do NOT set default start/end
  // so that initial load and report switch fetch "last 100" orders; user can optionally set
  // Start/End Date & Time to filter by time range.
  useEffect(() => {
    setSelectedOrderName("");
    setOrderDateRange({ startDate: null, endDate: null });
    setStartDate("");
    setEndDate("");
  }, [selectedReport]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4 md:px-8 pt-2 pb-8">
      {/* Filter bar: order, dates, report type */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
          {/* Order name dropdown */}
          <div className="flex flex-col flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              Order Name
            </label>
            <select
              value={selectedOrderName}
              onChange={(e) => setSelectedOrderName(e.target.value)}
              className="px-3 py-2 rounded-md border border-gray-300 text-sm font-semibold bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={availableOrderNames.length === 0}
            >
              <option value="">Select Order Name</option>
              {availableOrderNames.map((orderName) => (
                <option key={orderName} value={orderName}>
                  {transformOrderNameForDisplay(orderName)}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date & Time */}
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              Start Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* End Date & Time */}
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              End Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* Report type dropdown */}
          <div className="flex flex-col w-full md:w-48">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              Report Type
            </label>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="px-3 py-2 rounded-md border border-gray-300 text-sm font-semibold bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {REPORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {/* Print Button */}
      {selectedOrderName && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 print:hidden"
          >
            Print
          </button>
        </div>
      )}
      {/* Responsive Table Container */}
      <div id="report-print-section" className="w-full bg-white rounded-2xl shadow-lg p-4 md:p-8 overflow-x-auto min-h-[calc(100vh-120px)] ml-0 mt-4 mr-0" style={{ boxSizing: 'border-box' }}>
        {/* Print Header with Logos */}
        <PrintHeader />

        {/* Order name display for print and screen */}
        {selectedOrderName && (
          <div className="mb-4 text-center">
            <div className="font-semibold text-lg mb-2">
              {getReportTypeDisplayName(selectedReport)} Report - Order: {transformOrderNameForDisplay(selectedOrderName)}
            </div>
            {orderDateRange.startDate && orderDateRange.endDate && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Order Period:</span> {orderDateRange.startDate.toLocaleDateString()} - {orderDateRange.endDate.toLocaleDateString()}
              </div>
            )}
          </div>
        )}
        {renderTable()}
      </div>
    </div>
  );
};

export default Orders;
