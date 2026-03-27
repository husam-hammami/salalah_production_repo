import React, { useState, useEffect } from 'react';
import { useSocket } from '../Context/SocketContext';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns'; // Make sure this is imported for time axis

const jobTypes = [
    { id: 9, name: 'FCL' },
    { id: 10, name: 'SDLA' },
    { id: 15, name: 'MIL-A' },
    { id: 16, name: 'FTRA' }
];

// ✅ Convert PLC bin ID to display format (211->021A, 212->021B, 213->021C)
function convertBinIdForDisplay(plcBinId) {
    if (plcBinId >= 210 && plcBinId <= 219) {
        const base = Math.floor(plcBinId / 10);  // 211 / 10 = 21
        const suffixNum = plcBinId % 10;  // 211 % 10 = 1
        
        if (suffixNum >= 1 && suffixNum <= 3) {
            // Convert 1->A, 2->B, 3->C
            const suffixLetter = String.fromCharCode(65 + suffixNum - 1);  // 65 is 'A'
            return `0${base}${suffixLetter}`;  // 021A, 021B, 021C
        }
    }
    
    // Default: pad with zeros (21 -> 0021)
    return plcBinId.toString().padStart(4, '0');
}

export default function Reports() {
    const [tab, setTab] = useState('daily');
    const [filters, setFilters] = useState({ batchId: '', productName: '', type: '', date: '' });
    const [filtered, setFiltered] = useState([]);
    const [reportData, setReportData] = useState({ daily: [], weekly: [], monthly: [] });
    const [selectedJobType, setSelectedJobType] = useState(jobTypes[0].id);
    const [fclSetpoints, setFclSetpoints] = useState(null);
    const [fclReceiver, setFclReceiver] = useState(null);
    const [sdlaSetpoints, setSdlaSetpoints] = useState(null);
    const [sdlaReceiverWeight, setSdlaReceiverWeight] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [liveData, setLiveData] = useState(null);
    const [initialSenderData, setInitialSenderData] = useState([]);
    const isFCL = selectedJobType === 9;

    // WebSocket connection
    const { socket, isConnected } = useSocket();

    // WebSocket event listeners for real-time data
    useEffect(() => {
        if (!socket) return;

        const handleFCLData = (data) => {
            if (selectedJobType === 9) {
                setLiveData(data);
                setFclSetpoints([
                    { id: 'Flowrate', value: data.flow_rate ?? '' },
                    { id: 'MoistureSetpoint', value: data.moisture_setpoint ?? '' },
                    { id: 'MoistureOffset', value: data.moisture_offset ?? '' },
                ]);
                setFclReceiver(data.receiver ?? null);
            }
        };

        const handleSCLData = (data) => {
            if (selectedJobType === 10) {
                setLiveData(data);
                
                // ✅ Process sender rows with flowrate_tph from ActiveSources
                const senderRows = data.ActiveSources?.map((source) => {
                    const weight = source.flowrate_tph ?? 0;
                    return {
                        id: source.bin_id.toString().padStart(4, '0'),
                        product: source.material?.material_name || 'N/A',
                        weight: `${weight.toFixed(3)} t/h`
                    };
                }) || [];
                
                const consumedWeight = senderRows.reduce((sum, row) => {
                    const val = parseFloat(row.weight);
                    return sum + (isNaN(val) ? 0 : val);
                }, 0);
                
                // ✅ Process receiver with actual DestBinId
                const receiverRows = [{
                    id: data.DestBinId?.toString().padStart(4, '0') || '0000',
                    product: data.DestMaterial?.material_name || 'Output Product',
                    location: 'Output Bin',
                    weight: (() => {
                        let receiverWeight = '';
                        if (data.FeederFlows && data.DestBinId) {
                            for (const key in data.FeederFlows) {
                                if (data.FeederFlows[key]?.bin_id === data.DestBinId) {
                                    receiverWeight = data.FeederFlows[key].value?.toFixed(3) + ' t/h';
                                    break;
                                }
                            }
                        }
                        return receiverWeight || '0.000 t/h';
                    })()
                }];
                
                // ✅ Update report data with formatted structure
                const formattedOrder = {
                    name: data.OS_Comment || 'Active Order',
                    type: 'SDLA',
                    produced: (data.ProducedWeight || 0).toFixed(1) + ' t/h',
                    consumed: consumedWeight.toFixed(1) + ' t/h',
                    sender: senderRows,
                    receiver: receiverRows,
                    setpoints: [
                        { id: 'Flowrate', value: data.Flowrate ?? '' },
                        { id: 'Moisture Setpoint', value: data.MoistureSetpoint ?? '' },
                        { id: 'Moisture Offset', value: data.MoistureOffset ?? '' },
                    ],
                    date: new Date().toISOString().split('T')[0],
                    line_running: data.JobStatusCode !== 5
                };
                
                setReportData({ daily: [formattedOrder], weekly: [], monthly: [] });
                setSdlaSetpoints(formattedOrder.setpoints);
                setSdlaReceiverWeight(data.ProducedWeight ?? null);
            }
        };

        const handleMILAData = (data) => {
            if (selectedJobType === 15) {
                setLiveData(data);

                // Format MILA data for display
                const DB499 = data.DB499 || {};
                const DB2099 = data.DB2099 || {};
                const branReceiver = data.bran_receiver || {};  // ✅ Bran Receiver Non-Erasable Weights

                // ✅ Get receiver product name from receiver_bins (enriched with material info)
                const receiverRows = [];
                const receiverBins = data.receiver_bins || [];
                
                console.log('[MILA Receiver] Debug:', {
                    receiver_bins: receiverBins,
                    receiver_bin_id_1: DB499.receiver_bin_id_1,
                    receiver_bin_id_2: DB499.receiver_bin_id_2,
                    flour2_receiver_bin_id_1: DB499.flour2_receiver_bin_id_1,
                    flour2_receiver_bin_id_2: DB499.flour2_receiver_bin_id_2,
                    yield_max_flow: DB2099.yield_max_flow,
                    yield_min_flow: DB2099.yield_min_flow
                });
                
                // Build a map of bin_id -> material for quick lookup
                const binMaterialMap = {};
                receiverBins.forEach(rec => {
                    if (rec.material) {
                        binMaterialMap[rec.bin_id] = rec.material;
                        console.log(`[MILA Receiver] Mapped bin ${rec.bin_id} -> ${rec.material.material_name}`);
                    }
                });
                
                // Row 1: Receiver Bin 1
                if (DB499.receiver_bin_id_1 && DB499.receiver_bin_id_1 !== 0) {
                    const material = binMaterialMap[DB499.receiver_bin_id_1];
                    console.log(`[MILA Receiver] Bin 1 lookup: ${DB499.receiver_bin_id_1} -> `, material);
                    receiverRows.push({
                        bin_id: DB499.receiver_bin_id_1,  // ✅ Explicitly pass bin_id for display
                        id_product: material?.material_code || '0051',
                        productName: material?.material_name || 'Unknown Product',
                        weight: DB2099.yield_max_flow || 0
                    });
                }

                // Row 2: Receiver Bin 2
                if (DB499.receiver_bin_id_2 && DB499.receiver_bin_id_2 !== 0) {
                    const material = binMaterialMap[DB499.receiver_bin_id_2];
                    console.log(`[MILA Receiver] Bin 2 lookup: ${DB499.receiver_bin_id_2} -> `, material);
                    receiverRows.push({
                        bin_id: DB499.receiver_bin_id_2,  // ✅ Explicitly pass bin_id for display
                        id_product: material?.material_code || '0055',
                        productName: material?.material_name || 'Unknown Product',
                        weight: DB2099.yield_min_flow || 0
                    });
                }

                // Flour 2 Active Receiver ID 1 (offset 172)
                if (DB499.flour2_receiver_bin_id_1 && DB499.flour2_receiver_bin_id_1 !== 0) {
                    const material = binMaterialMap[DB499.flour2_receiver_bin_id_1];
                    receiverRows.push({
                        bin_id: String(DB499.flour2_receiver_bin_id_1),
                        id_product: material?.material_code || '—',
                        productName: material?.material_name || 'Flour 2 Receiver 1',
                        weight: data.f2_scale?.flow_rate_tph ?? 0
                    });
                }
                // Flour 2 Active Receiver ID 2 (offset 214)
                if (DB499.flour2_receiver_bin_id_2 && DB499.flour2_receiver_bin_id_2 !== 0) {
                    const material = binMaterialMap[DB499.flour2_receiver_bin_id_2];
                    receiverRows.push({
                        bin_id: String(DB499.flour2_receiver_bin_id_2),
                        id_product: material?.material_code || '—',
                        productName: material?.material_name || 'Flour 2 Receiver 2',
                        weight: 0
                    });
                }

                const receiverTotal = receiverRows.reduce((sum, row) => sum + (row.weight || 0), 0);

                                    // ✅ Main Scale row (B1 - shown in separate table)
                                    const mainScaleRow = { id_product: 'B1', weight: branReceiver.b1 || 0 };
                                    
                                    // ✅ Use Bran Receiver Non-Erasable Weights from DB499 (in kg) - without B1
                                    const branReceiverRows = [
                                        { id_product: 'F1', weight: branReceiver.flour_1 || 0 },
                                        { id_product: 'F2', weight: data.f2_scale?.totalizer_kg ?? 0 },
                                        { id_product: 'Bran coarse', weight: branReceiver.bran_coarse || 0 },
                                        { id_product: 'Bran fine', weight: branReceiver.bran_fine || 0 },
                                        { id_product: 'semolina', weight: branReceiver.semolina || 0 },
                                    ];
                const branReceiverTotal = branReceiverRows.reduce((sum, row) => sum + (row.weight || 0), 0);

                const weightProduced = receiverTotal + branReceiverTotal;

                // ✅ Yield Log: F2 next to F1 (Yield Max/Min, B1, F1, F2, Bran coarse, Bran fine, semolina)
                const yieldLogRows = [
                    { formula: 'Yield Max Flow', value: `${((DB2099.yield_max_flow || 0) * 1000 / 3600).toFixed(3)} kg/s` },
                    { formula: 'Yield Min Flow', value: `${((DB2099.yield_min_flow || 0) * 1000 / 3600).toFixed(3)} kg/s` },
                    { formula: 'B1', value: `${(DB2099.mila_b1 || 0).toFixed(2)} %` },
                    { formula: 'F1', value: `${(DB2099.mila_flour_1 || 0).toFixed(2)} %` },
                    { formula: 'F2', value: `${(data.f2_scale?.flow_percentage ?? 0).toFixed(2)} %` },
                    { formula: 'Bran coarse', value: `${(DB2099.mila_bran_coarse || 0).toFixed(2)} %` },
                    { formula: 'Bran fine', value: `${(DB2099.mila_bran_fine || 0).toFixed(2)} %` },
                    { formula: 'semolina', value: `${(DB2099.mila_semolina || 0).toFixed(2)} %` },
                ];

                const setpointsGroups = [
                    {
                        name: 'Scale Settings',
                        items: [
                            { identification: 'Order Scale Flowrate', value: `${(DB499.order_scale_flowrate || 0).toFixed(1)} t/h` }
                        ]
                    },
                    {
                        name: 'Microfeeder Selection',
                        items: [
                            { identification: 'Feeder 1 Target', value: `${(DB499.feeder_1_target || 0).toFixed(1)} %` },
                            { identification: 'Feeder 1 Selected', value: { type: 'checkbox', checked: DB499.feeder_1_selected || false } },
                            { identification: 'Feeder 2 Target', value: `${(DB499.feeder_2_target || 0).toFixed(1)} %` },
                            { identification: 'Feeder 2 Selected', value: { type: 'checkbox', checked: DB499.feeder_2_selected || false } }
                        ]
                    },
                    {
                        name: 'Mill Parameters',
                        items: [
                            { identification: 'E11', value: { type: 'checkbox', checked: DB499.e11_selected || false } },
                            { identification: 'E10', value: { type: 'checkbox', checked: DB499.e10_selected || false } },
                            { identification: 'B1 Deopt Emptying', value: { type: 'checkbox', checked: DB499.b1_deopt_emptying || false } },
                            { identification: 'Mill Emptying', value: { type: 'checkbox', checked: DB499.mill_emptying || false } }
                        ]
                    },
                    {
                        name: 'Other',
                        items: [
                            { identification: 'B1 Scale1', value: { type: 'checkbox', checked: DB499.b1_scale1 || false } },
                            { identification: 'B3 Chocke Feeder', value: { type: 'checkbox', checked: DB499.b3_chocke_feeder || false } },
                            { identification: 'Filter Flour Feeder', value: { type: 'checkbox', checked: DB499.filter_flour_feeder || false } }
                        ]
                    }
                ];

                const formattedMilaData = {
                    name: DB499.linning_running ? 'line Running' : 'line Stopped',
                    type: 'MIL-A',
                    line_running: DB499.linning_running || false,
                    produced: `${weightProduced.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`,
                    consumed: `${weightProduced.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`,
                    receiver: {
                        title: 'Receiver',
                        rows: receiverRows,
                        total: `${receiverTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`
                    },
                    mainScale: {
                        title: 'Main Scale',
                        row: mainScaleRow
                    },
                    branReceiver: {
                        title: 'Bran Receiver',
                        rows: branReceiverRows,
                        total: `${branReceiverTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg`  // ✅ Changed from t/h to kg
                    },
                    yieldLog: {
                        title: 'Yield Log',
                        rows: yieldLogRows,
                    },
                    setpoints: {
                        title: 'Setpoints',
                        groups: setpointsGroups,
                    }
                };

                setReportData({ daily: [formattedMilaData], weekly: [], monthly: [] });
            }
        };

        const handleFTRAData = (data) => {
            if (selectedJobType === 16) {
                setLiveData(data);
                
                // Format sender rows from ActiveSources - Convert t/h to kg/h (multiply by 1000)
                const senderRows = data.ActiveSources?.map((source) => {
                    const weightTph = source.weight || 0;
                    const weightKgh = weightTph * 1000; // Convert t/h to kg/h
                    return {
                        id: source.bin_id?.toString().padStart(4, '0') || '0000',
                        product: source.prd_name || source.material?.material_name || 'N/A',
                        weight: `${weightKgh.toFixed(3)} kg`
                    };
                }) || [];
                
                const consumedWeight = senderRows.reduce((sum, row) => {
                    const val = parseFloat(row.weight);
                    return sum + (isNaN(val) ? 0 : val);
                }, 0);
                
                // Format receiver row - Convert t/h to kg/h
                const receiverRows = [{
                    id: data.ReceiverBinId?.toString().padStart(4, '0') || '0000',
                    product: data.ReceiverMaterial?.material_name || 'Output Product',
                    location: 'Output Bin',
                    weight: `${consumedWeight.toFixed(3)} kg`
                }];
                
                // Format setpoints with grouped headings - Filter Flour Destination FIRST
                const setpointsGroups = [
                    {
                        name: 'Filter Flour Destination',
                        items: [
                            { identification: 'Bag Collection', value: { type: 'checkbox', checked: data.BagCollection || false } },
                            { identification: 'Mixing Screw', value: { type: 'checkbox', checked: data.MixingScrew || false } }
                        ]
                    },
                    {
                        name: 'Micro Ingredient 1',
                        items: [
                            { identification: 'Feeder 3 Target %', value: `${(data.Feeder3TargetPercent || 0).toFixed(1)} %` },
                            { identification: 'Feeder 3 Selected', value: { type: 'checkbox', checked: data.Feeder3Selected || false } }
                        ]
                    },
                    {
                        name: 'Micro Ingredient 2',
                        items: [
                            { identification: 'Feeder 4 Target %', value: `${(data.Feeder4TargetPercent || 0).toFixed(1)} %` },
                            { identification: 'Feeder 4 Selected', value: { type: 'checkbox', checked: data.Feeder4Selected || false } }
                        ]
                    },
                    {
                        name: 'Micro Ingredient 3',
                        items: [
                            { identification: 'Feeder 5 Target %', value: `${(data.Feeder5TargetPercent || 0).toFixed(1)} %` },
                            { identification: 'Feeder 5 Selected', value: { type: 'checkbox', checked: data.Feeder5Selected || false } }
                        ]
                    },
                    {
                        name: 'Micro Ingredient 4',
                        items: [
                            { identification: 'Feeder 6 Target %', value: `${(data.Feeder6TargetPercent || 0).toFixed(1)} %` },
                            { identification: 'Feeder 6 Selected', value: { type: 'checkbox', checked: data.Feeder6Selected || false } }
                        ]
                    },
                    {
                        name: 'Discharger Speed',
                        items: [
                            { identification: 'Speed Discharge 50 %', value: `${(data.SpeedDischarge50Percent || 0).toFixed(1)} %` },
                            { identification: 'Speed Discharge 51-55 %', value: `${(data.SpeedDischarge51_55Percent || 0).toFixed(1)} %` }
                        ]
                    }
                ];
                
                const formattedOrder = {
                    name: 'FTRA Live Monitor',
                    type: 'FTRA',
                    produced: `${(consumedWeight / 1000).toFixed(1)} t/h`, // Keep produced/consumed in t/h for summary
                    consumed: `${(consumedWeight / 1000).toFixed(1)} t/h`,
                    sender: senderRows,
                    receiver: receiverRows,
                    setpoints: {
                        title: 'Setpoints',
                        groups: setpointsGroups
                    },
                    date: new Date().toISOString().split('T')[0],
                    line_running: data.OrderActive === true || data.OrderActive === 1 // Use OrderActive from offset 106 (1=running, 0=stopped)
                };
                
                setReportData({ daily: [formattedOrder], weekly: [], monthly: [] });
            }
        };

        socket.on('fcl_data', handleFCLData);
        socket.on('scl_data', handleSCLData);
        socket.on('mila_data', handleMILAData);
        socket.on('ftra_data', handleFTRAData);

        return () => {
            socket.off('fcl_data', handleFCLData);
            socket.off('scl_data', handleSCLData);
            socket.off('mila_data', handleMILAData);
            socket.off('ftra_data', handleFTRAData);
        };
    }, [socket, selectedJobType]);

    useEffect(() => {
        let isMounted = true;
        async function loadReport() {
            try {
                if (isMounted) setLoading(true);
                if (isMounted) setFclSetpoints(null);
                if (isMounted) setFclReceiver(null);
                if (isMounted) setSdlaSetpoints(null);
                if (isMounted) setSdlaReceiverWeight(null);
                if (isMounted) setReportData({ daily: [], weekly: [], monthly: [] });

                const selectedJobTypeName = jobTypes.find(jt => jt.id === selectedJobType)?.name;

                if (selectedJobTypeName === 'MIL-A') {
                    const res = await fetch('/orders/plc/db499-db2099-monitor');
                    if (!res.ok) throw new Error('API error');
                    const data = await res.json();

                    // ✅ Get receiver product name from receiver_bins (enriched with material info)
                    const receiverRows = [];
                    const receiverBins = data.receiver_bins || [];
                    
                    console.log('[MILA Receiver Initial] Debug:', {
                        receiver_bins: receiverBins,
                        receiver_bin_id_1: data.DB499.receiver_bin_id_1,
                        receiver_bin_id_2: data.DB499.receiver_bin_id_2,
                        flour2_receiver_bin_id_1: data.DB499.flour2_receiver_bin_id_1,
                        flour2_receiver_bin_id_2: data.DB499.flour2_receiver_bin_id_2,
                        yield_max_flow: data.DB2099.yield_max_flow,
                        yield_min_flow: data.DB2099.yield_min_flow
                    });
                    
                    // Build a map of bin_id -> material for quick lookup
                    const binMaterialMap = {};
                    receiverBins.forEach(rec => {
                        if (rec.material) {
                            binMaterialMap[rec.bin_id] = rec.material;
                            console.log(`[MILA Receiver Initial] Mapped bin ${rec.bin_id} -> ${rec.material.material_name}`);
                        }
                    });
                    
                    // Row 1: Receiver Bin 1
                    if (data.DB499.receiver_bin_id_1 && data.DB499.receiver_bin_id_1 !== 0) {
                        const material = binMaterialMap[data.DB499.receiver_bin_id_1];
                        console.log(`[MILA Receiver Initial] Bin 1 lookup: ${data.DB499.receiver_bin_id_1} -> `, material);
                        receiverRows.push({
                            bin_id: data.DB499.receiver_bin_id_1,  // ✅ Explicitly pass bin_id for display
                            id_product: material?.material_code || '0051',
                            productName: material?.material_name || 'Unknown Product',
                            weight: data.DB2099.yield_max_flow || 0
                        });
                    }

                    // Row 2: Receiver Bin 2
                    if (data.DB499.receiver_bin_id_2 && data.DB499.receiver_bin_id_2 !== 0) {
                        const material = binMaterialMap[data.DB499.receiver_bin_id_2];
                        console.log(`[MILA Receiver Initial] Bin 2 lookup: ${data.DB499.receiver_bin_id_2} -> `, material);
                        receiverRows.push({
                            bin_id: data.DB499.receiver_bin_id_2,  // ✅ Explicitly pass bin_id for display
                            id_product: material?.material_code || '0055',
                            productName: material?.material_name || 'Unknown Product',
                            weight: data.DB2099.yield_min_flow || 0
                        });
                    }

                    // Flour 2 Active Receiver ID 1 (offset 172)
                    if (data.DB499.flour2_receiver_bin_id_1 && data.DB499.flour2_receiver_bin_id_1 !== 0) {
                        const material = binMaterialMap[data.DB499.flour2_receiver_bin_id_1];
                        receiverRows.push({
                            bin_id: String(data.DB499.flour2_receiver_bin_id_1),
                            id_product: material?.material_code || '—',
                            productName: material?.material_name || 'Flour 2 Receiver 1',
                            weight: data.f2_scale?.flow_rate_tph ?? 0
                        });
                    }
                    // Flour 2 Active Receiver ID 2 (offset 214)
                    if (data.DB499.flour2_receiver_bin_id_2 && data.DB499.flour2_receiver_bin_id_2 !== 0) {
                        const material = binMaterialMap[data.DB499.flour2_receiver_bin_id_2];
                        receiverRows.push({
                            bin_id: String(data.DB499.flour2_receiver_bin_id_2),
                            id_product: material?.material_code || '—',
                            productName: material?.material_name || 'Flour 2 Receiver 2',
                            weight: 0
                        });
                    }

                    // ✅ Use direct PLC values without frontend calculation
                    const receiverTotal = receiverRows.reduce((sum, row) => sum + (row.weight || 0), 0);

                    // ✅ Main Scale row (B1 - shown in separate table)
                    const mainScaleRow = { id_product: 'B1', weight: data.bran_receiver?.b1 || 0 };
                    
                    // ✅ Use Bran Receiver Non-Erasable Weights from DB499 (in kg) - without B1
                    const branReceiverRows = [
                        { id_product: 'F1', weight: data.bran_receiver?.flour_1 || 0 },
                        { id_product: 'F2', weight: data.f2_scale?.totalizer_kg ?? 0 },
                        { id_product: 'Bran coarse', weight: data.bran_receiver?.bran_coarse || 0 },
                        { id_product: 'Bran fine', weight: data.bran_receiver?.bran_fine || 0 },
                        { id_product: 'semolina', weight: data.bran_receiver?.semolina || 0 },
                    ];
                    const branReceiverTotal = branReceiverRows.reduce((sum, row) => sum + (row.weight || 0), 0);

                    // ✅ Direct from PLC - no calculation needed
                    const weightProduced = receiverTotal + branReceiverTotal;

                    // ✅ Yield Log: F2 next to F1 (Yield Max/Min, B1, F1, F2, Bran coarse, Bran fine, semolina)
                    const yieldLogRows = [
                        { formula: 'Yield Max Flow', value: `${((data.DB2099.yield_max_flow || 0) * 1000 / 3600).toFixed(3)} kg/s` },
                        { formula: 'Yield Min Flow', value: `${((data.DB2099.yield_min_flow || 0) * 1000 / 3600).toFixed(3)} kg/s` },
                        { formula: 'B1', value: `${(data.DB2099.mila_b1 || 0).toFixed(2)} %` },
                        { formula: 'F1', value: `${(data.DB2099.mila_flour_1 || 0).toFixed(2)} %` },
                        { formula: 'F2', value: `${(data.f2_scale?.flow_percentage ?? 0).toFixed(2)} %` },
                        { formula: 'Bran coarse', value: `${(data.DB2099.mila_bran_coarse || 0).toFixed(2)} %` },
                        { formula: 'Bran fine', value: `${(data.DB2099.mila_bran_fine || 0).toFixed(2)} %` },
                        { formula: 'semolina', value: `${(data.DB2099.mila_semolina || 0).toFixed(2)} %` },
                    ];

                    const setpointsGroups = [
                        {
                            name: 'Scale Settings',
                            items: [
                                { identification: 'Order Scale Flowrate', value: `${(data.DB499.order_scale_flowrate || 0).toFixed(1)} t/h` }
                            ]
                        },
                        {
                            name: 'Microfeeder Selection',
                            items: [
                                { identification: 'Feeder 1 Target', value: `${(data.DB499.feeder_1_target || 0).toFixed(1)} %` },
                                { identification: 'Feeder 1 Selected', value: { type: 'checkbox', checked: data.DB499.feeder_1_selected } },
                                { identification: 'Feeder 2 Target', value: `${(data.DB499.feeder_2_target || 0).toFixed(1)} %` },
                                { identification: 'Feeder 2 Selected', value: { type: 'checkbox', checked: data.DB499.feeder_2_selected } }
                            ]
                        },
                        {
                            name: 'Mill Parameters',
                            items: [
                                { identification: 'E11', value: { type: 'checkbox', checked: data.DB499.e11_selected } },
                                { identification: 'E10', value: { type: 'checkbox', checked: data.DB499.e10_selected } },
                                { identification: 'B1 Deopt Emptying', value: { type: 'checkbox', checked: data.DB499.b1_deopt_emptying } },
                                { identification: 'Mill Emptying', value: { type: 'checkbox', checked: data.DB499.mill_emptying } }
                            ]
                        },
                        {
                            name: 'Other',
                            items: [
                                { identification: 'B1 Scale1', value: { type: 'checkbox', checked: data.DB499.b1_scale1 } },
                                { identification: 'B3 Chocke Feeder', value: { type: 'checkbox', checked: data.DB499.b3_chocke_feeder } },
                                { identification: 'Filter Flour Feeder', value: { type: 'checkbox', checked: data.DB499.filter_flour_feeder } }
                            ]
                        }
                    ];

                    const formattedMilaData = {
                        name: data.DB499.linning_running ? 'line Running' : 'line Stopped',
                        type: 'MIL-A',
                        line_running: data.DB499.linning_running,
                        produced: `${weightProduced.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`,
                        consumed: `${weightProduced.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`,
                        receiver: {
                            title: 'Receiver',
                            rows: receiverRows,
                            total: `${receiverTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`
                        },
                        mainScale: {
                            title: 'Main Scale',
                            row: mainScaleRow
                        },
                        branReceiver: {
                            title: 'Bran Receiver',
                            rows: branReceiverRows,
                            total: `${branReceiverTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg`  // ✅ Changed from t/h to kg
                        },
                        yieldLog: {
                            title: 'Yield Log',
                            rows: yieldLogRows,
                        },
                        setpoints: {
                            title: 'Setpoints',
                            groups: setpointsGroups,
                        }
                    };

                    if (isMounted) setReportData({ daily: [formattedMilaData], weekly: [], monthly: [] });
                    return;
                }

                // FTRA initial fetch
                if (selectedJobTypeName === 'FTRA') {
                    const res = await fetch('/orders/plc/ftra-monitor');
                    if (!res.ok) throw new Error('API error');
                    const json = await res.json();
                    const d = json.data || {};

                    // Format sender rows from ActiveSources - Convert t/h to kg/h
                    const senderRows = d.ActiveSources?.map((source) => {
                        const weightTph = source.weight || 0;
                        const weightKgh = weightTph * 1000; // Convert t/h to kg/h
                        return {
                            id: source.bin_id?.toString().padStart(4, '0') || '0000',
                            product: source.prd_name || source.material?.material_name || 'N/A',
                            weight: `${weightKgh.toFixed(3)} kg`
                        };
                    }) || [];

                    const consumedWeight = senderRows.reduce((sum, row) => {
                        const val = parseFloat(row.weight);
                        return sum + (isNaN(val) ? 0 : val);
                    }, 0);

                    // Format receiver row - Convert t/h to kg/h
                    const receiverRows = [{
                        id: d.ReceiverBinId?.toString().padStart(4, '0') || '0000',
                        product: d.ReceiverMaterial?.material_name || 'Output Product',
                        location: 'Output Bin',
                        weight: `${consumedWeight.toFixed(3)} kg`
                    }];

                    // Format setpoints with grouped headings - Filter Flour Destination FIRST
                    const setpointsGroups = [
                        {
                            name: 'Filter Flour Destination',
                            items: [
                                { identification: 'Bag Collection', value: { type: 'checkbox', checked: d.BagCollection || false } },
                                { identification: 'Mixing Screw', value: { type: 'checkbox', checked: d.MixingScrew || false } }
                            ]
                        },
                        {
                            name: 'Micro Ingredient 1',
                            items: [
                                { identification: 'Feeder 3 Target %', value: `${(d.Feeder3TargetPercent || 0).toFixed(1)} %` },
                                { identification: 'Feeder 3 Selected', value: { type: 'checkbox', checked: d.Feeder3Selected || false } }
                            ]
                        },
                        {
                            name: 'Micro Ingredient 2',
                            items: [
                                { identification: 'Feeder 4 Target %', value: `${(d.Feeder4TargetPercent || 0).toFixed(1)} %` },
                                { identification: 'Feeder 4 Selected', value: { type: 'checkbox', checked: d.Feeder4Selected || false } }
                            ]
                        },
                        {
                            name: 'Micro Ingredient 3',
                            items: [
                                { identification: 'Feeder 5 Target %', value: `${(d.Feeder5TargetPercent || 0).toFixed(1)} %` },
                                { identification: 'Feeder 5 Selected', value: { type: 'checkbox', checked: d.Feeder5Selected || false } }
                            ]
                        },
                        {
                            name: 'Micro Ingredient 4',
                            items: [
                                { identification: 'Feeder 6 Target %', value: `${(d.Feeder6TargetPercent || 0).toFixed(1)} %` },
                                { identification: 'Feeder 6 Selected', value: { type: 'checkbox', checked: d.Feeder6Selected || false } }
                            ]
                        },
                        {
                            name: 'Discharger Speed',
                            items: [
                                { identification: 'Speed Discharge 50 %', value: `${(d.SpeedDischarge50Percent || 0).toFixed(1)} %` },
                                { identification: 'Speed Discharge 51-55 %', value: `${(d.SpeedDischarge51_55Percent || 0).toFixed(1)} %` }
                            ]
                        }
                    ];

                    const formattedOrder = {
                        name: 'FTRA Live Monitor',
                        type: 'FTRA',
                        produced: `${(consumedWeight / 1000).toFixed(1)} t/h`, // Keep produced/consumed in t/h for summary
                        consumed: `${(consumedWeight / 1000).toFixed(1)} t/h`,
                        sender: senderRows,
                        receiver: receiverRows,
                        setpoints: {
                            title: 'Setpoints',
                            groups: setpointsGroups
                        },
                        date: new Date().toISOString().split('T')[0],
                        line_running: d.OrderActive === true || d.OrderActive === 1 // Use OrderActive from offset 106 (1=running, 0=stopped)
                    };

                    if (isMounted) setReportData({ daily: [formattedOrder], weekly: [], monthly: [] });
                    return;
                }

                if (selectedJobType === 10) {
                    const sdlaRes = await fetch('/orders/plc/db299-monitor');
                    if (sdlaRes.ok) {
                        const sdlaJson = await sdlaRes.json();
                        const d = sdlaJson.data || {};
                        if (isMounted) setSdlaSetpoints([
                            { id: 'Flowrate', value: d.Flowrate ?? '' },
                            { id: 'MoistureSetpoint', value: d.MoistureSetpoint ?? '' },
                            { id: 'MoistureOffset', value: d.MoistureOffset ?? '' },
                        ]);
                        if (isMounted) setSdlaReceiverWeight(d.ProducedWeight ?? null);

                        // ✅ Use flowrate_tph from DB299 ActiveSources (already includes weight)
                        const senderRows = d.ActiveSources?.map((source) => {
                            const weight = source.flowrate_tph ?? 0;
                            return {
                                id: source.bin_id.toString().padStart(4, '0'),
                                product: source.material?.material_name || 'N/A',
                                weight: `${weight.toFixed(3)} t/h`
                            };
                        }) || [];

                        const consumedWeight = senderRows.reduce((sum, row) => {
                            const val = parseFloat(row.weight);
                            return sum + (isNaN(val) ? 0 : val);
                        }, 0);

                        const formattedOrder = {
                            name: d.OS_Comment || 'Active Order',
                            type: 'SDLA',
                            produced: (d.ProducedWeight || 0).toFixed(1) + ' t/h',
                            consumed: consumedWeight.toFixed(1) + ' t/h',
                            sender: senderRows,
                            receiver: [{
                                id: d.DestBinId?.toString().padStart(4, '0') || '0000',
                                product: d.DestMaterial?.material_name || 'Output Product',
                                location: 'Output Bin',
                                weight: (() => {
                                    // ✅ Use actual DestBinId instead of hardcoded 32
                                    let receiverWeight = '';
                                    if (d.FeederFlows && d.DestBinId) {
                                        for (const key in d.FeederFlows) {
                                            if (d.FeederFlows[key]?.bin_id === d.DestBinId) {
                                                receiverWeight = d.FeederFlows[key].value?.toFixed(3) + ' t/h';
                                                break;
                                            }
                                        }
                                    }
                                    return receiverWeight || '0.000 t/h';
                                })()
                            }],
                            setpoints: [
                                { id: 'Flowrate', value: d.Flowrate ?? '' },
                                { id: 'Moisture Setpoint', value: d.MoistureSetpoint ?? '' },
                                { id: 'Moisture Offset', value: d.MoistureOffset ?? '' },
                            ],
                            date: new Date().toISOString().split('T')[0],
                            line_running: d.JobStatusCode !== 5
                        };

                        if (isMounted) setReportData({
                            daily: [formattedOrder],
                            weekly: [],
                            monthly: []
                        });
                    }
                } else {
                    if (selectedJobType === 9) {
                        const fclRes = await fetch('/orders/plc/db199-monitor');
                        if (fclRes.ok) {
                            const fclJson = await fclRes.json();
                            const d = fclJson.data || {};
                            if (isMounted) setFclSetpoints([
                                { id: 'Flowrate', value: d.flow_rate ?? '' },
                                { id: 'MoistureSetpoint', value: d.moisture_setpoint ?? '' },
                                { id: 'MoistureOffset', value: d.moisture_offset ?? '' },
                            ]);
                            if (isMounted) setFclReceiver(d.receiver ?? null);
                        }
                    }

                    const [orderRes, sensorRes] = await Promise.all([
                        fetch(`/orders/plc/active-bin-order-data?job_type_id=${selectedJobType}`),
                        fetch('/orders/reporting/db2099')
                    ]);
                    if (!orderRes.ok || !sensorRes.ok) throw new Error('API error');
                    const orderData = await orderRes.json();
                    const sensorJson = await sensorRes.json();
                    const sensorData = sensorJson.data || {};

                    if (orderData.error) {
                        if (isMounted) setReportData({ daily: [], weekly: [], monthly: [] });
                        return;
                    }

                    const senderRows = orderData.active_sources?.map((source) => {
                        let sensorValue = '';
                        for (const key in sensorData) {
                            if (sensorData[key]?.bin_id === source.bin_id) {
                                sensorValue = `${sensorData[key].value?.toFixed(3) || 0} ${sensorData[key].unit || ''}`;
                                break;
                            }
                        }
                        return {
                            id: convertBinIdForDisplay(source.bin_id),  // ✅ Convert 211->021A, 212->021B, 213->021C
                            product: source.prd_name || 'Unknown',
                            weight: sensorValue || '0'
                        };
                    }) || [];

                    const consumedWeight = senderRows.reduce((sum, row) => {
                        const val = parseFloat(row.weight);
                        return sum + (isNaN(val) ? 0 : val);
                    }, 0);

                    const formattedOrder = {
                        name: orderData.os_comment || 'Active Order',
                        type: jobTypes.find(jt => jt.id === orderData.job_type_id)?.name || 'Unknown',
                        produced: orderData.active_sources?.reduce((sum, source) =>
                            sum + (source.produced_qty || 0), 0).toFixed(1) + ' t/h' || '0 t/h',
                        consumed: consumedWeight.toFixed(1) + ' t/h',
                        sender: senderRows,
                        receiver: [{
                            id: orderData.active_destination?.bin_id.toString().padStart(4, '0') || '0000',
                            product: 'Output Product',
                            location: 'Output Bin',
                            weight: orderData.active_sources?.reduce((sum, source) =>
                                sum + (source.produced_qty || 0), 0).toFixed(1) + ' t/h' || '0 t/h'
                        }],
                        setpoints: [], // Default to empty, will be populated for FCL
                        date: new Date().toISOString().split('T')[0],
                        line_running: orderData.line_running || false
                    };

                    if (selectedJobType === 9) { // FCL specific setpoints
                        const fclRes = await fetch('/orders/plc/db199-monitor');
                        if (fclRes.ok) {
                            const fclJson = await fclRes.json();
                            const d = fclJson.data || {};
                            const fclReceiversData = fclJson.fcl_receivers || [];
                            
                            formattedOrder.setpoints = [
                                { id: 'Flowrate', value: d.flow_rate ?? '' },
                                { id: 'Moisture Setpoint', value: d.moisture_setpoint ?? '' },
                                { id: 'Moisture Offset', value: d.moisture_offset ?? '' },
                                { id: 'Water consumption', value: d.water_flow_lh != null && d.water_flow_lh !== '' ? `${Number(d.water_flow_lh).toFixed(1)} l/h` : '' },
                            ];
                            
                            // ✅ Use multiple FCL receivers from backend
                            if (fclReceiversData.length > 0) {
                                formattedOrder.receiver = fclReceiversData.map(rec => {
                                    // ✅ Check if it's cumulative counter (FCL_2_520WE) or flow rate (destination bin)
                                    // Cumulative counters contain "FCL" or "520WE" in their ID
                                    const isCumulativeCounter = rec.id.includes('FCL') || rec.id.includes('520WE');
                                    const unit = isCumulativeCounter ? 'kg' : 't/h';
                                    const decimals = isCumulativeCounter ? 1 : 2;
                                    const weight = `${(rec.weight || 0).toFixed(decimals)} ${unit}`;
                                    
                                    return {
                                        id: rec.id || '0000',
                                        product: rec.name || 'Output Product',
                                        location: rec.location || 'Output Bin',
                                        weight: weight
                                    };
                                });
                            } else {
                                // Fallback to single receiver if fcl_receivers not available
                                formattedOrder.receiver = [{
                                    id: '0028',
                                    product: 'Output Product',
                                    location: 'Output Bin',
                                    weight: (d.receiver || 0).toFixed(1) + ' kg'
                                }];
                            }
                        }
                        // Store initial sender data for fallback
                        if (isMounted) setInitialSenderData(formattedOrder.sender);
                    }

                    if (isMounted) setReportData({
                        daily: [formattedOrder],
                        weekly: [],
                        monthly: []
                    });
                }
            } catch (err) {
                console.error('Error loading report:', err);
                if (isMounted) setReportData({ daily: [], weekly: [], monthly: [] });
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        loadReport();
        return () => { isMounted = false; };
    }, [selectedJobType]);

    // Update report data with live WebSocket data
    useEffect(() => {
        let isMounted = true;
        if (!liveData) return;

        const selectedJobTypeName = jobTypes.find(jt => jt.id === selectedJobType)?.name;

        if (selectedJobTypeName === 'MIL-A' && liveData.DB499 && liveData.DB2099) {
            const data = liveData;
            
            // ✅ Get receiver product name from receiver_bins (enriched with material info)
            const receiverRows = [];
            const receiverBins = data.receiver_bins || [];
            
            console.log('[MILA Receiver Live] Debug:', {
                receiver_bins: receiverBins,
                receiver_bin_id_1: data.DB499.receiver_bin_id_1,
                receiver_bin_id_2: data.DB499.receiver_bin_id_2,
                flour2_receiver_bin_id_1: data.DB499.flour2_receiver_bin_id_1,
                flour2_receiver_bin_id_2: data.DB499.flour2_receiver_bin_id_2,
                yield_max_flow: data.DB2099.yield_max_flow,
                yield_min_flow: data.DB2099.yield_min_flow
            });
            
            // Build a map of bin_id -> material for quick lookup
            const binMaterialMap = {};
            receiverBins.forEach(rec => {
                if (rec.material) {
                    binMaterialMap[rec.bin_id] = rec.material;
                    console.log(`[MILA Receiver Live] Mapped bin ${rec.bin_id} -> ${rec.material.material_name}`);
                }
            });
            
            // Row 1: Receiver Bin 1
            if (data.DB499.receiver_bin_id_1 && data.DB499.receiver_bin_id_1 !== 0) {
                const material = binMaterialMap[data.DB499.receiver_bin_id_1];
                console.log(`[MILA Receiver Live] Bin 1 lookup: ${data.DB499.receiver_bin_id_1} -> `, material);
                receiverRows.push({
                    bin_id: String(data.DB499.receiver_bin_id_1),  // ✅ Force String for display
                    id_product: material?.material_code || '0051',
                    productName: material?.material_name || 'Unknown Product',
                    weight: data.DB2099.yield_max_flow || 0
                });
            }

            // Row 2: Receiver Bin 2
            if (data.DB499.receiver_bin_id_2 && data.DB499.receiver_bin_id_2 !== 0) {
                const material = binMaterialMap[data.DB499.receiver_bin_id_2];
                console.log(`[MILA Receiver Live] Bin 2 lookup: ${data.DB499.receiver_bin_id_2} -> `, material);
                receiverRows.push({
                    bin_id: String(data.DB499.receiver_bin_id_2),  // ✅ Force String for display
                    id_product: material?.material_code || '0055',
                    productName: material?.material_name || 'Unknown Product',
                    weight: data.DB2099.yield_min_flow || 0
                });
            }

            // Flour 2 Active Receiver ID 1 (offset 172)
            if (data.DB499.flour2_receiver_bin_id_1 && data.DB499.flour2_receiver_bin_id_1 !== 0) {
                const material = binMaterialMap[data.DB499.flour2_receiver_bin_id_1];
                receiverRows.push({
                    bin_id: String(data.DB499.flour2_receiver_bin_id_1),
                    id_product: material?.material_code || '—',
                    productName: material?.material_name || 'Flour 2 Receiver 1',
                    weight: data.f2_scale?.flow_rate_tph ?? 0
                });
            }
            // Flour 2 Active Receiver ID 2 (offset 214)
            if (data.DB499.flour2_receiver_bin_id_2 && data.DB499.flour2_receiver_bin_id_2 !== 0) {
                const material = binMaterialMap[data.DB499.flour2_receiver_bin_id_2];
                receiverRows.push({
                    bin_id: String(data.DB499.flour2_receiver_bin_id_2),
                    id_product: material?.material_code || '—',
                    productName: material?.material_name || 'Flour 2 Receiver 2',
                    weight: 0
                });
            }

            // ✅ Use direct PLC values - no frontend calculation
            const receiverTotal = receiverRows.reduce((sum, row) => sum + (row.weight || 0), 0);

            // ✅ Main Scale row (B1 - shown in separate table)
            const mainScaleRow = { id_product: 'B1', weight: data.bran_receiver?.b1 || 0 };
            
            // ✅ Use Bran Receiver Non-Erasable Weights from DB499 (in kg) - without B1
            const branReceiverRows = [
                { id_product: 'F1', weight: data.bran_receiver?.flour_1 || 0 },
                { id_product: 'F2', weight: data.f2_scale?.totalizer_kg ?? 0 },
                { id_product: 'Bran coarse', weight: data.bran_receiver?.bran_coarse || 0 },
                { id_product: 'Bran fine', weight: data.bran_receiver?.bran_fine || 0 },
                { id_product: 'semolina', weight: data.bran_receiver?.semolina || 0 },
            ];
            const branReceiverTotal = branReceiverRows.reduce((sum, row) => sum + (row.weight || 0), 0);

            // ✅ Direct PLC total
            const weightProduced = receiverTotal + branReceiverTotal;

            // ✅ Yield Log: F2 next to F1 (Yield Max/Min, B1, F1, F2, Bran coarse, Bran fine, semolina)
            const yieldLogRows = [
                { formula: 'Yield Max Flow', value: `${((data.DB2099.yield_max_flow || 0) * 1000 / 3600).toFixed(3)} kg/s` },
                { formula: 'Yield Min Flow', value: `${((data.DB2099.yield_min_flow || 0) * 1000 / 3600).toFixed(3)} kg/s` },
                { formula: 'B1', value: `${(data.DB2099.mila_b1 || 0).toFixed(2)} %` },
                { formula: 'F1', value: `${(data.DB2099.mila_flour_1 || 0).toFixed(2)} %` },
                { formula: 'F2', value: `${(data.f2_scale?.flow_percentage ?? 0).toFixed(2)} %` },
                { formula: 'Bran coarse', value: `${(data.DB2099.mila_bran_coarse || 0).toFixed(2)} %` },
                { formula: 'Bran fine', value: `${(data.DB2099.mila_bran_fine || 0).toFixed(2)} %` },
                { formula: 'semolina', value: `${(data.DB2099.mila_semolina || 0).toFixed(2)} %` },
            ];

            const setpointsGroups = [
                {
                    name: 'Scale Settings',
                    items: [
                        { identification: 'Order Scale Flowrate', value: `${(data.DB499.order_scale_flowrate || 0).toFixed(1)} t/h` }
                    ]
                },
                {
                    name: 'Microfeeder Selection',
                    items: [
                        { identification: 'Feeder 1 Target', value: `${(data.DB499.feeder_1_target || 0).toFixed(1)} %` },
                        { identification: 'Feeder 1 Selected', value: { type: 'checkbox', checked: data.DB499.feeder_1_selected } },
                        { identification: 'Feeder 2 Target', value: `${(data.DB499.feeder_2_target || 0).toFixed(1)} %` },
                        { identification: 'Feeder 2 Selected', value: { type: 'checkbox', checked: data.DB499.feeder_2_selected } }
                    ]
                },
                {
                    name: 'Mill Parameters',
                    items: [
                        { identification: 'E11', value: { type: 'checkbox', checked: data.DB499.e11_selected } },
                        { identification: 'E10', value: { type: 'checkbox', checked: data.DB499.e10_selected } },
                        { identification: 'B1 Deopt Emptying', value: { type: 'checkbox', checked: data.DB499.b1_deopt_emptying } },
                        { identification: 'Mill Emptying', value: { type: 'checkbox', checked: data.DB499.mill_emptying } }
                    ]
                },
                {
                    name: 'Other',
                    items: [
                        { identification: 'B1 Scale1', value: { type: 'checkbox', checked: data.DB499.b1_scale1 } },
                        { identification: 'B3 Chocke Feeder', value: { type: 'checkbox', checked: data.DB499.b3_chocke_feeder } },
                        { identification: 'Filter Flour Feeder', value: { type: 'checkbox', checked: data.DB499.filter_flour_feeder } }
                    ]
                }
            ];

            const formattedMilaData = {
                name: data.DB499.linning_running ? 'line Running' : 'line Stopped',
                type: 'MIL-A',
                line_running: data.DB499.linning_running,
                produced: `${weightProduced.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`,
                consumed: `${weightProduced.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`,
                receiver: {
                    title: 'Receiver',
                    rows: receiverRows,
                    total: `${receiverTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h`
                },
                mainScale: {
                    title: 'Main Scale',
                    row: mainScaleRow
                },
                branReceiver: {
                    title: 'Bran Receiver',
                    rows: branReceiverRows,
                    total: `${branReceiverTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg`  // ✅ Changed from t/h to kg
                },
                yieldLog: {
                    title: 'Yield Log',
                    rows: yieldLogRows,
                },
                setpoints: {
                    title: 'Setpoints',
                    groups: setpointsGroups,
                }
            };

            if (isMounted) setReportData({ daily: [formattedMilaData], weekly: [], monthly: [] });
        } else if (selectedJobType === 10 && liveData) {
            // Update SDLA data with live WebSocket data
            const d = liveData;

            const senderRows = d.ActiveSources?.map((source) => ({
                id: source.bin_id.toString().padStart(4, '0'),
                product: source.material?.material_name || 'N/A',
                weight: `${source.flowrate_tph?.toFixed(3) || 0} t/h`  // ✅ Changed from kg/s to t/h (raw PLC value)
            })) || [];

            const consumedWeight = senderRows.reduce((sum, row) => {
                const val = parseFloat(row.weight);
                return sum + (isNaN(val) ? 0 : val);
            }, 0);

            const formattedOrder = {
                name: d.OS_Comment || 'Active Order',
                type: 'SDLA',
                produced: (d.ProducedWeight || 0).toFixed(1) + ' t/h',
                consumed: consumedWeight.toFixed(1) + ' t/h',
                sender: senderRows,
                receiver: [{
                    id: d.DestBinId?.toString().padStart(4, '0') || '0000',
                    product: d.DestMaterial?.material_name || 'Output Product',
                    location: 'Output Bin',
                    weight: consumedWeight.toFixed(3) + ' t/h'
                }],
                setpoints: [
                    { id: 'Flowrate', value: d.Flowrate ?? '' },
                    { id: 'Moisture Setpoint', value: d.MoistureSetpoint ?? '' },
                    { id: 'Moisture Offset', value: d.MoistureOffset ?? '' },
                    { id: 'Dumping', value: d.Dumping ?? false, type: 'checkbox' },
                ],
                date: new Date().toISOString().split('T')[0],
                line_running: d.JobStatusCode !== 5
            };

            if (isMounted) setReportData({
                daily: [formattedOrder],
                weekly: [],
                monthly: []
            });
        } else if (selectedJobType === 9 && liveData) {
            // Update FCL data with live WebSocket data
            const d = liveData;

            const senderRows = d.active_sources?.map((source, idx) => {
                const id = convertBinIdForDisplay(source.bin_id);  // ✅ Convert 211->021A, 212->021B, 213->021C
                let product = source.prd_name;
                let weight = source.weight;
                // If product or weight is missing, use initialSenderData
                if ((!product || product === 'Unknown') && initialSenderData[idx]) {
                    product = initialSenderData[idx].product;
                }
                if ((weight == null || isNaN(weight)) && initialSenderData[idx]) {
                    weight = initialSenderData[idx].weight;
                } else if (!(weight == null || isNaN(weight))) {
                    weight = `${weight.toFixed(3)} t/h`;
                }
                return {
                    id,
                    product,
                    weight
                };
            }) || [];

            const consumedWeight = senderRows.reduce((sum, row) => {
                const val = parseFloat(row.weight);
                return sum + (isNaN(val) ? 0 : val);
            }, 0);

            // ✅ Use multiple FCL receivers from WebSocket data
            const receiverRows = d.fcl_receivers?.map(rec => {
                // ✅ Check if it's cumulative counter (FCL_2_520WE) or flow rate (destination bin)
                // Cumulative counters contain "FCL" or "520WE" in their ID
                const isCumulativeCounter = rec.id.includes('FCL') || rec.id.includes('520WE');
                const unit = isCumulativeCounter ? 'kg' : 't/h';
                const decimals = isCumulativeCounter ? 1 : 2;
                const weight = `${(rec.weight || 0).toFixed(decimals)} ${unit}`;
                
                return {
                    id: rec.id || '0000',
                    product: rec.name || 'Output Product',
                    location: rec.location || 'Output Bin',
                    weight: weight
                };
            }) || [{
                id: '0028',
                product: 'Output Product',
                location: 'Output Bin',
                weight: (d.receiver || 0).toFixed(1) + ' kg'
            }];

            const formattedOrder = {
                name: d.os_comment || 'Active Order',
                type: 'FCL',
                produced: (d.produced_weight || 0).toFixed(1) + ' t/h',
                consumed: consumedWeight.toFixed(1) + ' t/h',
                sender: senderRows,
                receiver: receiverRows,
                setpoints: [
                    { id: 'Flowrate', value: d.flow_rate ?? '' },
                    { id: 'Moisture Setpoint', value: d.moisture_setpoint ?? '' },
                    { id: 'Moisture Offset', value: d.moisture_offset ?? '' },
                    { id: 'Water consumption', value: d.water_flow_lh != null && d.water_flow_lh !== '' ? `${Number(d.water_flow_lh).toFixed(1)} l/h` : '' },
                    { id: 'Cleaning Scale bypass', value: d.cleaning_scale_bypass ?? false, type: 'checkbox' },
                ],
                date: new Date().toISOString().split('T')[0],
                line_running: d.line_running || false
            };

            if (isMounted) setReportData({
                daily: [formattedOrder],
                weekly: [],
                monthly: []
            });
        } else if (selectedJobType === 16 && liveData) {
            // Update FTRA data with live WebSocket data
            const d = liveData;

            // Format sender rows from ActiveSources - Convert t/h to kg/h
            const senderRows = d.ActiveSources?.map((source) => {
                const weightTph = source.weight || 0;
                const weightKgh = weightTph * 1000; // Convert t/h to kg/h
                return {
                    id: source.bin_id?.toString().padStart(4, '0') || '0000',
                    product: source.prd_name || source.material?.material_name || 'N/A',
                    weight: `${weightKgh.toFixed(3)} kg`
                };
            }) || [];

            const consumedWeight = senderRows.reduce((sum, row) => {
                const val = parseFloat(row.weight);
                return sum + (isNaN(val) ? 0 : val);
            }, 0);

            // Format receiver row - Convert t/h to kg/h
            const receiverRows = [{
                id: d.ReceiverBinId?.toString().padStart(4, '0') || '0000',
                product: d.ReceiverMaterial?.material_name || 'Output Product',
                location: 'Output Bin',
                weight: `${consumedWeight.toFixed(3)} kg`
            }];

            // Format setpoints with grouped headings - Filter Flour Destination FIRST
            const setpointsGroups = [
                {
                    name: 'Filter Flour Destination',
                    items: [
                        { identification: 'Bag Collection', value: { type: 'checkbox', checked: d.BagCollection || false } },
                        { identification: 'Mixing Screw', value: { type: 'checkbox', checked: d.MixingScrew || false } }
                    ]
                },
                {
                    name: 'Micro Ingredient 1',
                    items: [
                        { identification: 'Feeder 3 Target %', value: `${(d.Feeder3TargetPercent || 0).toFixed(1)} %` },
                        { identification: 'Feeder 3 Selected', value: { type: 'checkbox', checked: d.Feeder3Selected || false } }
                    ]
                },
                {
                    name: 'Micro Ingredient 2',
                    items: [
                        { identification: 'Feeder 4 Target %', value: `${(d.Feeder4TargetPercent || 0).toFixed(1)} %` },
                        { identification: 'Feeder 4 Selected', value: { type: 'checkbox', checked: d.Feeder4Selected || false } }
                    ]
                },
                {
                    name: 'Micro Ingredient 3',
                    items: [
                        { identification: 'Feeder 5 Target %', value: `${(d.Feeder5TargetPercent || 0).toFixed(1)} %` },
                        { identification: 'Feeder 5 Selected', value: { type: 'checkbox', checked: d.Feeder5Selected || false } }
                    ]
                },
                {
                    name: 'Micro Ingredient 4',
                    items: [
                        { identification: 'Feeder 6 Target %', value: `${(d.Feeder6TargetPercent || 0).toFixed(1)} %` },
                        { identification: 'Feeder 6 Selected', value: { type: 'checkbox', checked: d.Feeder6Selected || false } }
                    ]
                },
                {
                    name: 'Discharger Speed',
                    items: [
                        { identification: 'Speed Discharge 50 %', value: `${(d.SpeedDischarge50Percent || 0).toFixed(1)} %` },
                        { identification: 'Speed Discharge 51-55 %', value: `${(d.SpeedDischarge51_55Percent || 0).toFixed(1)} %` }
                    ]
                }
            ];

            const formattedOrder = {
                name: 'FTRA Live Monitor',
                type: 'FTRA',
                produced: `${(consumedWeight / 1000).toFixed(1)} t/h`, // Keep produced/consumed in t/h for summary
                consumed: `${(consumedWeight / 1000).toFixed(1)} t/h`,
                sender: senderRows,
                receiver: receiverRows,
                setpoints: {
                    title: 'Setpoints',
                    groups: setpointsGroups
                },
                date: new Date().toISOString().split('T')[0],
                line_running: d.OrderActive === true || d.OrderActive === 1 // Use OrderActive from offset 106 (1=running, 0=stopped)
            };

            if (isMounted) setReportData({
                daily: [formattedOrder],
                weekly: [],
                monthly: []
            });
        }
        return () => { isMounted = false; };
    }, [liveData, selectedJobType, initialSenderData]);

    useEffect(() => {
        async function fetchData() {
            const res = await fetch("/orders/plc/db299-monitor");
            const json = await res.json();
            setData(json.data);
        }
        fetchData();
    }, []);

    // Helper function to get job type name
    const getJobTypeName = (jobTypeId) => {
        const jobTypes = {
            9: 'FCL',
            10: 'SDPA',
            11: 'Milling'
        };
        return jobTypes[jobTypeId] || 'Unknown';
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const applyFilters = () => {
        const filteredData = reportData[tab].filter((item) => (
            (!filters.batchId || item.id.toLowerCase().includes(filters.batchId.toLowerCase())) &&
            (!filters.productName || item.name.toLowerCase().includes(filters.productName.toLowerCase())) &&
            (!filters.type || item.type.toLowerCase().includes(filters.type.toLowerCase())) &&
            (!filters.date || item.date?.includes(filters.date))
        ));
        setFiltered(filteredData);
    };

    const handlePrint = () => window.print();
    const displayData = (filtered.length > 0 ? filtered : reportData[tab] || []).filter(batch => {
        const selectedTypeName = jobTypes.find(jt => jt.id === selectedJobType)?.name;
        if (selectedTypeName === 'MIL-A') {
            return true;
        }
        return batch.type === selectedTypeName;
    });

    if (!data) return <div>Loading...</div>;

    // Extract values
    const producedWeight = data.ProducedWeight || 0;
    const sender = data.ActiveSources?.[0];
    const senderProduct = sender?.material?.material_name || "N/A";
    const senderFlowrate = sender?.flowrate_tph || 0;  // ✅ Changed from kg/s to t/h
    const receiverProduct = data.DestMaterial?.material_name || "N/A";
    const receiverBin = data.DestBinId || "N/A";
    const flowrate = data.Flowrate || 0;
    const moistureSetpoint = data.MoistureSetpoint || 0;
    const moistureOffset = data.MoistureOffset || 0;

    return (
        <div id="print-area">
            <div className="p-6 min-h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Live Monitor</h1>
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}></div>
                            <span className="text-sm font-medium">
                                {isConnected ? 'Live Data Connected' : 'Live Data Disconnected'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center space-x-4 mb-6">
                    {jobTypes.map(jt => (
                        <button
                            key={jt.id}
                            onClick={() => setSelectedJobType(jt.id)}
                            className={`px-4 py-2 rounded-lg font-medium capitalize transition duration-200 ${selectedJobType === jt.id ? 'bg-blue-700 text-white shadow-md' : 'bg-gray-200 dark:bg-zinc-700 text-gray-800 dark:text-zinc-200 hover:bg-gray-400 hover:text-white'}`}
                        >
                            {jt.name}
                        </button>
                    ))}
                </div>

                {/* Report Display */}
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <svg className="animate-spin h-10 w-10 text-blue-700 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        <span className="ml-4 text-lg font-medium text-blue-700 dark:text-blue-400">Loading report...</span>
                    </div>
                ) : displayData.length === 0 ? (
                    <p className="text-center text-zinc-500">No records found for selected filters.</p>
                ) : displayData.map((batch, i) => {
                    const selectedJobTypeName = jobTypes.find(jt => jt.id === selectedJobType)?.name;
                    
                    // FTRA rendering with grouped setpoints
                    if (selectedJobTypeName === 'FTRA') {
                        return (
                            <div key={i} className="mb-10 p-6 rounded-xl bg-white dark:bg-zinc-800 border dark:border-zinc-700 shadow-md space-y-6">
                                <div className="flex justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold">{batch.name}</h2>
                                        <p className="text-sm text-blue-500">{batch.type}</p>
                                        <p className="text-sm text-gray-500">Status: {batch.line_running ? 'Running' : 'Stopped'}</p>
                                    </div>
                                </div>

                                {/* Sender Section */}
                                {batch.sender && batch.sender.length > 0 && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">Sender</h3>
                                        <table className="w-full border border-zinc-400 dark:border-zinc-600 text-sm">
                                            <thead>
                                                <tr className="bg-zinc-200 dark:bg-zinc-700">
                                                    <th className="border px-3 py-2 text-left">ID</th>
                                                    <th className="border px-3 py-2 text-left">Product</th>
                                                    <th className="border px-3 py-2 text-right">Weight</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batch.sender.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td className="border px-3 py-2">{row.id}</td>
                                                        <td className="border px-3 py-2">{row.product}</td>
                                                        <td className="border px-3 py-2 text-right">{row.weight}</td>
                                                    </tr>
                                                ))}
                                                <tr className="font-semibold bg-zinc-100 dark:bg-zinc-700">
                                                    <td colSpan={2} className="border px-3 py-2 text-right">Actual weight</td>
                                                    <td className="border px-3 py-2 text-right">
                                                        {batch.sender.reduce((sum, row) => {
                                                            const val = parseFloat(row.weight);
                                                            return sum + (isNaN(val) ? 0 : val);
                                                        }, 0).toFixed(1)} kg
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>
                                )}

                                {/* Receiver Section */}
                                {batch.receiver && batch.receiver.length > 0 && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">Receiver</h3>
                                        <table className="w-full border border-zinc-400 dark:border-zinc-600 text-sm">
                                            <thead>
                                                <tr className="bg-zinc-200 dark:bg-zinc-700">
                                                    <th className="border px-3 py-2 text-left">ID</th>
                                                    <th className="border px-3 py-2 text-left">Product</th>
                                                    <th className="border px-3 py-2 text-right">Weight</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batch.receiver.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td className="border px-3 py-2">{row.id}</td>
                                                        <td className="border px-3 py-2">{row.product}</td>
                                                        <td className="border px-3 py-2 text-right">{row.weight}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>
                                )}

                                {/* Setpoints Section with Groups */}
                                {batch.setpoints && batch.setpoints.groups && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">{batch.setpoints.title}</h3>
                                        <table className="w-full border-collapse text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="border-b-2 border-zinc-400 dark:border-zinc-600 py-2 text-left w-1/2">Identification</th>
                                                    <th className="border-b-2 border-zinc-400 dark:border-zinc-600 py-2 text-left w-1/2">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batch.setpoints.groups.map((group, groupIdx) => (
                                                    <React.Fragment key={groupIdx}>
                                                        <tr>
                                                            <td className="pt-4 pb-1 font-semibold text-blue-600 dark:text-blue-400" colSpan="2">{group.name}</td>
                                                        </tr>
                                                        {group.items.map((item, itemIdx) => (
                                                            <tr key={itemIdx}>
                                                                <td className="py-1 pl-4 pr-2">{item.identification}</td>
                                                                <td className="py-1 pl-2">
                                                                    {item.value && typeof item.value === 'object' && item.value.type === 'checkbox' ? (
                                                                        <input type="checkbox" checked={item.value.checked} readOnly />
                                                                    ) : (
                                                                        item.value
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>
                                )}
                            </div>
                        );
                    }
                    
                    if (selectedJobTypeName === 'MIL-A') {
                        return (
                            <div key={i} className="mb-10 p-6 rounded-xl bg-white dark:bg-zinc-800 border dark:border-zinc-700 shadow-md space-y-6">
                                <div className="flex justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold">{batch.name}</h2>
                                        <p className="text-sm text-blue-500">{batch.type}</p>
                                        <p className="text-sm text-gray-500">Status: {batch.line_running ? 'Running' : 'Stopped'}</p>
                                    </div>
                                </div>
                                {batch.receiver && batch.receiver.rows && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">{batch.receiver.title}</h3>
                                        <table className="w-full border border-zinc-400 dark:border-zinc-600 text-sm">
                                            <thead>
                                                <tr className="bg-zinc-200 dark:bg-zinc-700">
                                                    <th className="border px-3 py-2 text-left">Identific Product ident</th>
                                                    <th className="border px-3 py-2 text-left">Product name</th>
                                                    <th className="border px-3 py-2 text-right">Actual weight</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batch.receiver.rows.slice(-10).map((row, idx) => {
                                                    console.log("[MILA Render] Receiver Row:", row); // Debug log
                                                    return (
                                                        <tr key={idx}>
                                                            {/* ✅ Use bin_id if available, otherwise fallback to id_product (Material Code) */}
                                                            <td className="border px-3 py-2">{row.bin_id ? row.bin_id : row.id_product}</td>
                                                            <td className="border px-3 py-2">{row.productName}</td>
                                                            <td className="border px-3 py-2 text-right">
                                                                {row.weight.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t/h
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </section>
                                )}

                                {/* Main Scale Section (B1) */}
                                {batch.mainScale && batch.mainScale.row && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">{batch.mainScale.title}</h3>
                                        <table className="w-full border border-zinc-400 dark:border-zinc-600 text-sm">
                                            <thead>
                                                <tr className="bg-zinc-200 dark:bg-zinc-700">
                                                    <th className="border px-3 py-2 text-left">Identific Product ident</th>
                                                    <th className="border px-3 py-2 text-right">Actual weight</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="border px-3 py-2">{batch.mainScale.row.id_product}</td>
                                                    <td className="border px-3 py-2 text-right">
                                                        {batch.mainScale.row.weight.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>
                                )}

                                {batch.branReceiver && batch.branReceiver.rows && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">{batch.branReceiver.title}</h3>
                                        <table className="w-full border border-zinc-400 dark:border-zinc-600 text-sm">
                                            <thead>
                                                <tr className="bg-zinc-200 dark:bg-zinc-700">
                                                    <th className="border px-3 py-2 text-left">Identific Product ident</th>
                                                    <th className="border px-3 py-2 text-right">Actual weight</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batch.branReceiver.rows.slice(-10).map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td className="border px-3 py-2">{row.id_product}</td>
                                                        <td className="border px-3 py-2 text-right">
                                                            {row.weight.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>
                                )}

                                {batch.yieldLog && batch.yieldLog.rows && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">{batch.yieldLog.title}</h3>
                                        <table className="w-full border-collapse text-sm mb-4">
                                            <tbody>
                                                {batch.yieldLog.rows.slice(-10).map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-1 pr-4">{row.formula}</td>
                                                        <td className="py-1 text-right">{row.value}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {/* Live chart for yield values */}
                                        <LiveMillAYieldChart liveData={liveData} />
                                    </section>
                                )}

                                {batch.setpoints && batch.setpoints.groups && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">{batch.setpoints.title}</h3>
                                        <table className="w-full border-collapse text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="border-b-2 border-zinc-400 dark:border-zinc-600 py-2 text-left">Identification</th>
                                                    <th className="border-b-2 border-zinc-400 dark:border-zinc-600 py-2 text-right">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batch.setpoints.groups.map((group, groupIdx) => (
                                                    <React.Fragment key={groupIdx}>
                                                        <tr>
                                                            <td className="pt-2 font-semibold" colSpan="2">{group.name}</td>
                                                        </tr>
                                                        {group.items.slice(-10).map((item, itemIdx) => (
                                                            <tr key={itemIdx}>
                                                                <td className="py-1 pl-4">{item.identification}</td>
                                                                <td className="py-1 text-right">
                                                                    {item.value && typeof item.value === 'object' && item.value.type === 'checkbox' ? (
                                                                        <input type="checkbox" checked={item.value.checked} readOnly />
                                                                    ) : (
                                                                        item.value
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>
                                )}
                            </div>
                        );
                } else {
                    // ✅ Use direct PLC data without frontend calculations for live monitor
                    const isFCL = selectedJobType === 9;
                    
                    // Get produced weight directly from live data or batch data
                    let producedWeightFCL = '0.0';
                    if (isFCL && liveData) {
                        // Use direct produced_weight from PLC (no calculation)
                        producedWeightFCL = (liveData.produced_weight || 0).toFixed(1);
                    } else if (isFCL && batch.produced) {
                        // Fallback to batch data if no live data
                        producedWeightFCL = parseFloat(batch.produced) || '0.0';
                    }

                        return (
                            <div key={i} className="mb-10 p-6 rounded-xl bg-white dark:bg-zinc-800 border dark:border-zinc-700 shadow-md space-y-6">
                                <div className="flex justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold">{batch.name}</h2>
                                        <p className="text-sm text-blue-500">{batch.type}</p>
                                        <p className="text-sm text-gray-500">Status: {batch.line_running ? 'Running' : 'Stopped'}</p>
                                    </div>
                                </div>

                                {/* Sender and Receiver Sections */}
                                {['sender', 'receiver'].map(section => (
                                    batch[section] && (
                                        <section key={section}>
                                            <h3 className="text-lg font-semibold mb-2">{section.charAt(0).toUpperCase() + section.slice(1)}</h3>
                                            <table className="w-full border border-zinc-400 dark:border-zinc-600 text-sm">
                                                <thead>
                                                    <tr className="bg-zinc-200 dark:bg-zinc-700">
                                                        <th className="border px-3 py-2 text-left">ID</th>
                                                        <th className="border px-3 py-2 text-left">Product</th>
                                                        <th className="border px-3 py-2 text-right">Weight</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {batch[section].slice(-10).map((row, idx) => (
                                                        <tr key={idx}>
                                                            <td className="border px-3 py-2">{row.id}</td>
                                                            <td className="border px-3 py-2">{row.product}</td>
                                                            <td className="border px-3 py-2 text-right">
                                                                {row.weight}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* ✅ Add "Actual weight" total row ONLY for sender section */}
                                                    {section === 'sender' && (
                                                        <tr className="font-semibold bg-zinc-100 dark:bg-zinc-700">
                                                            <td colSpan={2} className="border px-3 py-2 text-right">Actual weight</td>
                                                            <td className="border px-3 py-2 text-right">
                                                                {batch[section].reduce((sum, row) => {
                                                                    const val = parseFloat(row.weight);
                                                                    return sum + (isNaN(val) ? 0 : val);
                                                                }, 0).toFixed(1)} t/h
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </section>
                                    )
                                ))}

                                {/* Setpoints Section */}
                                {batch.setpoints && batch.setpoints.length > 0 && (
                                    <section>
                                        <h3 className="text-lg font-semibold mb-2">Setpoints</h3>
                                        <table className="w-full border border-zinc-400 dark:border-zinc-600 text-sm">
                                            <thead>
                                                <tr className="bg-zinc-200 dark:bg-zinc-700">
                                                    <th className="border px-3 py-2 text-left">Parameter</th>
                                                    <th className="border px-3 py-2 text-left">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {batch.setpoints.map((sp, idx) => (
                                                    <tr key={idx}>
                                                        <td className="border px-3 py-2">{sp.id}</td>
                                                        <td className="border px-3 py-2">
                                                            {sp.type === 'checkbox' ? (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!sp.value}
                                                                    disabled
                                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                                                />
                                                            ) : (
                                                                sp.value
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </section>
                                )}
                            </div>
                        );
                    }
                })}
            </div>
        </div>
    );
}

function LiveMillAYieldChart({ liveData }) {
    const cacheRef = React.useRef([]);
    const [chartBuffer, setChartBuffer] = React.useState([]);
    const [visibleStartIndex, setVisibleStartIndex] = React.useState(0);
    const intervalRef = React.useRef();

    const MAX_RECORDS = 500;
    const TRIM_SIZE = 100;
    const VIEW_WINDOW = 10;

    // Show last 10 records on initial mount
    React.useEffect(() => {
        if (cacheRef.current.length > 0) {
            const start = Math.max(0, cacheRef.current.length - VIEW_WINDOW);
            setVisibleStartIndex(start);
            setChartBuffer(cacheRef.current.slice(start, start + VIEW_WINDOW));
        }
    }, []);

    React.useEffect(() => {
        if (!liveData || !liveData.DB2099) return;
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            const now = new Date();
            cacheRef.current.push({
                dateTime: now,
                data: {
                    ...liveData.DB2099,
                    flow_percentage: liveData.f2_scale?.flow_percentage ?? null,
                },
            });

            // Trim if over max
            if (cacheRef.current.length > MAX_RECORDS) {
                cacheRef.current.splice(0, TRIM_SIZE);
                // If slider is at the end, shift back the window
                const newStart = Math.max(0, cacheRef.current.length - VIEW_WINDOW);
                setVisibleStartIndex(newStart);
            }

            // If user is viewing latest, auto-scroll
            const atEnd = visibleStartIndex >= cacheRef.current.length - VIEW_WINDOW - 1;
            const start = atEnd ? Math.max(0, cacheRef.current.length - VIEW_WINDOW) : visibleStartIndex;
            if (atEnd) setVisibleStartIndex(start);
            setChartBuffer(cacheRef.current.slice(start, start + VIEW_WINDOW));
        }, 1000);

        return () => clearInterval(intervalRef.current);
    }, [liveData, visibleStartIndex]);

    if (!liveData || !liveData.DB2099) return null;
    const productKeys = [
        { key: 'mila_b1', label: 'B1', color: '#06b6d4' },
        { key: 'mila_bran_coarse', label: 'Bran coarse', color: '#f59e0b' },
        { key: 'mila_bran_fine', label: 'Bran fine', color: '#84cc16' },
        { key: 'mila_flour_1', label: 'F1', color: '#8b5cf6' },
        { key: 'mila_semolina', label: 'semolina', color: '#f43f5e' },
        { key: 'flow_percentage', label: 'F2', color: '#0ea5e9' },
    ];
    const labels = chartBuffer.map(entry =>
        entry.dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );

    const datasets = productKeys.map(p => ({
        label: p.label,
        data: chartBuffer.map(entry => entry.data[p.key] != null ? entry.data[p.key] : null),
        fill: false,
        borderColor: p.color,
        backgroundColor: p.color,
        tension: 0.1,
        pointBackgroundColor: p.color,
        pointBorderColor: p.color,
        borderWidth: 2,
    }));

    const data = { labels, datasets };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true } },
            tooltip: { mode: 'index', intersect: false },
        },
        scales: {
            x: {
                type: 'category',
                title: { display: true, text: 'Date/Time' },
            },
            y: {
                min: 0,
                max: 110,
                title: { display: true, text: 'Yield (%)' },
            },
        },
    };

    return (
        <div className="w-full h-[300px]">
            <div className="my-2">
                <input
                    type="range"
                    min={0}
                    max={Math.max(0, cacheRef.current.length - VIEW_WINDOW)}
                    value={visibleStartIndex}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        setVisibleStartIndex(val);
                        setChartBuffer(cacheRef.current.slice(val, val + VIEW_WINDOW));
                    }}
                    className="w-full"
                />
                <p className="text-xs text-right text-zinc-500">
                    Viewing {visibleStartIndex + 1}–{visibleStartIndex + VIEW_WINDOW} of {cacheRef.current.length}
                </p>
            </div>
            <Line data={data} options={options} />
        </div>
    );
}
