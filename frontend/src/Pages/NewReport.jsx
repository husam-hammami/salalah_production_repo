// import React, { useState, useEffect } from "react";
// import axios from '../API/axios';
// import { useLenisScroll } from '../Hooks/useLenisScroll.js'; // ✅ Add this

// const REPORT_OPTIONS = [
//   { value: 'FCL', label: 'FCL' },
//   { value: 'SCL', label: 'SCL' },
//   { value: 'MIL-A', label: 'MILA' },
// ];
// const PERIOD_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'Full Report'];

// const getPeriodRange = (period, dateInput) => {

//   if (!dateInput) return { start: null, end: null };
//   const start = new Date(dateInput);
//   let end;
//   if (period === 'Daily') {
//     end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
//   } else if (period === 'Weekly') {
//     end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
//   } else if (period === 'Monthly') {
//     end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
//   } else {
//     end = null;
//   }
//   return { start, end };
// };

// const NewReport = () => {
//   useLenisScroll(); // ✅ Add this
//   const [selectedReport, setSelectedReport] = useState('FCL');
//   const [selectedPeriod, setSelectedPeriod] = useState('Daily');
//   const [dateInput, setDateInput] = useState('');
//   const [allData, setAllData] = useState([]);
//   const [filteredData, setFilteredData] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [sortField, setSortField] = useState('created_at');
//   const [sortDirection, setSortDirection] = useState('desc');
//   const [milaSummaryData, setMilaSummaryData] = useState(null);
//   const [sclSummaryData, setSclSummaryData] = useState(null);
//   const [fclSummaryData, setFclSummaryData] = useState(null);

//   // Helper function to format per_bin_weights data
//   const formatPerBinWeights = (perBinWeights) => {
//     if (!perBinWeights) return 'No data';
//     if (Array.isArray(perBinWeights)) {
//       return perBinWeights.map(bw => `Bin ${bw.bin_id}: ${bw.total_weight?.toFixed(2) ?? '0.00'} kg`).join(', ');
//     }
//     if (typeof perBinWeights === 'object') {
//       // Single object
//       return `Bin ${perBinWeights.bin_id}: ${perBinWeights.total_weight?.toFixed(2) ?? '0.00'} kg`;
//     }
//     return String(perBinWeights);
//   };

//   // Helper function to format active_destination data
//   const formatActiveDestination = (activeDestination) => {
//     if (!activeDestination) return 'No data';
//     if (Array.isArray(activeDestination)) {
//       return activeDestination.map(dest => `Dest: ${dest.dest_no}, Bin: ${dest.bin_id}, Code: ${dest.prd_code}`).join('; ');
//     }
//     if (typeof activeDestination === 'object') {
//     return `Dest: ${activeDestination.dest_no}, Bin: ${activeDestination.bin_id}, Code: ${activeDestination.prd_code}`;
//     }
//     return String(activeDestination);
//   };

//   // Helper function to format active_sources data
//   const formatActiveSources = (activeSources) => {
//     if (!activeSources) return 'No data';
//     if (Array.isArray(activeSources)) {
//     return activeSources.map(src => `Bin ${src.bin_id}: ${src.weight || 0} kg`).join(', ');
//     }
//     if (typeof activeSources === 'object') {
//       // Single object
//       return `Bin ${activeSources.bin_id}: ${activeSources.weight || 0} kg`;
//     }
//     return String(activeSources);
//   };

//   // Helper function to format date
//   const formatDate = (dateString) => {
//     if (!dateString) return 'N/A';
//     try {
//       const date = new Date(dateString);
//       return date.toLocaleString();
//     } catch (error) {
//       return dateString;
//     }
//   };

//   // Helper function to get job status text
//   const getJobStatusText = (status) => {
//     const statusMap = {
//       0: 'Stopped',
//       1: 'Starting',
//       2: 'Running',
//       3: 'Paused',
//       4: 'Running',
//       5: 'Paused'
//     };
//     return statusMap[status] || `Status ${status}`;
//   };

//   // Helper function to sort data
//   const sortData = (data, field, direction) => {
//     return [...data].sort((a, b) => {
//       let aVal = a[field];
//       let bVal = b[field];

//       // Handle numeric values
//       if (field === 'id' || field === 'receiver' || field === 'flow_rate' || 
//           field === 'produced_weight' || field === 'water_consumed' || 
//           field === 'moisture_offset' || field === 'moisture_setpoint') {
//         aVal = parseFloat(aVal) || 0;
//         bVal = parseFloat(bVal) || 0;
//       }

//       // Handle date values
//       if (field === 'created_at') {
//         aVal = new Date(aVal);
//         bVal = new Date(bVal);
//       }

//       if (direction === 'asc') {
//         return aVal > bVal ? 1 : -1;
//       } else {
//         return aVal < bVal ? 1 : -1;
//       }
//     });
//   };

//   // Helper function to filter data by date range
//   const filterDataByDateRange = (data, startDate, endDate) => {
//     if (!startDate && !endDate) {
//       return data; // Return all data if no dates selected
//     }

//     return data.filter(item => {
//       const itemCreatedAt = new Date(item.created_at);

//       let startFilter = true;
//       let endFilter = true;

//       if (startDate) {
//         const filterStartDate = new Date(startDate);
//         startFilter = itemCreatedAt >= filterStartDate;
//       }

//       if (endDate) {
//         const filterEndDate = new Date(endDate);
//         // Set end date to end of day for inclusive filtering
//         filterEndDate.setHours(23, 59, 59, 999);
//         endFilter = itemCreatedAt <= filterEndDate;
//       }

//       return startFilter && endFilter;
//     });
//   };

//   // Helper function to safely render any value
//   const safeRender = (value) => {
//     if (value === null || value === undefined) return 'N/A';
//     if (typeof value === 'object') return JSON.stringify(value);
//     return String(value);
//   };

//   // Helper function to format MILA summary data for display
//   const formatMilaSummaryForTable = (summaryData) => {
//     if (!summaryData) return [];

//     const formattedData = [];

//     // Add summary row
//     formattedData.push({
//       id: 'summary',
//       order_name: 'SUMMARY',
//       status: 'Summary',
//       receiver: `${summaryData.total_produced_weight?.toFixed(3) || 0} kg`,
//       bran_receiver: Object.entries(summaryData.bran_receiver_totals || {})
//         .map(([key, value]) => `${key}: ${value.toFixed(3)} kg`)
//         .join(', '),
//       yield: Object.entries(summaryData.average_yield_log || {})
//         .map(([key, value]) => `${key}: ${value.toFixed(3)}%`)
//         .join(', '),
//       setpoint: Object.entries(summaryData.average_setpoints_percentages || {})
//         .map(([key, value]) => `${key}: ${value.toFixed(3)}%`)
//         .join(', '),
//       created_at: `Records: ${summaryData.record_count || 0}`,
//       is_summary: true
//     });

//     return formattedData;
//   };

//   // Reusable summary card layout for SCL and FCL
//   function SummaryCardLayout({ summary, reportType, consumedOverride }) {
//     if (!summary) return <div>No summary data available</div>;

//     const {
//       total_produced_weight = 0,
//       average_flow_rate = 0,
//       average_moisture_setpoint = 0,
//       average_moisture_offset = 0,
//       material_summary = {},
//       per_bin_weight_totals = {},
//       receiver_weight = {},
//       total_receiver_weight = 0,
//       record_count = 0
//     } = summary;

//     const [materialName] = Object.entries(material_summary)[0] || [null];

//     let senderRows, receiverRows, receiverActualWeight;
//     if (reportType === 'FCL') {
//       senderRows = Object.entries(per_bin_weight_totals).map(([binKey, weight]) => {
//         const binNum = binKey.replace('bin_', '');
//         return {
//           id: binNum.padStart(4, '0'),
//           product: 'N/A',
//           weight: weight || 0
//         };
//       });
//       receiverRows = [{ id: '0031', product: 'N/A', location: 'Output Bin', weight: typeof total_receiver_weight === 'number' ? total_receiver_weight : 0 }];
//       receiverActualWeight = typeof total_receiver_weight === 'number' ? total_receiver_weight : 0;
//     } else {
//       senderRows = Object.entries(per_bin_weight_totals).map(([binKey, weight]) => ({
//         id: binKey.replace('bin_', '').padStart(4, '0'),
//         product: materialName || 'N/A',
//         weight: weight || 0
//       }));
//       receiverRows = Object.entries(receiver_weight).length > 0
//         ? Object.entries(receiver_weight).map(([binKey, weight]) => ({
//             id: binKey.replace('bin_', '').padStart(4, '0'),
//             product: materialName || 'N/A',
//             location: 'Output Bin',
//             weight: weight || 0
//           }))
//         : [{ id: '0031', product: materialName || 'N/A', location: 'Output Bin', weight: 0 }];
//       receiverActualWeight = receiverRows.reduce((sum, row) => sum + (row.weight || 0), 0);
//     }

//     const senderActualWeight = senderRows.reduce((sum, row) => sum + (row.weight || 0), 0);
//     const consumedWeight = typeof consumedOverride === 'number' ? consumedOverride : senderActualWeight;

//     return (
//       <div className="bg-white dark:bg-[#232c3d] rounded-2xl p-6 w-full px-4 md:px-10 xl:px-20 mx-auto mt-4 mb-8 border border-gray-300 dark:border-gray-700 dark:text-gray-100" style={{ boxSizing: 'border-box' }}>
//         {/* Header */}
//         <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
//           <div></div>
//           <div className="text-right">
//             <div className="font-semibold">Produced: <span>{Number(total_produced_weight).toFixed(1)} kg</span></div>
//             <div className="font-semibold">Consumed: {Number(consumedWeight).toFixed(1)} kg</div>
//           </div>
//         </div>

//         {/* Sender Section */}
//         <div className="mb-6">
//           <div className="font-semibold mb-2">Sender</div>
//           <table className="w-full border mb-1">
//             <thead>
//               <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">ID</th>
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Product</th>
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Weight</th>
//               </tr>
//             </thead>
//             <tbody>
//               {senderRows.map((row, i) => (
//                 <tr key={i}>
//                   <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.id}</td>
//                   <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.product}</td>
//                   <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{parseFloat(row.weight).toFixed(1)} kg</td>
//                 </tr>
//               ))}
//               <tr>
//                 <td colSpan={2} className="border px-2 py-1 font-semibold text-right dark:border-gray-700 dark:text-gray-100">Actual weight</td>
//                 <td className="border px-2 py-1 font-semibold text-right dark:border-gray-700 dark:text-gray-100">{Number(senderActualWeight).toFixed(1)} kg</td>
//               </tr>
//             </tbody>
//           </table>
//         </div>

//         {/* Receiver Section */}
//         <div className="mb-6">
//           <div className="font-semibold mb-2">Receiver</div>
//           <table className="w-full border mb-1">
//             <thead>
//               <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">ID</th>
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Product</th>
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Location</th>
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Weight</th>
//               </tr>
//             </thead>
//             <tbody>
//               {receiverRows.map((row, i) => (
//                 <tr key={i}>
//                   <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.id}</td>
//                   <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.product}</td>
//                   <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.location}</td>
//                   <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{parseFloat(row.weight).toFixed(1)} kg</td>
//                 </tr>
//               ))}
//               <tr>
//                 <td colSpan={3} className="border px-2 py-1 font-semibold text-right dark:border-gray-700 dark:text-gray-100">Actual weight</td>
//                 <td className="border px-2 py-1 font-semibold text-right dark:border-gray-700 dark:text-gray-100">{Number(receiverActualWeight).toFixed(1)} kg</td>
//               </tr>
//             </tbody>
//           </table>
//         </div>

