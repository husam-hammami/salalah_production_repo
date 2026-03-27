#!/usr/bin/env python3
"""
Energy Monitor PLC Data Checker
Checks all energy monitors (C2, M20, M21, M22, M23, M24) with their DB numbers and offsets
"""

import snap7
import struct
from datetime import datetime

# PLC Connection Settings
PLC_IP = "192.168.23.11"
PLC_RACK = 0
PLC_SLOT = 3
DB_NUMBER = 1603  # Fixed DB number for power monitor

# Monitor Configuration
MONITORS = {
    "C2": {
        "base_offset": 0,
        "L1_Current": 20,
        "L1_Voltage": 32,
        "L2_Current": 148,
        "L2_Voltage": 160,
        "L3_Current": 276,
        "L3_Voltage": 288,
        "EffectivePower": 392,
        "ApparentPower": 396,
        "ReactivePower": 400,
        "OutCosPhi": 404,
        "Total_Active_Energy": 408,
        "Total_Reactive_Energy": 412,
        "Total_Apparent_Energy": 416
    },
    "M20": {"base_offset": 564},
    "M21": {"base_offset": 1108},
    "M22": {"base_offset": 1652},
    "M23": {"base_offset": 2196},
    "M24": {"base_offset": 2740}
}

# Relative offsets for M-blocks (added to base_offset)
M_BLOCK_OFFSETS = {
    "L1_Current": 0,
    "L1_Voltage": 12,
    "L2_Current": 128,
    "L2_Voltage": 140,
    "L3_Current": 256,
    "L3_Voltage": 268,
    "EffectivePower": 372,
    "ApparentPower": 376,
    "ReactivePower": 380,
    "OutCosPhi": 384,
    "Total_Active_Energy": 388,
    "Total_Reactive_Energy": 392,
    "Total_Apparent_Energy": 396
}

# Data types
DATA_TYPES = {
    "L1_Current": "REAL",
    "L1_Voltage": "REAL",
    "L2_Current": "REAL",
    "L2_Voltage": "REAL",
    "L3_Current": "REAL",
    "L3_Voltage": "REAL",
    "EffectivePower": "REAL",
    "ApparentPower": "REAL",
    "ReactivePower": "REAL",
    "OutCosPhi": "REAL",
    "Total_Active_Energy": "DINT",
    "Total_Reactive_Energy": "DINT",
    "Total_Apparent_Energy": "DINT"
}

# Scaling factors
SCALES = {
    "Total_Active_Energy": 0.01,
    "Total_Reactive_Energy": 0.01,
    "Total_Apparent_Energy": 0.01
}

# Reference values per monitor (different monitors have different max current capacities)
MONITOR_REFERENCE_VALUES = {
    "C2": {"Current": 100.0, "Voltage": 240.0},
    "M20": {"Current": 100.0, "Voltage": 240.0},
    "M21": {"Current": 100.0, "Voltage": 240.0},
    "M22": {"Current": 100.0, "Voltage": 240.0},
    "M23": {"Current": 200.0, "Voltage": 240.0},  # Higher capacity - handles up to 200A
    "M24": {"Current": 150.0, "Voltage": 240.0}   # Medium capacity - handles up to 150A
}

# Default reference values (fallback)
DEFAULT_REFERENCE_VALUES = {
    "Current": 100.0,
    "Voltage": 240.0
}


def connect_to_plc():
    """Connect to PLC"""
    try:
        client = snap7.client.Client()
        client.connect(PLC_IP, PLC_RACK, PLC_SLOT)
        print(f"✅ Connected to PLC: {PLC_IP}")
        return client
    except Exception as e:
        print(f"❌ Failed to connect to PLC: {e}")
        return None


def read_value(plc, offset, data_type, scale=1.0):
    """Read value from PLC"""
    try:
        if data_type == "REAL":
            raw = plc.db_read(DB_NUMBER, offset, 4)
            value = struct.unpack('>f', raw)[0]
        elif data_type == "DINT":
            raw = plc.db_read(DB_NUMBER, offset, 4)
            value = struct.unpack('>i', raw)[0]
        else:
            return None, f"Unknown type: {data_type}"
        
        return round(value * scale, 3), None
    except Exception as e:
        return None, str(e)


def calculate_percentage(value, reference):
    """Calculate percentage and divide by 10 to scale down"""
    if reference == 0:
        return 0.0
    return round(((value / reference) * 100) / 10, 2)


def get_monitor_offsets(monitor_name):
    """Get all offsets for a monitor"""
    if monitor_name == "C2":
        return MONITORS["C2"]
    else:
        # M-block: use base offset + relative offsets
        base = MONITORS[monitor_name]["base_offset"]
        offsets = {}
        for tag, rel_offset in M_BLOCK_OFFSETS.items():
            offsets[tag] = base + rel_offset
        return offsets


