"""
PLC Status Check Script
Check current value of DB2099 offset 102 (SCL Job Status)
"""

import snap7
from snap7.util import get_bool
import argparse

# PLC connection settings
PLC_CONFIG = {
    'ip': '192.168.23.11',
    'rack': 0,
    'slot': 3
}

DB2099 = 2099
JOB_STATUS_OFFSET = 102

def parse_bool_field(client, db_number, offset):
    """Parse Bool field from PLC (same as parse_field in orders_bp.py)"""
    try:
        byte_offset = int(offset)
        bit_offset = int(round((offset - byte_offset) * 10))
        data = client.db_read(db_number, byte_offset, 1)
        return get_bool(data, 0, bit_offset)
    except Exception as e:
        return f"Error: {e}"

def check_plc_status(ip=None, offset=None):
    """Check PLC status at DB2099 offset 102"""
    plc_ip = ip or PLC_CONFIG['ip']
    check_offset = offset if offset is not None else JOB_STATUS_OFFSET
    
    print("=" * 80)
    print("PLC Status Check - SCL Job Status")
    print("=" * 80)
    print(f"PLC IP: {plc_ip}")
    print(f"DB Number: {DB2099}")
    print(f"Offset: {check_offset}")
    print(f"Data Type: Bool")
    print("=" * 80)
    
    try:
        # Connect to PLC
        print(f"\n[INFO] Connecting to PLC at {plc_ip}...")
        client = snap7.client.Client()
        client.connect(plc_ip, PLC_CONFIG['rack'], PLC_CONFIG['slot'])
        
        if not client.get_connected():
            print("[ERROR] Failed to connect to PLC")
            return
        
        print("[OK] Connected to PLC successfully")
        
        # Read raw bytes for debugging
        print(f"\n[INFO] Reading raw bytes from DB{DB2099} offset {check_offset}...")
        raw_data = client.db_read(DB2099, check_offset, 1)
        print(f"[DEBUG] Raw bytes: {raw_data.hex()} (hex) = {raw_data} (bytes)")
        
        # Parse Bool value
        print(f"\n[INFO] Parsing Bool value...")
        bool_value = parse_bool_field(client, DB2099, check_offset)
        
        if isinstance(bool_value, str):
            print(f"[ERROR] {bool_value}")
            return
        
        # Convert to Int for compatibility
        int_value = 1 if bool_value else 0
        
        # Display results
        print("\n" + "=" * 80)
        print("RESULTS:")
        print("=" * 80)
        print(f"Bool Value: {bool_value}")
        print(f"Int Value:  {int_value}")
        print(f"Status:     {'order_active' if bool_value else 'order_done'}")
        print("=" * 80)
        
        # Additional info
        print(f"\n[INFO] This value will be converted to JobStatusCode = {int_value}")
        print(f"       in the db299_monitor() function for SCL.")
        
        # Disconnect
        client.disconnect()
        print(f"\n[OK] Disconnected from PLC")
        
    except snap7.exceptions.Snap7Exception as e:
        print(f"[ERROR] Snap7 error: {e}")
        print(f"        Make sure PLC is accessible at {plc_ip}")
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Check PLC status at DB2099 offset 102')
    parser.add_argument('--ip', default='192.168.23.11',
                        help='PLC IP address (default: 192.168.23.11)')
    parser.add_argument('--offset', type=int, default=102,
                        help='Offset to check (default: 102)')
    
    args = parser.parse_args()
    
    check_plc_status(ip=args.ip, offset=args.offset)