//         {/* Setpoints Section */}
//         <div className="mb-6">
//           <div className="font-semibold mb-2">Setpoints</div>
//           <table className="w-full border mb-1">
//             <thead>
//               <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Parameter</th>
//                 <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
//               </tr>
//             </thead>
//             <tbody>
//               <tr>
//                 <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Flowrate</td>
//                 <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(average_flow_rate).toFixed(1)}</td>
//               </tr>
//               <tr>
//                 <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Moisture Setpoint</td>
//                 <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(average_moisture_setpoint).toFixed(1)}</td>
//               </tr>
//               <tr>
//                 <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Moisture Offset</td>
//                 <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(average_moisture_offset).toFixed(1)}</td>
//               </tr>
//             </tbody>
//           </table>
//         </div>

//         {/* Records footer */}
//         <div className="text-xs text-gray-500">Records: {record_count || 0}</div>
//       </div>
//     );
//   }

//   function MilaSummaryLayout({ summary }) {
//     if (!summary) return <div>No summary data available</div>;

//     const { total_produced_weight, bran_receiver_totals, average_yield_log, average_setpoints_percentages, average_yield_flows, receiver_weight_totals } = summary;

//     // Receiver rows from receiver_weight_totals
//     const receiverRows = receiver_weight_totals
//       ? Object.entries(receiver_weight_totals).map(([name, weight]) => ({
//           id: name,
//           name: name,
//           weight: weight || 0,
//         }))
//         : [];

//     // Bran Receiver rows from bran_receiver_totals
//     const branReceiverRows = bran_receiver_totals
//       ? Object.entries(bran_receiver_totals).map(([name, weight]) => ({
//           id: name,
//           name: name,
//           weight: weight || 0,
//         }))
//         : [];

//     // Yield log rows: first the two flow rows, then the yield log
//     const yieldLogRows = [];
//     if (average_yield_flows) {
//       Object.entries(average_yield_flows).forEach(([key, value]) => {
//         yieldLogRows.push({ key, value: value + (key.includes('kg/s') ? ' kg/h' : '') });
//       });
//     }
//     if (average_yield_log) {
//       Object.entries(average_yield_log).forEach(([key, value]) => {
//         yieldLogRows.push({ key, value: value + ' %' });
//       });
//     }

//     return (
//       <div className="bg-white dark:bg-[#1a2233] rounded-xl p-6">
//         <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
//           <div>
//             <div className="font-bold text-lg mb-1">line Running</div>
//             <div className="text-blue-700 font-semibold">MIL-A</div>
//             <div className="text-gray-500">Status: Running</div>
//           </div>
//           <div className="text-right">
//             <div className="font-semibold">Produced: <span>{total_produced_weight?.toFixed(1) || 0} kg</span></div>
//             <div className="font-semibold">Consumed: 100.0 kg</div>
//           </div>
//         </div>
//         {/* Receiver Section */}
//         <div className="mb-6">
//           <div className="font-semibold mb-2">Receiver</div>
//           <table className="w-full border mb-1">
//             <thead>
//               <tr className="bg-gray-100">
//                 <th className="border px-2 py-1">Identific Product ident</th>
//                 <th className="border px-2 py-1">Product name</th>
//                 <th className="border px-2 py-1">Actual weight</th>
//               </tr>
//             </thead>
//             <tbody>
//               {receiverRows.map((row, i) => (
//                 <tr key={i}>
//                   <td className="border px-2 py-1">{row.id}</td>
//                   <td className="border px-2 py-1">{row.name}</td>
//                   <td className="border px-2 py-1 text-right">{parseFloat(row.weight).toFixed(1)} kg</td>
//                 </tr>
//               ))}
//               <tr>
//                 <td colSpan={2} className="border px-2 py-1 font-semibold text-right">Actual weight</td>
//                 <td className="border px-2 py-1 font-semibold text-right">{receiverRows.reduce((a, b) => a + parseFloat(b.weight), 0).toFixed(1)} kg</td>
//               </tr>
//             </tbody>
//           </table>
//         </div>
//         {/* Bran Receiver Section */}
//         <div className="mb-6">
//           <div className="font-semibold mb-2">Bran Receiver</div>
//           <table className="w-full border mb-1">
//             <thead>
//               <tr className="bg-gray-100">
//                 <th className="border px-2 py-1">Identific Product ident</th>
//                 <th className="border px-2 py-1">Product name</th>
//                 <th className="border px-2 py-1">Actual weight</th>
//               </tr>
//             </thead>
//             <tbody>
//               {branReceiverRows.map((row, i) => (
//                 <tr key={i}>
//                   <td className="border px-2 py-1">{row.id}</td>
//                   <td className="border px-2 py-1">{row.name}</td>
//                   <td className="border px-2 py-1 text-right">{parseFloat(row.weight).toFixed(1)} kg</td>
//                 </tr>
//               ))}
//               <tr>
//                 <td colSpan={2} className="border px-2 py-1 font-semibold text-right">Actual weight</td>
//                 <td className="border px-2 py-1 font-semibold text-right">{branReceiverRows.reduce((a, b) => a + parseFloat(b.weight), 0).toFixed(1)} kg</td>
//               </tr>
//             </tbody>
//           </table>
//         </div>
//         {/* Yield Log Section */}
//         <div className="mb-6">
//           <div className="font-semibold mb-2">Yield Log</div>
//           <table className="w-full border mb-1">
//             <tbody>
//               {yieldLogRows.map((row, i) => (
//                 <tr key={i}>
//                   <td className="border px-2 py-1">{row.key}</td>
//                   <td className="border px-2 py-1 text-right">{row.value}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//         {/* Setpoints Section */}
//         <div className="mb-6">
//           <div className="font-semibold mb-2">Setpoints</div>
//           <table className="w-full border mb-1">
//             <thead>
//               <tr className="bg-gray-100">
//                 <th className="border px-2 py-1">Identification</th>
//                 <th className="border px-2 py-1">Target value</th>
//                 <th className="border px-2 py-1">Actual value</th>
//               </tr>
//             </thead>
//             <tbody>
//               {average_setpoints_percentages && Object.entries(average_setpoints_percentages).map(([key, value], i) => (
//                 <tr key={i}>
//                   <td className="border px-2 py-1">{key}</td>
//                   <td className="border px-2 py-1 text-right">{value} %</td>
//                   <td className="border px-2 py-1 text-center"></td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     );
//   }

//   const renderTable = () => {
//     if (selectedPeriod === 'Full Report') {
//       return null; // Hide full report table for all orders
//     }
//     if (selectedReport === 'MIL-A') {
//       // For MILA, show summary data in custom layout for non-Full Report
//       if (milaSummaryData) {
//         return <MilaSummaryLayout summary={milaSummaryData} />;
//       }
//       // For 'Full Report', show all records as before
//       const milaColumnOrder = [
//         'id',
//         'order_name',
//         'status',
//         'receiver',
//         'bran_receiver',
//         'yield',
//         'setpoint',
//         'created_at'
//       ];

//       const allColumns = filteredData.length > 0 ? Object.keys(filteredData[0]) : [];
//       const columns = [
//         ...milaColumnOrder.filter(col => allColumns.includes(col)),
//         ...allColumns.filter(col => !milaColumnOrder.includes(col))
//       ];

//       return (
//         <div className="overflow-x-auto">
//           <table className="w-full min-w-max bg-white dark:bg-[#1a2233] dark:text-gray-200">
//           <thead>
//               <tr className="bg-gray-100 dark:bg-[#232c3d]">
//                 {columns.map(col => (
//                   <th key={col} className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100">{col}</th>
//                 ))}
//             </tr>
//           </thead>
//           <tbody>
//               {loading ? (
//                 <tr><td colSpan={columns.length} className="text-center py-4">Loading...</td></tr>
//               ) : filteredData.length === 0 ? (
//                 <tr><td colSpan={columns.length} className="text-center py-4">No data available</td></tr>
//               ) : (
//                 filteredData.map((row, idx) => (
//                   <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-[#232c3d]">
//                     {columns.map(col => (
//                       <td key={col} className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200 text-xs">
//                         {col === 'created_at' ? formatDate(row[col]) : safeRender(row[col])}
//                       </td>
//                     ))}
//               </tr>
//                 ))
//               )}
//           </tbody>
//         </table>
//         </div>
//       );
//     }

//     if ((selectedReport === 'SCL' && selectedPeriod !== 'Full Report' && sclSummaryData)) {
//       return <SummaryCardLayout summary={sclSummaryData} reportType="SCL" />;
//     }
//     if ((selectedReport === 'FCL' && selectedPeriod !== 'Full Report' && fclSummaryData)) {
//       return <SummaryCardLayout summary={fclSummaryData} reportType="FCL" consumedOverride={fclSummaryData.total_receiver_weight} />;
//     }