def check_monitor(plc, monitor_name):
    """Check all values for a monitor"""
    print(f"\n{'='*80}")
    print(f"MONITOR: {monitor_name}")
    print(f"{'='*80}")
    
    # Get monitor-specific reference values
    ref_values = MONITOR_REFERENCE_VALUES.get(monitor_name, DEFAULT_REFERENCE_VALUES)
    current_ref = ref_values["Current"]
    voltage_ref = ref_values["Voltage"]
    
    offsets = get_monitor_offsets(monitor_name)
    results = {}
    
    # Read all values
    for tag, offset in offsets.items():
        if tag == "base_offset":
            continue
            
        data_type = DATA_TYPES.get(tag, "REAL")
        scale = SCALES.get(tag, 1.0)
        
        value, error = read_value(plc, offset, data_type, scale)
        
        if error:
            results[tag] = {"value": None, "error": error, "offset": offset, "type": data_type}
        else:
            results[tag] = {"value": value, "error": None, "offset": offset, "type": data_type}
    
    # Display results
    print(f"\n{'Tag':<30} {'Offset':<10} {'Type':<8} {'Value':<20} {'Percentage':<15} {'Status'}")
    print("-" * 100)
    print(f"Reference Values: Current={current_ref}A, Voltage={voltage_ref}V")
    
    # Current values
    print("\n📊 CURRENT VALUES:")
    for line in ["L1", "L2", "L3"]:
        tag = f"{line}_Current"
        if tag in results:
            r = results[tag]
            if r["error"]:
                print(f"{tag:<30} {r['offset']:<10} {r['type']:<8} {'ERROR':<20} {'N/A':<15} ❌ {r['error']}")
            else:
                pct = calculate_percentage(r["value"], current_ref)
                status = "✅" if 0 <= pct <= 100 else "⚠️"
                print(f"{tag:<30} {r['offset']:<10} {r['type']:<8} {r['value']:<20} {pct}%{'':<10} {status}")
    
    # Voltage values
    print("\n⚡ VOLTAGE VALUES:")
    for line in ["L1", "L2", "L3"]:
        tag = f"{line}_Voltage"
        if tag in results:
            r = results[tag]
            if r["error"]:
                print(f"{tag:<30} {r['offset']:<10} {r['type']:<8} {'ERROR':<20} {'N/A':<15} ❌ {r['error']}")
            else:
                pct = calculate_percentage(r["value"], voltage_ref)
                status = "✅" if 0 <= pct <= 100 else "⚠️"
                print(f"{tag:<30} {r['offset']:<10} {r['type']:<8} {r['value']:<20} {pct}%{'':<10} {status}")
    
    # Power values
    print("\n⚙️ POWER VALUES:")
    for tag in ["EffectivePower", "ApparentPower", "ReactivePower", "OutCosPhi"]:
        if tag in results:
            r = results[tag]
            if r["error"]:
                print(f"{tag:<30} {r['offset']:<10} {r['type']:<8} {'ERROR':<20} {'N/A':<15} ❌ {r['error']}")
            else:
                print(f"{tag:<30} {r['offset']:<10} {r['type']:<8} {r['value']:<20} {'N/A':<15} ✅")
    
    # Energy values
    print("\n🔋 ENERGY VALUES (Cumulative):")
    for tag in ["Total_Active_Energy", "Total_Reactive_Energy", "Total_Apparent_Energy"]:
        if tag in results:
            r = results[tag]
            if r["error"]:
                print(f"{tag:<30} {r['offset']:<10} {r['type']:<8} {'ERROR':<20} {'N/A':<15} ❌ {r['error']}")
            else:
                print(f"{tag:<30} {r['offset']:<10} {r['type']:<8} {r['value']:<20} {'N/A':<15} ✅")
    
    # Summary
    print(f"\n📋 SUMMARY FOR {monitor_name}:")
    print(f"   Voltage L1-L2: {results.get('L1_Voltage', {}).get('value', 'N/A')} V")
    print(f"   Effective Power: {results.get('EffectivePower', {}).get('value', 'N/A')} kW")
    print(f"   Total Active Energy: {results.get('Total_Active_Energy', {}).get('value', 'N/A')} kWh")
    
    return results


def main():
    """Main function"""
    print("="*80)
    print("ENERGY MONITOR PLC DATA CHECKER")
    print("="*80)
    print(f"PLC IP: {PLC_IP}")
    print(f"DB Number: {DB_NUMBER}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Connect to PLC
    plc = connect_to_plc()
    if not plc:
        return
    
    try:
        # Check all monitors
        all_results = {}
        for monitor in ["C2", "M20", "M21", "M22", "M23", "M24"]:
            results = check_monitor(plc, monitor)
            all_results[monitor] = results
        
        # Overall summary
        print(f"\n{'='*80}")
        print("OVERALL SUMMARY")
        print(f"{'='*80}")
        print(f"\n{'Monitor':<10} {'L1 Current %':<15} {'L2 Current %':<15} {'L3 Current %':<15} {'Voltage L1 %':<15} {'Effective Power':<15}")
        print("-" * 80)
        
        for monitor in ["C2", "M20", "M21", "M22", "M23", "M24"]:
            results = all_results[monitor]
            l1_curr = results.get("L1_Current", {}).get("value", 0) or 0
            l2_curr = results.get("L2_Current", {}).get("value", 0) or 0
            l3_curr = results.get("L3_Current", {}).get("value", 0) or 0
            l1_volt = results.get("L1_Voltage", {}).get("value", 0) or 0
            eff_power = results.get("EffectivePower", {}).get("value", 0) or 0
            
            # Use monitor-specific reference values
            ref_values = MONITOR_REFERENCE_VALUES.get(monitor, DEFAULT_REFERENCE_VALUES)
            current_ref = ref_values["Current"]
            voltage_ref = ref_values["Voltage"]
            
            l1_curr_pct = calculate_percentage(l1_curr, current_ref)
            l2_curr_pct = calculate_percentage(l2_curr, current_ref)
            l3_curr_pct = calculate_percentage(l3_curr, current_ref)
            l1_volt_pct = calculate_percentage(l1_volt, voltage_ref)
            
            print(f"{monitor:<10} {l1_curr_pct}%{'':<8} {l2_curr_pct}%{'':<8} {l3_curr_pct}%{'':<8} {l1_volt_pct}%{'':<8} {eff_power} kW")
        
        print(f"\n{'='*80}")
        print("✅ Check complete!")
        print(f"{'='*80}")
        
    except Exception as e:
        print(f"\n❌ Error during check: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            plc.disconnect()
            print("\n🔌 Disconnected from PLC")
        except:
            pass


if __name__ == "__main__":
    main()