//     return (
//       <div className="overflow-x-auto">
//         <table className="w-full min-w-max bg-white dark:bg-[#1a2233] dark:text-gray-200">
//           <thead>
//             <tr className="bg-gray-100 dark:bg-[#232c3d]">
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('id')}>
//                 # {renderSortIcon('id')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('id')}>
//                 ID {renderSortIcon('id')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('order_name')}>
//                 Order Name {renderSortIcon('order_name')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('job_status')}>
//                 Job Status {renderSortIcon('job_status')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('original_receiver')}>
//                 Receiver (kg) {renderSortIcon('original_receiver')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('original_flow_rate')}>
//                 Flow Rate (kg/h) {renderSortIcon('original_flow_rate')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('original_produced_weight')}>
//                 Produced Weight (kg) {renderSortIcon('original_produced_weight')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('original_water_consumed')}>
//                 Water Consumed (L) {renderSortIcon('original_water_consumed')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('original_moisture_offset')}>
//                 Moisture Offset (%) {renderSortIcon('original_moisture_offset')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('original_moisture_setpoint')}>
//                 Moisture Setpoint (%) {renderSortIcon('original_moisture_setpoint')}
//               </th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100">Active Destination</th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100">Active Sources</th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100">Per Bin Weights Kg/h</th>
//               <th className="text-left py-2 px-4 border dark:border-gray-700 dark:text-gray-100 cursor-pointer" onClick={() => handleSort('created_at')}>
//                 Created At {renderSortIcon('created_at')}
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {loading ? (
//               <tr>
//                 <td colSpan="14" className="text-center py-4">Loading...</td>
//               </tr>
//             ) : filteredData.length === 0 ? (
//               <tr>
//                 <td colSpan="14" className="text-center py-4">
//                   {dateInput ? 'No data found for selected date range' : 'No data available'}
//                 </td>
//               </tr>
//             ) : (
//               filteredData.map((row, index) => (
//                 <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-[#232c3d]">
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(index + 1)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.id)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.order_name)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.job_status)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.receiver)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.flow_rate)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.produced_weight)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.water_consumed)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.moisture_offset)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200">{safeRender(row.moisture_setpoint)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200 text-xs">{safeRender(row.active_destination)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200 text-xs">{safeRender(row.active_sources)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200 text-xs">{safeRender(row.per_bin_weights)}</td>
//                   <td className="py-2 px-4 border dark:border-gray-700 dark:text-gray-200 text-xs">{formatDate(row.created_at)}</td>
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>
//     );
//   };

//   const handleSort = (field) => {
//     const direction = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
//     setSortField(field);
//     setSortDirection(direction);

//     const sortedData = sortData(filteredData, field, direction);
//     setFilteredData(sortedData);
//   };

//   const renderSortIcon = (field) => {
//     if (sortField === field) {
//       return sortDirection === 'asc' ? ' ↑' : ' ↓';
//     }
//     return '';
//   };

//   // Fetch MILA summary data when period changes
//   useEffect(() => {
//     if (selectedReport === 'MIL-A' && selectedPeriod !== 'Full Report' && dateInput) {
//       const fetchMilaSummary = async () => {
//         setLoading(true);
//         try {
//           const start = new Date(dateInput);
//           let end;
//           if (selectedPeriod === 'Daily') {
//             end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
//           } else if (selectedPeriod === 'Weekly') {
//             end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
//           } else if (selectedPeriod === 'Monthly') {
//             end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
//           }

//           const response = await axios.get('orders/mila/archive/summary', {
//             params: {
//               start_date: start.toISOString(),
//               end_date: end.toISOString()
//             }
//           });

//           if (response.data && response.data.status === 'success') {
//             setMilaSummaryData(response.data.summary);
//           } else {
//             setMilaSummaryData(null);
//           }
//         } catch (error) {
//           console.error('Error fetching MILA summary:', error);
//           setMilaSummaryData(null);
//         } finally {
//           setLoading(false);
//         }
//       };

//       fetchMilaSummary();
//     } else if (selectedReport === 'MIL-A' && selectedPeriod === 'Full Report') {
//       setMilaSummaryData(null);
//     }
//   }, [selectedReport, selectedPeriod, dateInput]);

//   // Fetch SCL summary data when period changes
//   useEffect(() => {
//     if (selectedReport === 'SCL' && selectedPeriod !== 'Full Report' && dateInput) {
//       const fetchSclSummary = async () => {
//         setLoading(true);
//         try {
//           const start = new Date(dateInput);
//           let end;
//           if (selectedPeriod === 'Daily') {
//             end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
//           } else if (selectedPeriod === 'Weekly') {
//             end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
//           } else if (selectedPeriod === 'Monthly') {
//             end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
//           }
//           const response = await axios.get('orders/scl/archive/summary', {
//             params: {
//               start_date: start.toISOString(),
//               end_date: end.toISOString()
//             }
//           });
//           if (response.data && response.data.status === 'success') {
//             setSclSummaryData(response.data.summary);
//           } else {
//             setSclSummaryData(null);
//           }
//         } catch (error) {
//           setSclSummaryData(null);
//         } finally {
//           setLoading(false);
//         }
//       };
//       fetchSclSummary();
//     } else if (selectedReport === 'SCL' && selectedPeriod === 'Full Report') {
//       setSclSummaryData(null);
//     }
//   }, [selectedReport, selectedPeriod, dateInput]);

//   // Add state and effect for FCL summary data (prepare for API)
//   useEffect(() => {
//     if (selectedReport === 'FCL' && selectedPeriod !== 'Full Report' && dateInput) {
//       const fetchFclSummary = async () => {
//         setLoading(true);
//         try {
//           const start = new Date(dateInput);
//           let end;
//           if (selectedPeriod === 'Daily') {
//             end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
//           } else if (selectedPeriod === 'Weekly') {
//             end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
//           } else if (selectedPeriod === 'Monthly') {
//             end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
//           }
//           const response = await axios.get('orders/fcl/archive/summary', {
//             params: {
//               start_date: start.toISOString(),
//               end_date: end.toISOString()
//             }
//           });
//           if (response.data && response.data.status === 'success') {
//             setFclSummaryData(response.data.summary);
//           } else {
//             setFclSummaryData(null);
//           }
//         } catch (error) {
//           setFclSummaryData(null);
//         } finally {
//           setLoading(false);
//         }
//       };
//       fetchFclSummary();
//     } else if (selectedReport === 'FCL' && selectedPeriod === 'Full Report') {
//       setFclSummaryData(null);
//     }
//   }, [selectedReport, selectedPeriod, dateInput]);

//   useEffect(() => {
//     const fetchData = async () => {
//       setLoading(true);
//       let endpoint = '';
//       if (selectedReport === 'FCL') endpoint = 'orders/archive/fcl/full';
//       else if (selectedReport === 'SCL') endpoint = 'orders/archive/scl/full';
//       else if (selectedReport === 'MIL-A') endpoint = 'orders/mila/archive/all';
//       try {
//         const response = await axios.get(endpoint);
//         if (response.data && response.data.status === 'success' && Array.isArray(response.data.data)) {
//           setAllData(response.data.data);
//           setFilteredData(response.data.data);
//         } else {
//           setAllData([]);
//           setFilteredData([]);
//         }
//       } catch (error) {
//         setAllData([]);
//         setFilteredData([]);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchData();
//   }, [selectedReport]);

//   // Filter data for selected period and date input
//   useEffect(() => {
//     if (!allData || allData.length === 0) {
//       setFilteredData([]);
//       return;
//     }
//     if (selectedPeriod === 'Full Report' || !dateInput) {
//       setFilteredData(allData);
//       return;
//     }
//     const start = new Date(dateInput);
//     let end;
//     if (selectedPeriod === 'Daily') {
//       end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
//     } else if (selectedPeriod === 'Weekly') {
//       end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
//     } else if (selectedPeriod === 'Monthly') {
//       end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
//     }
//     const filtered = allData.filter(item => {
//       const itemDate = new Date(item.created_at);
//       return itemDate >= start && itemDate < end;
//     });
//     setFilteredData(filtered);
//   }, [selectedPeriod, dateInput, allData]);

//   // Helper to get local ISO string for datetime-local input
//   function toLocalISOString(date) {
//     const tzOffset = date.getTimezoneOffset() * 60000;
//     const localISOTime = new Date(date - tzOffset).toISOString().slice(0, 16);
//     return localISOTime;
//   }

//   // Set default dateInput for each period
//   useEffect(() => {
//     const now = new Date();
//     let defaultDate;
//     if (selectedPeriod === 'Daily') {
//       defaultDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
//     } else if (selectedPeriod === 'Weekly') {
//       defaultDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
//     } else if (selectedPeriod === 'Monthly') {
//       defaultDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
//     } else {
//       defaultDate = now;
//     }
//     // Set time to 7 AM for all periods
//     defaultDate.setHours(7, 0, 0, 0);
//     setDateInput(toLocalISOString(defaultDate));
//   }, [selectedReport, selectedPeriod]);

//   // Helper to get end date for display
//   const getEndDateDisplay = () => {
//     if (!dateInput) return '';
//     const start = new Date(dateInput);
//     let end;
//     if (selectedPeriod === 'Daily') {
//       end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
//     } else if (selectedPeriod === 'Weekly') {
//       end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
//     } else if (selectedPeriod === 'Monthly') {
//       end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
//     } else {
//       return '';
//     }
//     return `to ${end.toLocaleString()}`;
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4 md:px-8 pt-2 pb-8">
//       {/* Toggles and dropdown row */}
//       <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
//         {/* Period toggles centered on desktop, stacked on mobile */}
//         <div className="flex justify-center md:justify-start flex-wrap gap-2">
//           {PERIOD_OPTIONS.filter(period => period !== 'Full Report').map(period => (
//             <button
//               key={period}
//               className={`px-6 py-2 rounded-full shadow text-lg font-semibold transition ${
//                 selectedPeriod === period
//                   ? 'bg-green-600 text-white'
//                   : 'bg-white border border-green-600 text-green-600 hover:bg-green-50'
//               }`}
//               onClick={() => setSelectedPeriod(period)}
//             >
//               {period}
//             </button>
//           ))}
//         </div>
//         {/* Dropdown on the right */}
//         <div className="flex justify-center md:justify-end">
//           <select
//             value={selectedReport}
//             onChange={e => setSelectedReport(e.target.value)}
//             className="px-4 py-2 rounded border border-blue-600 text-lg font-semibold bg-white"
//             style={{ minWidth: 120 }}
//           >
//             {REPORT_OPTIONS.map(opt => (
//               <option key={opt.value} value={opt.value}>{opt.label}</option>
//             ))}
//           </select>
//         </div>
//       </div>
//       {/* Print Button for Daily, Weekly, Monthly */}
//       {selectedPeriod !== 'Full Report' && (
//         <div className="flex justify-end mb-2">
//           <button
//             onClick={() => window.print()}
//             className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 print:hidden"
//           >
//             Print
//           </button>
//         </div>
//       )}
//       {/* Date-Time Input with range display */}
//       {selectedPeriod !== 'Full Report' && (
//         <div className="flex items-center gap-2 justify-center mb-4">
//           <input
//             type="datetime-local"
//             value={dateInput}
//             onChange={e => setDateInput(e.target.value)}
//             className="px-2 py-1 border rounded shadow"
//             style={{ minWidth: 180 }}
//           />
//           <span className="font-semibold text-gray-600">{getEndDateDisplay()}</span>
//         </div>
//       )}
//       {/* Responsive Table Container */}
//       <div id="report-print-section" className="w-full bg-white rounded-2xl shadow-lg p-4 md:p-8 overflow-x-auto min-h-[calc(100vh-120px)] ml-0 mt-4 mr-0" style={{ boxSizing: 'border-box' }}>
//         {/* Time frame display for print and screen */}
//         {selectedPeriod !== 'Full Report' && (
//           <div className="mb-4 text-center font-semibold text-lg">
//             {selectedPeriod} Report
//             <span className="ml-2 text-gray-600 text-base">
//               {dateInput && (() => {
//                 const start = new Date(dateInput);
//                 let end;
//                 if (selectedPeriod === 'Daily') {
//                   end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
//                 } else if (selectedPeriod === 'Weekly') {
//                   end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
//                 } else if (selectedPeriod === 'Monthly') {
//                   end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
//                 }
//                 return `(${start.toLocaleString()} to ${end ? end.toLocaleString() : ''})`;
//               })()}
//             </span>
//           </div>
//         )}
//         {renderTable()}
//       </div>
//     </div>
//   );
// };

// export default NewReport;
import React, { useState, useEffect } from "react";
import axios from "../API/axios";
import { useLenisScroll } from "../Hooks/useLenisScroll.js"; // ✅ Smooth scroll
import herculesLogo from "../Assets/herculeslogo.png";
import salalahLogo from "../Assets/salalah_logo.png";
import asmLogo from "../Assets/Asm_Logo.png";

const REPORT_OPTIONS = [
  { value: "FCL", label: "FCL" },
  { value: "SCL", label: "SCL" },
  { value: "MIL-A", label: "MILA" },
  { value: "FTRA", label: "FTRA" },
];

const PERIOD_OPTIONS = ["Hourly", "Daily", "Weekly", "Monthly", "Full Report"];

/** Parse summary / archive timestamps (ISO "YYYY-MM-DD HH:MM:SS", RFC 822, or as-is). */
function parseMilaReportDate(value) {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s) return null;
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
  if (isoMatch) {
    s = isoMatch[1] + 'T' + isoMatch[2];
    const dot = s.indexOf('.');
    if (dot !== -1) s = s.substring(0, dot);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const MILA_B1_SCALE_JSON_KEYS = ['B1Scale (kg)', 'B1Scale', 'B1 Scale', 'MILA_B1_scale (kg)'];

/** Display order for Scale totalizers (keys match backend bran_receiver / JSON snapshots). */
const MILA_SCALE_TOTALIZER_CARD_ROWS = [
  { label: 'B1', key: 'B1Scale (kg)' },
  { label: 'F1', key: 'MILA_Flour1 (kg)' },
  { label: 'F2', key: 'F2 Scale (kg)' },
  { label: 'Bran coarse', key: '9106 Bran coarse (kg)' },
  { label: 'Bran fine', key: '9105 Bran fine (kg)' },
  { label: 'semolina', key: 'Semolina (kg)' },
];

function formatMilaSummaryDateTime(value) {
  const d = value instanceof Date ? value : parseMilaReportDate(value);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function getMilaTotalizerKgFromDict(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  const v = obj[key];
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function getB1ScaleKgFromBran(bran) {
  let obj = bran;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj || '{}');
    } catch {
      obj = {};
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  for (const k of MILA_B1_SCALE_JSON_KEYS) {
    if (obj[k] != null && obj[k] !== '') {
      const v = parseFloat(obj[k]);
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

function formatMilaReportKg(value) {
  const n = Math.abs(parseFloat(value) || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';
}

function formatMilaTotalizerKg(value) {
  if (value == null || Number.isNaN(parseFloat(value))) return '—';
  return formatMilaReportKg(value);
}

/** FCL 520WE cumulative totalizer display (same formatting as Job Logs). */
function formatFclTotalizerKg(value) {
  if (value == null || Number.isNaN(parseFloat(value))) return '—';
  return formatMilaReportKg(value);
}

/** Canonical scale totalizer snapshot from one bran_receiver row (same keys as backend summary). */
function buildMilaScaleTotalizerSnapshotFromBran(bran) {
  let obj = bran;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj || '{}');
    } catch {
      obj = {};
    }
  }
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const { key } of MILA_SCALE_TOTALIZER_CARD_ROWS) {
    if (key === 'B1Scale (kg)') {
      const v = getB1ScaleKgFromBran(obj);
      if (v != null) out[key] = v;
    } else {
      const v = getMilaTotalizerKgFromDict(obj, key);
      if (v != null) out[key] = v;
    }
  }
  return out;
}

// Default range helper (used when user does not select explicit end date)
const getPeriodRange = (period, dateInput) => {
  if (!dateInput) return { start: null, end: null };
  // Ensure we parse as local date start of day
  const start = new Date(dateInput + 'T00:00:00');
  let end;
  if (period === "Hourly") {
    // For hourly: 1 hour from start
    end = new Date(start.getTime() + 1 * 60 * 60 * 1000);
  } else if (period === "Daily") {
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  } else if (period === "Weekly") {
    end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
  } else if (period === "Monthly") {
    end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
  } else {
    end = null;
  }
  return { start, end };
};

const NewReport = () => {
  useLenisScroll();

  const [selectedReport, setSelectedReport] = useState("FCL");
  const [selectedPeriod, setSelectedPeriod] = useState("Daily");

  // 🔄 NEW: explicit start & end date/time
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [milaSummaryData, setMilaSummaryData] = useState(null);
  const [sclSummaryData, setSclSummaryData] = useState(null);
  const [fclSummaryData, setFclSummaryData] = useState(null);
  const [ftraSummaryData, setFtraSummaryData] = useState(null);

  // Helper function to format per_bin_weights data
  const formatPerBinWeights = (perBinWeights) => {
    if (!perBinWeights) return "No data";
    if (Array.isArray(perBinWeights)) {
      return perBinWeights
        .map(
          (bw) =>
            `Bin ${bw.bin_id}: ${bw.total_weight?.toFixed(2) ?? "0.00"
            } kg`
        )
        .join(", ");
    }
    if (typeof perBinWeights === "object") {
      return `Bin ${perBinWeights.bin_id}: ${perBinWeights.total_weight?.toFixed(2) ?? "0.00"
        } kg`;
    }
    return String(perBinWeights);
  };

  // Helper function to format active_destination data
  const formatActiveDestination = (activeDestination) => {
    if (!activeDestination) return "No data";
    if (Array.isArray(activeDestination)) {
      return activeDestination
        .map(
          (dest) =>
            `Dest: ${dest.dest_no}, Bin: ${dest.bin_id}, Code: ${dest.prd_code}`
        )
        .join("; ");
    }
    if (typeof activeDestination === "object") {
      return `Dest: ${activeDestination.dest_no}, Bin: ${activeDestination.bin_id}, Code: ${activeDestination.prd_code}`;
    }
    return String(activeDestination);
  };

  // Helper function to format active_sources data
  const formatActiveSources = (activeSources) => {
    if (!activeSources) return "No data";
    if (Array.isArray(activeSources)) {
      return activeSources
        .map((src) => `Bin ${src.bin_id}: ${src.weight || 0} kg`)
        .join(", ");
    }
    if (typeof activeSources === "object") {
      return `Bin ${activeSources.bin_id}: ${activeSources.weight || 0
        } kg`;
    }
    return String(activeSources);
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return dateString;
    }
  };

  // Helper function to get job status text
  const getJobStatusText = (status) => {
    const statusMap = {
      0: "Stopped",
      1: "Starting",
      2: "Running",
      3: "Paused",
      4: "Running",
      5: "Paused",
    };
    return statusMap[status] || `Status ${status}`;
  };

  // Helper function to sort data
  const sortData = (data, field, direction) => {
    return [...data].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Handle numeric values
      if (
        field === "id" ||
        field === "receiver" ||
        field === "flow_rate" ||
        field === "produced_weight" ||
        field === "water_consumed" ||
        field === "moisture_offset" ||
        field === "moisture_setpoint"
      ) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      // Handle date values
      if (field === "created_at") {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (direction === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  // Helper function to filter data by date range
  const filterDataByDateRange = (data, start, end) => {
    if (!start && !end) return data;

    return data.filter((item) => {
      const itemCreatedAt = new Date(item.created_at);
      let startFilter = true;
      let endFilter = true;

      if (start) {
        startFilter = itemCreatedAt >= start;
      }

      if (end) {
        endFilter = itemCreatedAt <= end;
      }
      return startFilter && endFilter;
    });
  };

  // Helper function to safely render any value
  const safeRender = (value) => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Helper to get local ISO string for date input (YYYY-MM-DD)
  const toLocalISOString = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date - tzOffset)
      .toISOString()
      .slice(0, 16); // Return YYYY-MM-DDTHH:MM for datetime-local input
    return localISOTime;
  };

  // 🔧 Compute effective start & end based on period + explicit endDate
  function computeRange() {
    if (!startDate) return { start: null, end: null };

    // Parse startDate (includes time from datetime-local input)
    let start = new Date(startDate);
    let end;

    if (endDate) {
      // Parse endDate (includes time from datetime-local input)
      end = new Date(endDate);
      
      console.log('[computeRange] Using explicit endDate:', {
        endDateInput: endDate,
        endDateParsed: end,
        endDateISO: end.toISOString(),
        endDateLocal: end.toLocaleString()
      });
    } else {
      const { end: defaultEnd } = getPeriodRange(
        selectedPeriod,
        startDate
      );
      end = defaultEnd;
      
      console.log('[computeRange] Using calculated endDate from getPeriodRange:', {
        endDateCalculated: end,
        endDateISO: end?.toISOString(),
        endDateLocal: end?.toLocaleString()
      });
    }

    console.log('[computeRange] Final range:', {
      startInput: startDate,
      endInput: endDate,
      startParsed: start.toLocaleString(),
      endParsed: end?.toLocaleString(),
      startISO: start.toISOString(),
      endISO: end?.toISOString()
    });

    return { start, end };
  }

  // Helper function to format MILA summary data for table (not used in new design, but kept)
  const formatMilaSummaryForTable = (summaryData) => {
    if (!summaryData) return [];

    const formattedData = [];

    formattedData.push({
      id: "summary",
      order_name: "SUMMARY",
      status: "Summary",
      receiver: `${Math.abs(summaryData.total_produced_weight || 0).toFixed(3)} kg`,
      bran_receiver: Object.entries(
        summaryData.bran_receiver_totals || {}
      )
        .map(
          ([key, value]) => `${key}: ${Math.abs(value).toFixed(3)} kg`
        )
        .join(", "),
      yield: Object.entries(
        summaryData.average_yield_log || {}
      )
        .map(
          ([key, value]) => `${key}: ${value.toFixed(3)}%`
        )
        .join(", "),
      setpoint: Object.entries(
        summaryData.average_setpoints_percentages || {}
      )
        .map(
          ([key, value]) => `${key}: ${value.toFixed(3)}%`
        )
        .join(", "),
      created_at: `Records: ${summaryData.record_count || 0}`,
      is_summary: true,
    });

    return formattedData;
  };

  // Reusable summary card layout for SCL and FCL
  function SummaryCardLayout({ summary, reportType, consumedOverride, filterStart, filterEnd }) {
    if (!summary) return <div>No summary data available</div>;

    const {
      total_produced_weight = 0,
      average_flow_rate = 0,
      average_moisture_setpoint = 0,
      average_moisture_offset = 0,
      total_water_consumed = 0,  // ✅ FCL: sum of water_consumed (L) from archive
      cleaning_scale_bypass = false, // ✅ New field
      material_summary = {},
      per_bin_weight_totals = {},
      receiver_weight = {},
      receiver_bin_id = null,  // ✅ Get actual receiver bin ID from backend (SCL/FCL)
      receiver_material_name = null,  // ✅ Get receiver material name (FCL)
      total_receiver_weight = 0,
      main_receiver_weight = 0,  // ✅ Main receiver weight (bin 028, 030, etc.) - FCL only
      fcl_2_520we_weight = 0,  // ✅ Get FCL_2_520WE separately - FCL only
      fcl_2_520we_last_value = 0, // ✅ Absolute last value for FCL_2_520WE row
      fcl_2_520we_at_order_start: fcl520weAtOrderStart = null,
      fcl_2_520we_at_order_end: fcl520weAtOrderEnd = null,
      start_time: summaryStartTime,
      end_time: summaryEndTime,
      record_count = 0,
    } = summary;

    const [materialName] =
      Object.entries(material_summary)[0] || [null];

    let senderRows, receiverRows, receiverActualWeight;
    if (reportType === "FCL") {
      senderRows = Object.entries(per_bin_weight_totals)
        .filter(([binKey, weight]) => {
          // Filter out bins with zero or very small weights (< 0.1 kg)
          const weightValue = parseFloat(weight) || 0;
          return weightValue >= 0.1;
        })
        .map(([binKey, weight]) => {
          const binNum = binKey.replace("bin_", "");
          
          // ✅ FCL Bin Mapping (211->21A, 212->21B, 213->21C)
          let displayId = binNum;
          if (binNum === '211') displayId = '21A';
          if (binNum === '212') displayId = '21B';
          if (binNum === '213') displayId = '21C';
          
          // ✅ Get material name from material_summary; fallback for N/A or "No Material"
          let productName = material_summary[binKey] || "N/A";
          if (productName === "N/A" || (productName && productName.includes("No Material"))) {
            productName = `Bin ${displayId}`;
          }
          return {
            id: displayId.padStart(4, "0"),
            product: productName,
            weight: weight || 0,
          };
        });
      
      // ✅ For FCL: Build receiver rows
      // Order: Bin 0028/Dest (FIRST), then FCL_2_520WE
      receiverRows = [];
      
      // Row 1: Main receiver bin (028, 030, etc.)
      // ✅ Use main_receiver_weight (Delta: end - start) for this row as "Produced" weight
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
      
      // ✅ Calculate actual weight for FCL
      // For FCL, the "Produced" weight is the delta (end - start)
      receiverActualWeight = main_receiver_weight; 
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
          // ✅ Get material name from material_summary; fallback for N/A or "No Material"
          let productName = material_summary[binKey] || "N/A";
          if (productName === "N/A" || (productName && productName.includes("No Material"))) {
            productName = `Bin ${binNum}`;
          }
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

    const senderActualWeight = senderRows.reduce(
      (sum, row) => sum + (row.weight || 0),
      0
    );
    
    // ✅ For FCL: 
    //   - Produced = Delta (end - start) from cumulative counter
    //   - Consumed = sender sum (total material sent)
    // ✅ For SCL:
    //   - Produced = Receiver weight (actual output)
    //   - Consumed = Sender weight (actual input)
    const consumedWeight = senderActualWeight;  // Always use sender sum for consumed
    const producedWeight = reportType === "FCL" 
      ? (main_receiver_weight || receiverActualWeight)  // FCL: Use delta (end - start)
      : receiverActualWeight;  // SCL: Use receiver sum

    const hasUserFilterRange =
      String(filterStart || '').trim() !== '' && String(filterEnd || '').trim() !== '';
    const fclScaleTotalizersSubtitle =
      reportType === 'FCL' &&
      (hasUserFilterRange
        ? `${new Date(filterStart).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} → ${new Date(filterEnd).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
        : `${formatMilaSummaryDateTime(summaryStartTime)} → ${formatMilaSummaryDateTime(summaryEndTime)}`);
    const fclHasAny520weSnapshot =
      reportType === 'FCL' &&
      ((fcl520weAtOrderStart != null && fcl520weAtOrderStart !== '') ||
        (fcl520weAtOrderEnd != null && fcl520weAtOrderEnd !== ''));

    return (
      <div
        className="bg-white dark:bg-[#232c3d] rounded-2xl p-6 w-full px-4 md:px-10 xl:px-20 mx-auto mt-4 mb-8 border border-gray-300 dark:border-gray-700 dark:text-gray-100"
        style={{ boxSizing: "border-box" }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <div></div>
          <div className="text-right">
            <div className="font-semibold">
              Produced:{" "}
              <span>
                {Math.abs(Number(producedWeight)).toFixed(1)} kg
              </span>
            </div>
            <div className="font-semibold">
              Consumed: {Math.abs(Number(consumedWeight)).toFixed(1)} kg
            </div>
          </div>
        </div>

        {/* Sender Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Sender</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  ID
                </th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Product
                </th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {senderRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                    {row.id}
                  </td>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                    {row.product}
                  </td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                    {Math.abs(parseFloat(row.weight)).toFixed(1)} kg
                  </td>
                </tr>
              ))}
              {/* Actual weight row for sender */}
              <tr className="font-semibold bg-zinc-100 dark:bg-zinc-700">
                <td colSpan={2} className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                  Actual weight
                </td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                  {Math.abs(senderActualWeight).toFixed(1)} kg
                </td>
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
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  ID
                </th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Product
                </th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Location
                </th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {receiverRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                    {row.id}
                  </td>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                    {row.product}
                  </td>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                    {row.location}
                  </td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                    {Math.abs(parseFloat(row.weight)).toFixed(1)} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fclHasAny520weSnapshot && (
          <div className="mb-6">
            <div className="font-semibold mb-2">Scale totalizers</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {fclScaleTotalizersSubtitle}
            </div>
            <table className="w-full border mb-1">
              <thead>
                <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                  <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100 text-left">
                    Scale
                  </th>
                  <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100 text-right">
                    Start (kg)
                  </th>
                  <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100 text-right">
                    End (kg)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                    FCL 2_520WE
                  </td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                    {formatFclTotalizerKg(fcl520weAtOrderStart)}
                  </td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                    {formatFclTotalizerKg(fcl520weAtOrderEnd)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Setpoints Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Setpoints</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Parameter
                </th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Flowrate
                </td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                  {Number(average_flow_rate).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Moisture Setpoint
                </td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                  {Number(average_moisture_setpoint).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Moisture Offset
                </td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                  {Number(average_moisture_offset).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Water consumption
                </td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                  {Number(total_water_consumed ?? 0).toFixed(1)} L
                </td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">
                  Cleaning Scale bypass
                </td>
                <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                  <input
                    type="checkbox"
                    checked={!!cleaning_scale_bypass}
                    readOnly
                    className="w-4 h-4 cursor-default"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Records footer */}
        <div className="text-xs text-gray-500">
          Records: {record_count || 0}
        </div>
      </div>
    );
  }

  // FTRA Summary Layout Component
  function FTRASummaryLayout({ summary }) {
    if (!summary) return <div>No summary data available</div>;

    const {
      total_produced_weight = 0,
      total_receiver_weight = 0,
      per_bin_weight_totals = {},
      material_summary = {},
      receiver_bin_id = null,
      sender_1_bin_id = null,
      sender_2_bin_id = null,
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
      record_count = 0,
    } = summary;

    // Build sender rows from per_bin_weight_totals
    const senderRows = Object.entries(per_bin_weight_totals)
      .filter(([binKey, weight]) => parseFloat(weight) >= 0.1)
      .map(([binKey, weight]) => {
        const binNum = binKey.replace("bin_", "");
        const productName = material_summary[binKey] || "N/A";
        return {
          id: binNum.padStart(4, "0"),
          product: productName,
          weight: weight || 0,
        };
      });

    // Build receiver row
    const receiverBinDisplay = receiver_bin_id ? String(receiver_bin_id).padStart(4, "0") : "0000";
    const receiverRows = [{
      id: receiverBinDisplay,
      product: "Output",
      location: "Output Bin",
      weight: total_receiver_weight || 0
    }];

    const senderActualWeight = senderRows.reduce((sum, row) => sum + (row.weight || 0), 0);
    const receiverActualWeight = total_receiver_weight;
    const consumedWeight = senderActualWeight;
    const producedWeight = receiverActualWeight;

    return (
      <div
        className="bg-white dark:bg-[#232c3d] rounded-2xl p-6 w-full px-4 md:px-10 xl:px-20 mx-auto mt-4 mb-8 border border-gray-300 dark:border-gray-700 dark:text-gray-100"
        style={{ boxSizing: "border-box" }}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <div>
            <div className="font-bold text-lg mb-1">Line Running</div>
            <div className="text-blue-700 font-semibold">FTRA</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">
              Produced: <span>{Math.abs(Number(producedWeight)).toFixed(1)} kg</span>
            </div>
            <div className="font-semibold">
              Consumed: {Math.abs(Number(consumedWeight)).toFixed(1)} kg
            </div>
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
              {senderRows.length > 0 ? senderRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.id}</td>
                  <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">{row.product}</td>
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                    {Math.abs(parseFloat(row.weight)).toFixed(1)} kg
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">No sender data</td>
                </tr>
              )}
              <tr className="font-semibold bg-zinc-100 dark:bg-zinc-700">
                <td colSpan={2} className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">Actual weight</td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                  {Math.abs(senderActualWeight).toFixed(1)} kg
                </td>
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
                  <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">
                    {Math.abs(parseFloat(row.weight)).toFixed(1)} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Setpoints Section - Micro Ingredient 1 */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Micro Ingredient 1</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Parameter</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Feeder 3 Target %</td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(feeder_3_target).toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Feeder 3 Selected</td>
                <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                  <input type="checkbox" checked={!!feeder_3_selected} readOnly className="w-4 h-4 cursor-default" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Micro Ingredient 2 */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Micro Ingredient 2</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Parameter</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Feeder 4 Target %</td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(feeder_4_target).toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Feeder 4 Selected</td>
                <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                  <input type="checkbox" checked={!!feeder_4_selected} readOnly className="w-4 h-4 cursor-default" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Micro Ingredient 3 */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Micro Ingredient 3</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Parameter</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Feeder 5 Target %</td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(feeder_5_target).toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Feeder 5 Selected</td>
                <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                  <input type="checkbox" checked={!!feeder_5_selected} readOnly className="w-4 h-4 cursor-default" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Micro Ingredient 4 */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Micro Ingredient 4</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Parameter</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Feeder 6 Target %</td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(feeder_6_target).toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Feeder 6 Selected</td>
                <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                  <input type="checkbox" checked={!!feeder_6_selected} readOnly className="w-4 h-4 cursor-default" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Discharger Speed */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Discharger Speed</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Parameter</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Speed Discharge 50%</td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(speed_discharge_50).toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Speed Discharge 51-55%</td>
                <td className="border px-2 py-1 text-right dark:border-gray-700 dark:text-gray-100">{Number(speed_discharge_51_55).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Filter Flour Destination */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Filter Flour Destination</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#1a2233] dark:text-gray-100">
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Parameter</th>
                <th className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Bag Collection</td>
                <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                  <input type="checkbox" checked={!!bag_collection} readOnly className="w-4 h-4 cursor-default" />
                </td>
              </tr>
              <tr>
                <td className="border px-2 py-1 dark:border-gray-700 dark:text-gray-100">Mixing Screw</td>
                <td className="border px-2 py-1 text-center dark:border-gray-700 dark:text-gray-100">
                  <input type="checkbox" checked={!!mixing_screw} readOnly className="w-4 h-4 cursor-default" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Records footer */}
        <div className="text-xs text-gray-500">Records: {record_count || 0}</div>
      </div>
    );
  }

  function MilaSummaryLayout({ summary, filterStart, filterEnd }) {
    if (!summary) return <div>No summary data available</div>;
    
    // ✅ Helper function to remove UOM from labels
    const removeUOM = (label) => {
      if (!label) return label;
      // Remove (kg), (kg/h), (kg/s), (%), (Bool), etc.
      return label.replace(/\s*\(.*?\)\s*$/g, '').trim();
    };
    
    // ✅ Handle error messages - Simple "No records found" message
    if (summary.error) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              No records found
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-500">
              No data available for the selected time range
            </div>
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
      start_time,
      end_time,
      mila_totalizers_at_order_start: tzStart = {},
      mila_totalizers_at_order_end: tzEnd = {},
    } = summary;

    const hasUserFilterRange =
      String(filterStart || '').trim() !== '' && String(filterEnd || '').trim() !== '';
    const scaleTotalizersRangeSubtitle = hasUserFilterRange
      ? `${new Date(filterStart).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} → ${new Date(filterEnd).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
      : `${formatMilaSummaryDateTime(start_time)} → ${formatMilaSummaryDateTime(end_time)}`;

    const hasAnyScaleTotalizer = MILA_SCALE_TOTALIZER_CARD_ROWS.some(
      ({ key }) =>
        getMilaTotalizerKgFromDict(tzStart, key) != null ||
        getMilaTotalizerKgFromDict(tzEnd, key) != null
    );

    // ✅ Build Receiver rows - one row per bin with per-bin weight (including 0)
    const receiverRows = [];
    
    // Build receiver rows from receiver_weight_totals (keyed by bin_id from backend)
    if (receiver_weight_totals) {
      Object.entries(receiver_weight_totals).forEach(([key, data]) => {
        // ✅ Handle new structure: data is an object with bin_id, material_code, material_name, weight_kg
        let binId, materialName, weight;
        
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
          // New structure: { bin_id, material_code, material_name, weight_kg }
          binId = data.bin_id || data.material_code || key;  // ✅ Use bin_id first, fallback to material_code
          materialName = data.material_name || key;
          weight = data.weight_kg || 0;
        } else {
          // Old structure: just a number (fallback)
          binId = key;
          materialName = key;
          weight = typeof data === 'number' ? data : 0;
        }
        
        const cleanBinId = removeUOM(String(binId));
        const cleanName = removeUOM(materialName);
        
        // ✅ Use per-bin weight so each bin shows its own value (including 0)
        receiverRows.push({
          id: cleanBinId,
          name: cleanName || 'Flour Silo',
          weight: weight,
        });
      });
    }

    // ✅ Build branReceiverRows in the correct order:
    // 1-4: Produced items (Semolina, MILA_Flour1, 9105 Bran fine, 9106 Bran coarse)
    // 5: Actual weight (sum of 1-4)
    // 6: B1Scale (consumed weight)
    
    const branReceiverRows = [];
    
    // Extract weights from bran_receiver_totals
    let semolinaWeight = 0;
    let milaFlour1Weight = 0;
    let branFineWeight = 0;
    let branCoarseWeight = 0;
    let b1ScaleWeight = 0;
    
    if (bran_receiver_totals) {
      // Semolina
      semolinaWeight = bran_receiver_totals['Semolina (kg)'] || 
                       bran_receiver_totals['Semolina'] || 
                       bran_receiver_totals['9103 Durum Semolina'] || 0;
      
      // MILA_Flour1
      milaFlour1Weight = bran_receiver_totals['MILA_Flour1 (kg)'] || 
                         bran_receiver_totals['MILA_Flour1'] || 0;
      
      // 9105 Bran fine
      branFineWeight = bran_receiver_totals['9105 Bran fine (kg)'] || 
                       bran_receiver_totals['9105 Bran fine'] || 
                       bran_receiver_totals['Bran fine'] || 0;
      
      // 9106 Bran coarse
      branCoarseWeight = bran_receiver_totals['9106 Bran coarse (kg)'] || 
                         bran_receiver_totals['9106 Bran coarse'] || 
                         bran_receiver_totals['Bran coarse'] || 0;
      
      // B1Scale (consumed weight)
      b1ScaleWeight = bran_receiver_totals['B1Scale (kg)'] || 
                      bran_receiver_totals['B1Scale'] || 
                      bran_receiver_totals['B1 Scale'] || 
                      bran_receiver_totals['MILA_B1_scale (kg)'] || 0;
    }
    
    // Main Scale row (B1 - shown in separate table)
    const mainScaleRow = {
      id: 'B1',
      name: 'B1',
      weight: b1ScaleWeight
    };
    
    // F2 Scale (kg) - from archive bran_receiver_totals
    const f2ScaleWeight = (bran_receiver_totals && (bran_receiver_totals['F2 Scale (kg)'] ?? bran_receiver_totals['F2 Scale'])) || 0;
    
    // Row 1: F1
    branReceiverRows.push({
      id: 'F1',
      name: 'F1',
      weight: milaFlour1Weight,
      isProduced: true
    });
    
    // Row 2: F2
    branReceiverRows.push({
      id: 'F2',
      name: 'F2',
      weight: f2ScaleWeight,
      isProduced: true
    });
    
    // Row 3: Bran coarse
    branReceiverRows.push({
      id: 'Bran coarse',
      name: 'Bran coarse',
      weight: branCoarseWeight,
      isProduced: true
    });
    
    // Row 4: Bran fine
    branReceiverRows.push({
      id: 'Bran fine',
      name: 'Bran fine',
      weight: branFineWeight,
      isProduced: true
    });
    
    // Row 5: semolina
    branReceiverRows.push({
      id: 'semolina',
      name: 'semolina',
      weight: semolinaWeight,
      isProduced: true
    });
    
    // Row 6: Actual weight (sum of produced items - at bottom)
    const actualProducedWeight = semolinaWeight + milaFlour1Weight + branFineWeight + branCoarseWeight;
    branReceiverRows.push({
      id: 'Actual weight',
      name: 'Actual weight',
      weight: actualProducedWeight,
      isActualWeight: true  // Flag for styling
    });

    // ✅ Use actualProducedWeight for the "Produced" display at the top
    const displayProducedWeight = actualProducedWeight;

    // ✅ Build yield log rows with proper order matching Bran Receiver
    const yieldLogRows = [];
    
    // Define the desired order for yield log items
    const yieldLogOrder = ['Yield Max Flow', 'Yield Min Flow', 'B1', 'F1', 'F2', 'Bran coarse', 'Bran fine', 'semolina'];
    
    // Build a map of display key -> row object
    const yieldLogMap = {};
    
    if (average_yield_flows) {
      Object.entries(average_yield_flows).forEach(
        ([key, value]) => {
          console.log('[Yield Flow Debug]', key, value); // DEBUG
          let displayKey = removeUOM(key);
          const numVal = parseFloat(value);
          
          // ✅ FORCE kg/s for flow items
          let uom = "kg";
          if (displayKey.toLowerCase().indexOf("flow") !== -1) {
             uom = "kg/s";
          }
          
          let displayValue = !isNaN(numVal) ? numVal.toFixed(3) + " " + uom : value + " " + uom;
          yieldLogMap[displayKey] = { key: displayKey, value: displayValue };
        }
      );
    }
    if (average_yield_log) {
      Object.entries(average_yield_log).forEach(
        ([key, value]) => {
          let displayKey = removeUOM(key);
          
          // ✅ Rename keys as requested
          if (displayKey === 'MILA_B1') displayKey = 'B1';
          if (displayKey === 'MILA_Flour1') displayKey = 'F1';
          if (displayKey === 'MILA_BranCoarse') displayKey = 'Bran coarse';
          if (displayKey === 'MILA_BranFine') displayKey = 'Bran fine';
          if (displayKey === 'MILA_Semolina') displayKey = 'semolina';
          if (displayKey === 'flow_percentage') displayKey = 'F2';

          yieldLogMap[displayKey] = { key: displayKey, value: value + " %" };
        }
      );
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

    // ✅ Consumed weight = B1Scale only (input to the process)
    const calculatedConsumedWeight = b1ScaleWeight;

    return (
      <div className="bg-white dark:bg-[#1a2233] rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <div>
            <div className="font-bold text-lg mb-1">Line Running</div>
            <div className="text-blue-700 font-semibold">MIL-A</div>
            <div className="text-gray-500">Status: Running</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">
              Produced:{" "}
              <span>
                {Math.abs(displayProducedWeight || 0).toFixed(1)} kg
              </span>
            </div>
            <div className="font-semibold">
              Consumed: {Math.abs(calculatedConsumedWeight || 0).toFixed(1)} kg
            </div>
          </div>
        </div>

        {/* Receiver Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Receiver</div>
          <table className="w-full border mb-1">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">
                  Identific Product ident
                </th>
                <th className="border px-2 py-1">Product name</th>
                <th className="border px-2 py-1">Weight</th>
              </tr>
            </thead>
            <tbody>
              {receiverRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{row.id}</td>
                  <td className="border px-2 py-1">{row.name}</td>
                  <td className="border px-2 py-1 text-right">
                    {Math.abs(parseFloat(row.weight)).toFixed(1)} kg
                  </td>
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
                <th className="border px-2 py-1">
                  Identific Product ident
                </th>
                <th className="border px-2 py-1">Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">{mainScaleRow.id}</td>
                <td className="border px-2 py-1 text-right">
                  {Math.abs(parseFloat(mainScaleRow.weight)).toFixed(1)} kg
                </td>
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
                <th className="border px-2 py-1">
                  Identific Product ident
                </th>
                <th className="border px-2 py-1">Weight</th>
              </tr>
            </thead>
            <tbody>
              {branReceiverRows.map((row, i) => (
                <tr 
                  key={i}
                  className={row.isActualWeight ? 'font-semibold bg-zinc-100 dark:bg-zinc-700' : ''}
                >
                  <td className="border px-2 py-1">{row.id}</td>
                  <td className="border px-2 py-1 text-right">
                    {Math.abs(parseFloat(row.weight)).toFixed(1)} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasAnyScaleTotalizer && (
          <div className="mb-6">
            <div className="font-semibold mb-2">Scale totalizers</div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              {scaleTotalizersRangeSubtitle}
            </div>
            <table className="w-full border mb-1">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1 text-left">Scale</th>
                  <th className="border px-2 py-1 text-right">Start (kg)</th>
                  <th className="border px-2 py-1 text-right">End (kg)</th>
                </tr>
              </thead>
              <tbody>
                {MILA_SCALE_TOTALIZER_CARD_ROWS.map(({ label, key }) => (
                  <tr key={key}>
                    <td className="border px-2 py-1">{label}</td>
                    <td className="border px-2 py-1 text-right">
                      {formatMilaTotalizerKg(getMilaTotalizerKgFromDict(tzStart, key))}
                    </td>
                    <td className="border px-2 py-1 text-right">
                      {formatMilaTotalizerKg(getMilaTotalizerKgFromDict(tzEnd, key))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Yield Log Section */}
        <div className="mb-6">
          <div className="font-semibold mb-2">Yield Log</div>
          <table className="w-full border mb-1">
            <tbody>
              {yieldLogRows.map((row, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{row.key}</td>
                  <td className="border px-2 py-1 text-right">
                    {row.value}
                  </td>
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
              {average_setpoints_percentages &&
                Object.entries(average_setpoints_percentages)
                // Filter out keys the user wants to remove
                .filter(([key]) => {
                  const lowerKey = key.toLowerCase();
                  if (lowerKey.indexOf('depot') !== -1) return false;
                  if (lowerKey.indexOf('flap') !== -1) return false;
                  if (lowerKey.indexOf('mila_2') !== -1) return false;
                  if (lowerKey.indexOf('b789we') !== -1) return false;
                  return true;
                })
                .map(([key, value], i) => {
                  // Replace "Feeder" with "Microd feeder" and remove UOM
                  let displayKey = key.replace(/Feeder/g, 'Microd feeder');
                  displayKey = removeUOM(displayKey);
                  
                  // Check if this is a boolean field
                  const isBooleanField = key.includes('Bool') || key.includes('Enabled') || key.includes('Selected');
                  
                  // Check if this is a percentage/target field
                  const isPercentageField = key.includes('%') || key.includes('Target');
                  
                  // Check if this is t/h field (Order Scale Flowrate)
                  const isTonPerHour = key.includes('t/h');
                  
                  return (
                  <tr key={i}>
                      <td className="border px-2 py-1">{displayKey}</td>
                    <td className="border px-2 py-1 text-right">
                      {isBooleanField ? (
                        <div className="flex justify-end">
                          <input
                            type="checkbox"
                            checked={value === true || value === 1 || value === '1' || value === 'true'}
                            readOnly
                            className="w-4 h-4 cursor-default"
                          />
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

  const renderTable = () => {
    if (selectedPeriod === "Full Report") {
      return null;
    }

    if (selectedReport === "MIL-A") {
      // Always show formatted layout for MIL-A (not raw table)
      if (loading) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-lg text-gray-600">Loading MIL-A summary...</div>
          </div>
        );
      }

      // If we have summary data from API, use it
      if (milaSummaryData) {
        return (
          <MilaSummaryLayout
            summary={milaSummaryData}
            filterStart={startDate}
            filterEnd={endDate}
          />
        );
      }

      // Otherwise, compute summary from filteredData (fallback - use DELTA calculation)
      if (filteredData && filteredData.length >= 2) {
        console.log('[MIL-A Fallback] ⚠️ Using fallback delta calculation for', filteredData.length, 'records');
        
        // Get FIRST and LAST records for delta calculation
        const firstRecord = filteredData[0];
        const lastRecord = filteredData[filteredData.length - 1];
        
        // Calculate delta for produced_weight (though it's a flow rate, so this is questionable)
        const firstProduced = parseFloat(firstRecord.produced_weight) || 0;
        const lastProduced = parseFloat(lastRecord.produced_weight) || 0;
        
        const firstBran = typeof firstRecord.bran_receiver === 'string' ? JSON.parse(firstRecord.bran_receiver) : (firstRecord.bran_receiver || {});
        const lastBran = typeof lastRecord.bran_receiver === 'string' ? JSON.parse(lastRecord.bran_receiver) : (lastRecord.bran_receiver || {});

        const computedSummary = {
          total_produced_weight: lastProduced - firstProduced,
          bran_receiver_totals: {},
          average_yield_log: {},
          average_setpoints_percentages: {},
          average_yield_flows: {},
          receiver_weight_totals: {},
          record_count: filteredData.length,
          start_time: firstRecord.created_at,
          end_time: lastRecord.created_at,
          mila_totalizers_at_order_start: buildMilaScaleTotalizerSnapshotFromBran(firstBran),
          mila_totalizers_at_order_end: buildMilaScaleTotalizerSnapshotFromBran(lastBran),
        };

        // ✅ Calculate DELTA for bran_receiver (cumulative counters)
        
        Object.keys(lastBran).forEach(key => {
          const lastVal = parseFloat(lastBran[key]) || 0;
          const firstVal = parseFloat(firstBran[key]) || 0;
          const delta = lastVal - firstVal;
          computedSummary.bran_receiver_totals[key] = delta;
          console.log(`[MIL-A Fallback] ${key}: ${firstVal.toFixed(1)} -> ${lastVal.toFixed(1)} = ${delta.toFixed(1)} kg`);
        });

        // ✅ Calculate DELTA for receiver (flow rates - questionable to subtract)
        const firstReceiver = typeof firstRecord.receiver === 'string' ? JSON.parse(firstRecord.receiver) : (firstRecord.receiver || []);
        const lastReceiver = typeof lastRecord.receiver === 'string' ? JSON.parse(lastRecord.receiver) : (lastRecord.receiver || []);
        
        if (Array.isArray(lastReceiver)) {
          lastReceiver.forEach(lastRec => {
            const matCode = lastRec.material_code;
            const matName = lastRec.material_name;
            const lastWeight = parseFloat(lastRec.weight_kg) || 0;
            
            // Find matching receiver in first record
            const firstRec = firstReceiver.find(r => r.material_code === matCode && r.material_name === matName);
            const firstWeight = firstRec ? (parseFloat(firstRec.weight_kg) || 0) : 0;
            
            const delta = lastWeight - firstWeight;
            const name = matName || (matCode ? `Receiver ${matCode}` : 'Unknown');
            computedSummary.receiver_weight_totals[name] = delta;
          });
        }
        
        // Get yield_log and setpoints from LAST record (current values, not deltas)
        const lastYieldLog = typeof lastRecord.yield_log === 'string' ? JSON.parse(lastRecord.yield_log) : (lastRecord.yield_log || {});
        const lastSetpoints = typeof lastRecord.setpoints_produced === 'string' ? JSON.parse(lastRecord.setpoints_produced) : (lastRecord.setpoints_produced || {});
        
        // Extract flow values and percentages from last record
        Object.entries(lastYieldLog).forEach(([key, value]) => {
              if (key.includes('Flow')) {
            computedSummary.average_yield_flows[key] = parseFloat(value) || 0;
              } else {
            computedSummary.average_yield_log[key] = parseFloat(value) || 0;
          }
        });
        
        // Get setpoint percentages from last record
        Object.entries(lastSetpoints).forEach(([key, value]) => {
          if (key.includes('%') || key.includes('Bool')) {
            computedSummary.average_setpoints_percentages[key] = value;
          }
        });
        
        console.log('[MIL-A Fallback] ✅ Computed summary:', computedSummary);
        console.log('[MIL-A Fallback] Total Bran:', Object.values(computedSummary.bran_receiver_totals).reduce((a,b) => a+b, 0).toFixed(1), 'kg');

        console.log('[MIL-A] Computed summary from filteredData:', computedSummary);
        return (
          <MilaSummaryLayout
            summary={computedSummary}
            filterStart={startDate}
            filterEnd={endDate}
          />
        );
      }

      // If no summary data and no filtered data, show message
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">
            No MIL-A data available for the selected date range.
          </div>
        </div>
      );
    }

    if (
      selectedReport === "SCL" &&
      selectedPeriod !== "Full Report"
    ) {
      if (loading) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-lg text-gray-600">Loading SCL summary...</div>
          </div>
        );
      }
      
      if (sclSummaryData) {
        return (
          <SummaryCardLayout summary={sclSummaryData} reportType="SCL" />
        );
      }
      
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">
            No SCL data available for the selected date range.
          </div>
        </div>
      );
    }

    if (
      selectedReport === "FCL" &&
      selectedPeriod !== "Full Report"
    ) {
      if (loading) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-lg text-gray-600">Loading FCL summary...</div>
          </div>
        );
      }
      
      if (fclSummaryData) {
        return (
          <SummaryCardLayout
            summary={fclSummaryData}
            reportType="FCL"
            filterStart={startDate}
            filterEnd={endDate}
          />
        );
      }
      
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">
            No FCL data available for the selected date range.
          </div>
        </div>
      );
    }

    if (
      selectedReport === "FTRA" &&
      selectedPeriod !== "Full Report"
    ) {
      if (loading) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-lg text-gray-600">Loading FTRA summary...</div>
          </div>
        );
      }
      
      if (ftraSummaryData) {
        return (
          <FTRASummaryLayout summary={ftraSummaryData} />
        );
      }
      
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-lg text-gray-600">
            No FTRA data available for the selected date range.
          </div>
        </div>
      );
    }

    // For Full Report or unsupported report types
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">
          Please select a period (Daily, Weekly, or Monthly) to view the report.
        </div>
      </div>
    );
  };

  const handleSort = (field) => {
    const direction =
      sortField === field && sortDirection === "asc"
        ? "desc"
        : "asc";
    setSortField(field);
    setSortDirection(direction);
    const sortedData = sortData(filteredData, field, direction);
    setFilteredData(sortedData);
  };

  const renderSortIcon = (field) => {
    if (sortField === field) {
      return sortDirection === "asc" ? " ↑" : " ↓";
    }
    return "";
  };

  // 🔄 Fetch MILA summary data when filters change
  useEffect(() => {
    const { start, end } = computeRange();

    console.log('[MIL-A Summary] Effect triggered:', {
      selectedReport,
      selectedPeriod,
      startDate,
      endDate,
      computedStart: start,
      computedEnd: end
    });

    if (
      selectedReport === "MIL-A" &&
      selectedPeriod !== "Full Report" &&
      start &&
      end
    ) {
      // ✅ Validate that start and end are different
      if (start.getTime() === end.getTime()) {
        console.error('[MIL-A Delta] ❌ Start and End dates are the same:', {
              start: start.toISOString(),
          end: end.toISOString()
        });
        setMilaSummaryData({
          error: true,
          message: '⚠️ Start and End dates must be different. Please select a time range with at least 1 hour difference.'
        });
              setLoading(false);
              return;
            }
            
      // ✅ Check minimum time difference (at least 30 minutes)
      const timeDiffMs = end.getTime() - start.getTime();
      const timeDiffMinutes = timeDiffMs / (1000 * 60);
      
      if (timeDiffMinutes < 30) {
        console.warn('[MIL-A Delta] ⚠️ Time range is very short:', {
          start: start.toISOString(),
          end: end.toISOString(),
          diffMinutes: timeDiffMinutes.toFixed(1)
        });
      }
      
      const fetchMilaSummary = async () => {
        setLoading(true);
        console.log('[MIL-A Delta] Fetching summary from backend:', {
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          timeDiffHours: (timeDiffMs / (1000 * 60 * 60)).toFixed(2)
        });
        try {
          // ✅ Call backend endpoint that calculates deltas
          const response = await axios.get("orders/mila/archive/summary", {
            params: {
              start_date: start.toISOString(),
              end_date: end.toISOString()
            }
          });
          
          // ✅ Backend now handles all delta calculations
          if (response.data && response.data.status === "success" && response.data.summary) {
            const summary = response.data.summary;
            console.log('[MIL-A Delta] ✅ Received summary from backend:', summary);
            console.log('[MIL-A Delta] bran_receiver_totals:', summary.bran_receiver_totals);
            console.log('[MIL-A Delta] Total Bran:', Object.values(summary.bran_receiver_totals || {}).reduce((a,b) => a+b, 0), 'kg');
            setMilaSummaryData(summary);
          } else {
            setMilaSummaryData(null);
            console.error('[MIL-A Delta] ❌ Invalid response from backend:', response.data);
          }
        } catch (error) {
          console.error("Error fetching MILA delta:", error);
          console.error("Error details:", error.response?.data);
          
          // ✅ Show user-friendly error message
          if (error.response && error.response.status === 400) {
            const backendMsg = error.response.data?.message || '⚠️ Not enough data in selected time range. Need at least 2 records for delta calculation.';
            const dbStats = error.response.data?.database_stats;
            
            let fullMessage = backendMsg;
            if (dbStats && dbStats.total_records > 0) {
              fullMessage += `\n\nℹ️ Tip: Try selecting a date range between ${new Date(dbStats.earliest).toLocaleString()} and ${new Date(dbStats.latest).toLocaleString()}`;
            }
            
            setMilaSummaryData({
              error: true,
              message: fullMessage,
              database_stats: dbStats
            });
              } else {
            setMilaSummaryData({
              error: true,
              message: '❌ Error loading MILA data: ' + (error.message || 'Unknown error')
            });
          }
        } finally {
          setLoading(false);
        }
      };

      fetchMilaSummary();
    } else if (
      selectedReport === "MIL-A" &&
      selectedPeriod === "Full Report"
    ) {
      setMilaSummaryData(null);
    }
  }, [selectedReport, selectedPeriod, startDate, endDate]);

  // 🔄 Fetch SCL summary with DELTA calculation
  useEffect(() => {
    const { start, end } = computeRange();

    if (
      selectedReport === "SCL" &&
      selectedPeriod !== "Full Report" &&
      start &&
      end
    ) {
      const fetchSclSummary = async () => {
        setLoading(true);
        console.log('[SCL Delta] Fetching summary from backend:', {
          start_date: start.toISOString(),
          end_date: end.toISOString()
        });
        try {
          // ✅ Call backend endpoint that calculates deltas
          const response = await axios.get("orders/scl/archive/summary", {
            params: {
              start_date: start.toISOString(),
              end_date: end.toISOString()
            }
          });
          
          // ✅ Backend now handles all delta calculations
          if (response.data && response.data.status === "success" && response.data.summary) {
            const summary = response.data.summary;
            console.log('[SCL Delta] ✅ Received summary from backend:', summary);
            console.log('[SCL Delta] per_bin_weight_totals:', summary.per_bin_weight_totals);
            console.log('[SCL Delta] material_summary:', summary.material_summary);
            console.log('[SCL Delta] receiver_weight:', summary.receiver_weight);
            console.log('[SCL Delta] receiver_bin_id:', summary.receiver_bin_id);
            console.log('[SCL Delta] total_produced_weight:', summary.total_produced_weight);
            console.log('[SCL Delta] total_receiver_weight:', summary.total_receiver_weight);
            setSclSummaryData(summary);
          } else {
            setSclSummaryData(null);
            console.warn('[SCL Delta] ❌ Invalid response from backend');
          }
        } catch (error) {
          console.error("Error fetching SCL delta:", error);
          setSclSummaryData(null);
        } finally {
          setLoading(false);
        }
      };
      fetchSclSummary();
    } else if (
      selectedReport === "SCL" &&
      selectedPeriod === "Full Report"
    ) {
      setSclSummaryData(null);
    }
  }, [selectedReport, selectedPeriod, startDate, endDate]);

  // 🔄 Fetch FCL summary with DELTA calculation
  useEffect(() => {
    const { start, end } = computeRange();

    if (
      selectedReport === "FCL" &&
      selectedPeriod !== "Full Report" &&
      start &&
      end
    ) {
      const fetchFclSummary = async () => {
        setLoading(true);
        console.log('[FCL Delta] Fetching summary from backend:', {
          start_date: start.toISOString(),
          end_date: end.toISOString()
        });
        try {
          // ✅ Call backend endpoint that calculates deltas
          const response = await axios.get("orders/fcl/archive/summary", {
            params: {
              start_date: start.toISOString(),
              end_date: end.toISOString()
            }
          });
          
          // ✅ Backend now handles all delta calculations
          if (response.data && response.data.status === "success" && response.data.summary) {
            const summary = response.data.summary;
            console.log('[FCL Delta] Received summary from backend:', summary);
            setFclSummaryData(summary);
          } else {
            setFclSummaryData(null);
            console.warn('[FCL Delta] Invalid response from backend');
          }
        } catch (error) {
          console.error("Error fetching FCL delta:", error);
          setFclSummaryData(null);
        } finally {
          setLoading(false);
        }
      };
      fetchFclSummary();
    } else if (
      selectedReport === "FCL" &&
      selectedPeriod === "Full Report"
    ) {
      setFclSummaryData(null);
    }
  }, [selectedReport, selectedPeriod, startDate, endDate]);

  // 🔄 Fetch FTRA summary
  useEffect(() => {
    const { start, end } = computeRange();

    if (
      selectedReport === "FTRA" &&
      selectedPeriod !== "Full Report" &&
      start &&
      end
    ) {
      const fetchFtraSummary = async () => {
        setLoading(true);
        console.log('[FTRA] Fetching summary from backend:', {
          start_date: start.toISOString(),
          end_date: end.toISOString()
        });
        try {
          const response = await axios.get("orders/ftra/archive/summary", {
            params: {
              start_date: start.toISOString(),
              end_date: end.toISOString()
            }
          });
          
          if (response.data && response.data.status === "success" && response.data.summary) {
            const summary = response.data.summary;
            console.log('[FTRA] Received summary from backend:', summary);
            setFtraSummaryData(summary);
          } else {
            setFtraSummaryData(null);
            console.warn('[FTRA] Invalid response from backend');
          }
        } catch (error) {
          console.error("Error fetching FTRA summary:", error);
          setFtraSummaryData(null);
        } finally {
          setLoading(false);
        }
      };
      fetchFtraSummary();
    } else if (
      selectedReport === "FTRA" &&
      selectedPeriod === "Full Report"
    ) {
      setFtraSummaryData(null);
    }
  }, [selectedReport, selectedPeriod, startDate, endDate]);

  // 🔄 Fetch ALL archive data when report type changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let endpoint = "";
      if (selectedReport === "FCL")
        endpoint = "orders/archive/fcl/full";
      else if (selectedReport === "SCL")
        endpoint = "orders/archive/scl/full";
      else if (selectedReport === "MIL-A")
        endpoint = "orders/mila/archive/all";
      try {
        const response = await axios.get(endpoint);
        if (
          response.data &&
          response.data.status === "success" &&
          Array.isArray(response.data.data)
        ) {
          setAllData(response.data.data);
          setFilteredData(response.data.data);
        } else {
          setAllData([]);
          setFilteredData([]);
        }
      } catch (error) {
        setAllData([]);
        setFilteredData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedReport]);

  // 🔄 Filter data when period / date range changes
  useEffect(() => {
    if (!allData || allData.length === 0) {
      setFilteredData([]);
      return;
    }
    if (selectedPeriod === "Full Report") {
      setFilteredData(allData);
      return;
    }

    const { start, end } = computeRange();
    const filtered = filterDataByDateRange(allData, start, end);
    setFilteredData(filtered);
  }, [selectedPeriod, startDate, endDate, allData]);

  // 🔄 Set default range whenever period or report type changes
  useEffect(() => {
    const now = new Date();
    let defaultStart;
    let defaultEnd;
    
    if (selectedPeriod === "Hourly") {
      // For Hourly: Previous hour to current hour
      defaultStart = new Date(now);
      defaultStart.setMinutes(0, 0, 0);
      defaultStart.setHours(defaultStart.getHours() - 1); // 1 hour ago
      
      defaultEnd = new Date(now);
      defaultEnd.setMinutes(0, 0, 0); // Current hour start
    } else if (selectedPeriod === "Daily") {
      // For Daily: Yesterday 5 AM to Today 5 AM (production shift)
      defaultStart = new Date(now);
      defaultStart.setDate(defaultStart.getDate() - 1); // Yesterday
      defaultStart.setHours(5, 0, 0, 0); // 5 AM
      
      defaultEnd = new Date(now);
      defaultEnd.setHours(5, 0, 0, 0); // Today at 5 AM
    } else if (selectedPeriod === "Weekly") {
      // For Weekly: 7 days ago at 5 AM to today at 5 AM
      defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      defaultStart.setHours(5, 0, 0, 0);
      
      defaultEnd = new Date(now);
      defaultEnd.setHours(5, 0, 0, 0);
    } else if (selectedPeriod === "Monthly") {
      // For Monthly: 30 days ago at 5 AM to today at 5 AM
      defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      defaultStart.setHours(5, 0, 0, 0);
      
      defaultEnd = new Date(now);
      defaultEnd.setHours(5, 0, 0, 0);
    } else {
      // Full Report
      defaultStart = new Date(now);
      defaultStart.setHours(5, 0, 0, 0);
      
      defaultEnd = new Date(now);
      defaultEnd.setHours(5, 0, 0, 0);
    }

    const startStr = toLocalISOString(defaultStart);
    const endStr = toLocalISOString(defaultEnd);
    
    console.log('[Default Date Range Set]', {
      period: selectedPeriod,
      defaultStart: defaultStart.toLocaleString(),
      defaultEnd: defaultEnd.toLocaleString(),
      startStr,
      endStr
    });

    setStartDate(startStr);
    if (selectedPeriod !== "Full Report") {
      setEndDate(endStr);
    } else {
      setEndDate("");
    }
  }, [selectedReport, selectedPeriod]);

  // For heading text
  const getHeadingRangeText = () => {
    if (!startDate) return "";
    const start = new Date(startDate);
    let end;
    if (endDate) {
      end = new Date(endDate);
    } else {
      const { end: defaultEnd } = getPeriodRange(
        selectedPeriod,
        startDate
      );
      end = defaultEnd;
    }
    if (!end) return `(${start.toLocaleString()})`;
    return `(${start.toLocaleString()} to ${end.toLocaleString()})`;
  };

  // Get report type display name for title
  const getReportTypeDisplayName = () => {
    // Use the value directly, but format MIL-A properly
    if (selectedReport === "MIL-A") return "Mill-A";
    return selectedReport;
  };

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
        {/* Left: Hercules Logo */}
        <div className="print-header-left">
          <img
            src={herculesLogo}
            alt="Hercules Logo"
            className="print-logo"
          />
        </div>

        {/* Right: ASM and Salalah Logos */}
        <div className="print-header-right">
          <img
            src={asmLogo}
            alt="ASM Logo"
            className="print-logo-right"
          />
          <img
            src={salalahLogo}
            alt="Salalah Logo"
            className="print-logo-right"
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4 md:px-8 pt-2 pb-8">
      {/* 🔷 NEW FILTER BAR (white, horizontal, like dashboard filters but light) */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
          {/* Period buttons */}
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              Period
            </label>
            <div className="flex bg-gray-100 rounded-md p-1 gap-1">
              {PERIOD_OPTIONS.filter(
                (p) => p !== "Full Report"
              ).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition border ${selectedPeriod === period
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
                    }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Start Date & Time */}
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              Start Date & Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => {
                console.log('[Start Date Changed]', { 
                  oldValue: startDate, 
                  newValue: e.target.value,
                  parsed: new Date(e.target.value).toLocaleString()
                });
                setStartDate(e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* End Date & Time */}
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              End Date & Time
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => {
                console.log('[End Date Changed]', { 
                  oldValue: endDate, 
                  newValue: e.target.value,
                  parsed: new Date(e.target.value).toLocaleString()
                });
                setEndDate(e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* Report Type */}
          <div className="flex flex-col w-full md:w-48">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              Report Type
            </label>
            <select
              value={selectedReport}
              onChange={(e) =>
                setSelectedReport(e.target.value)
              }
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Print Button (still right aligned, no apply button as requested) */}
      {selectedPeriod !== "Full Report" && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 print:hidden text-sm font-semibold"
          >
            Print
          </button>
        </div>
      )}

      {/* Report container */}
      <div
        id="report-print-section"
        className="w-full bg-white rounded-2xl shadow-lg p-4 md:p-8 overflow-x-auto min-h-[calc(100vh-120px)] ml-0 mt-4 mr-0"
        style={{ boxSizing: "border-box" }}
      >
        {/* Print Header with Logos */}
        <PrintHeader />

        {/* Heading with date range */}
        {selectedPeriod !== "Full Report" && (
          <div className="mb-4 text-center font-semibold text-lg">
            {getReportTypeDisplayName()} {selectedPeriod} Report{" "}
            <span className="ml-2 text-gray-600 text-base">
              {getHeadingRangeText()}
            </span>
          </div>
        )}

        {renderTable()}
      </div>
    </div>
  );
};

export default NewReport;

