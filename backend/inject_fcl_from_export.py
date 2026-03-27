"""
FCL Archive Data Injection Script from Export Format Excel
==========================================================
Injects FCL data from export format Excel file (like fcl_dec19_5am_to_dec20_5am.xlsx) 
into fcl_monitor_logs_archive table.

This script handles the export format which includes:
- JSON columns: Active Sources (JSON), Active Destination (JSON), FCL Receivers (JSON), Per Bin Weights (JSON)
- Flattened columns: Source 1, Source 2, Receiver 1, Receiver 2, etc.

Usage:
------
    python inject_fcl_from_export.py --excel fcl_dec19_5am_to_dec20_5am.xlsx --use-custom-id
"""

import os
import sys
import json
import argparse
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# Database connection settings
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'Dynamic_DB_Hercules',
    'user': 'postgres',
    'password': 'trust'
}


def get_db_connection():
    """Create a database connection."""
    return psycopg2.connect(**DB_CONFIG)


def parse_bool(value):
    """Parse boolean values from various formats."""
    if isinstance(value, bool):
        return value
    if pd.isna(value):
        return False
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on', 'true')
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def parse_numeric(value, default=0):
    """Parse numeric values."""
    if pd.isna(value):
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def parse_int(value, default=0):
    """Parse integer values."""
    if pd.isna(value):
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def build_active_sources_from_json_and_flat(row):
    """Build active_sources JSON array from JSON column and/or flattened columns."""
    sources = []
    
    # First, try to use the JSON column if it exists and is valid
    json_cols = ['Active Sources (JSON)', 'active_sources', 'ActiveSources']
    json_data = None
    
    for col in json_cols:
        if col in row.index and not pd.isna(row[col]):
            val = row[col]
            if isinstance(val, str) and val.strip():
                try:
                    json_data = json.loads(val)
                    if isinstance(json_data, list):
                        sources = json_data
                        break
                except json.JSONDecodeError:
                    pass
    
    # If we got JSON data, use it
    if sources:
        return sources
    
    # Otherwise, build from flattened columns (Source 1, Source 2, etc.)
    source_num = 1
    while True:
        # Check if Source N exists
        bin_id_col = f'Source {source_num} Bin ID'
        if source_num == 1:
            # Also check without number prefix
            bin_id_col = row.get('Source Bin ID', '') or row.get('Source 1 Bin ID', '')
        
        if bin_id_col not in row.index or pd.isna(row.get(bin_id_col, '')):
            # Check if we have any source data
            if source_num == 1:
                # Try without number
                if 'Source Bin ID' in row.index and not pd.isna(row.get('Source Bin ID', '')):
                    bin_id = str(row['Source Bin ID']).strip()
                    if bin_id:
                        source = {
                            'bin_id': bin_id,
                            'weight': parse_numeric(row.get('Source Flowrate (t/h)', 0)),
                            'is_active': parse_bool(row.get('Source Is Active', False)),
                            'qty_percent': parse_numeric(row.get('Source Qty Percent', 0)),
                            'produced_qty': parse_numeric(row.get('Source Produced Qty', 0)),
                            'source_index': parse_int(row.get('Source Source Index', 1))
                        }
                        # Add material info if available
                        material_code = row.get('Source Material Code', '')
                        material_name = row.get('Source Material Name', '')
                        if not pd.isna(material_code) and str(material_code).strip():
                            source['material_code'] = str(material_code)
                        if not pd.isna(material_name) and str(material_name).strip():
                            source['material_name'] = str(material_name)
                        sources.append(source)
            break
        
        bin_id = str(row.get(bin_id_col, '')).strip()
        if not bin_id:
            break
        
        source = {
            'bin_id': bin_id,
            'weight': parse_numeric(row.get(f'Source {source_num} Flowrate (t/h)', 0)),
            'is_active': parse_bool(row.get(f'Source {source_num} Is Active', False)),
            'qty_percent': parse_numeric(row.get(f'Source {source_num} Qty Percent', 0)),
            'produced_qty': parse_numeric(row.get(f'Source {source_num} Produced Qty', 0)),
            'source_index': parse_int(row.get(f'Source {source_num} Source Index', source_num))
        }
        
        # Add material info if available
        material_code = row.get(f'Source {source_num} Material Code', '')
        material_name = row.get(f'Source {source_num} Material Name', '')
        if not pd.isna(material_code) and str(material_code).strip():
            source['material_code'] = str(material_code)
        if not pd.isna(material_name) and str(material_name).strip():
            source['material_name'] = str(material_name)
        
        sources.append(source)
        source_num += 1
    
    return sources


def build_active_destination_from_json_and_flat(row):
    """Build active_destination JSON object from JSON column and/or flattened columns."""
    # First, try to use the JSON column if it exists and is valid
    json_cols = ['Active Destination (JSON)', 'active_destination', 'ActiveDestination']
    
    for col in json_cols:
        if col in row.index and not pd.isna(row[col]):
            val = row[col]
            if isinstance(val, str) and val.strip():
                try:
                    json_data = json.loads(val)
                    if isinstance(json_data, dict):
                        return json_data
                except json.JSONDecodeError:
                    pass
    
    # Otherwise, build from flattened columns
    bin_id = row.get('Destination Bin ID', '')
    if pd.isna(bin_id) or str(bin_id).strip() == '':
        return {}
    
    dest = {
        'bin_id': str(bin_id).strip()
    }
    
    # Add other destination fields if available
    dest_no = row.get('Destination Dest No', '')
    if not pd.isna(dest_no):
        dest['dest_no'] = str(dest_no)
    
    prd_code = row.get('Destination Prd Code', '')
    if not pd.isna(prd_code):
        dest['prd_code'] = str(prd_code)
    
    material_code = row.get('Destination Material Code', '')
    material_name = row.get('Destination Material Name', '')
    if not pd.isna(material_code) or not pd.isna(material_name):
        material = {}
        if not pd.isna(material_code):
            material['material_code'] = str(material_code)
        if not pd.isna(material_name):
            material['material_name'] = str(material_name)
        if material:
            dest['material'] = material
    
    return dest


def build_fcl_receivers_from_json_and_flat(row):
    """Build fcl_receivers JSON array from JSON column and/or flattened columns."""
    receivers = []
    
    # First, try to use the JSON column if it exists and is valid
    json_cols = ['FCL Receivers (JSON)', 'fcl_receivers', 'FCLReceivers']
    
    for col in json_cols:
        if col in row.index and not pd.isna(row[col]):
            val = row[col]
            if isinstance(val, str) and val.strip():
                try:
                    json_data = json.loads(val)
                    if isinstance(json_data, list):
                        receivers = json_data
                        break
                except json.JSONDecodeError:
                    pass
    
    # If we got JSON data, use it
    if receivers:
        return receivers
    
    # Otherwise, build from flattened columns (Receiver 1, Receiver 2, etc.)
    receiver_num = 1
    while True:
        # Check if Receiver N exists
        id_col = f'Receiver {receiver_num} ID'
        if receiver_num == 1:
            # Also check without number prefix
            id_col = row.get('Receiver ID', '') or row.get('Receiver 1 ID', '')
        
        if id_col not in row.index or pd.isna(row.get(id_col, '')):
            # Check if we have any receiver data without number
            if receiver_num == 1 and 'Receiver ID' in row.index and not pd.isna(row.get('Receiver ID', '')):
                receiver_id = str(row['Receiver ID']).strip()
                if receiver_id:
                    receiver = {
                        'id': receiver_id,
                        'name': str(row.get('Receiver Name', '')).strip() if not pd.isna(row.get('Receiver Name', '')) else '',
                        'location': str(row.get('Receiver Location', '')).strip() if not pd.isna(row.get('Receiver Location', '')) else '',
                        'weight': parse_numeric(row.get('Receiver Weight', 0))
                    }
                    bin_id = row.get('Receiver Bin ID', '')
                    if not pd.isna(bin_id) and str(bin_id).strip():
                        receiver['bin_id'] = str(bin_id)
                    receivers.append(receiver)
            break
        
        receiver_id = str(row.get(id_col, '')).strip()
        if not receiver_id:
            break
        
        receiver = {
            'id': receiver_id,
            'name': str(row.get(f'Receiver {receiver_num} Name', '')).strip() if not pd.isna(row.get(f'Receiver {receiver_num} Name', '')) else '',
            'location': str(row.get(f'Receiver {receiver_num} Location', '')).strip() if not pd.isna(row.get(f'Receiver {receiver_num} Location', '')) else '',
            'weight': parse_numeric(row.get(f'Receiver {receiver_num} Weight', 0))
        }
        
        bin_id = row.get(f'Receiver {receiver_num} Bin ID', '')
        if not pd.isna(bin_id) and str(bin_id).strip():
            receiver['bin_id'] = str(bin_id)
        
        receivers.append(receiver)
        receiver_num += 1
    
    return receivers


def build_per_bin_weights_from_json_and_flat(row):
    """Build per_bin_weights JSON from JSON column and/or flattened columns."""
    # First, try to use the JSON column if it exists and is valid
    json_cols = ['Per Bin Weights (JSON)', 'per_bin_weights', 'PerBinWeights']
    
    for col in json_cols:
        if col in row.index and not pd.isna(row[col]):
            val = row[col]
            if isinstance(val, str) and val.strip():
                try:
                    json_data = json.loads(val)
                    if isinstance(json_data, (dict, list)):
                        return json_data
                except json.JSONDecodeError:
                    pass
    
    # Otherwise, build from flattened columns (Per Bin Weight Bin 21, etc.)
    per_bin_weights = []
    weights_dict = {}
    
    # Look for columns like "Per Bin Weight Bin 21", "Per Bin Weight Bin 22", etc.
    for col in row.index:
        if col.startswith('Per Bin Weight Bin '):
            bin_id_str = col.replace('Per Bin Weight Bin ', '').strip()
            weight = parse_numeric(row[col], 0)
            if weight > 0:  # Only include non-zero weights
                try:
                    # Try to parse as integer bin_id
                    bin_id = int(bin_id_str)
                    weights_dict[bin_id] = weight
                except ValueError:
                    # Keep as string if not numeric
                    weights_dict[bin_id_str] = weight
    
    # Convert to list format (matching export format)
    if weights_dict:
        per_bin_weights = [
            {"bin_id": bin_id, "total_weight": weight}
            for bin_id, weight in weights_dict.items()
        ]
    
    return per_bin_weights if per_bin_weights else {}


def inject_fcl_data_from_export(excel_path, dry_run=False, use_custom_id=False):
    """
    Inject FCL data from export format Excel file into fcl_monitor_logs_archive table.
    
    Args:
        excel_path: Path to the Excel file
        dry_run: If True, only print what would be inserted without actually inserting
        use_custom_id: If True, use 'ID' column from Excel file instead of auto-increment
    
    Returns:
        Number of rows successfully inserted
    """
    if not os.path.exists(excel_path):
        print(f"[ERROR] File not found: {excel_path}")
        return 0
    
    print(f"[INFO] Reading Excel file: {excel_path}")
    
    try:
        df = pd.read_excel(excel_path)
        print(f"[INFO] Found {len(df)} rows in Excel file")
        
        if df.empty:
            print("[WARN] Excel file is empty")
            return 0
        
        # Print available columns for debugging
        print(f"[INFO] Available columns: {len(df.columns)} columns")
        
        # Check for ID column
        id_col = None
        for col in ['ID', 'id', 'Id']:
            if col in df.columns:
                id_col = col
                break
        
        has_id_column = id_col is not None
        if use_custom_id and not has_id_column:
            print(f"[WARN] --use-custom-id specified but 'ID' column not found. Will auto-generate IDs.")
            use_custom_id = False
        elif has_id_column:
            print(f"[INFO] '{id_col}' column found. Use --use-custom-id flag to inject with specific IDs.")
        
        inserted_count = 0
        skipped_count = 0
        max_id = 0
        
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Ensure table exists
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS fcl_monitor_logs_archive (
                        id SERIAL PRIMARY KEY,
                        job_status INTEGER,
                        line_running BOOLEAN,
                        receiver NUMERIC,
                        flow_rate NUMERIC,
                        produced_weight NUMERIC,
                        water_consumed NUMERIC,
                        moisture_offset NUMERIC,
                        moisture_setpoint NUMERIC,
                        active_sources JSONB,
                        active_destination JSONB,
                        order_name TEXT,
                        per_bin_weights JSONB,
                        created_at TIMESTAMP DEFAULT NOW(),
                        fcl_receivers JSONB DEFAULT '[]'::jsonb,
                        cleaning_scale_bypass BOOLEAN
                    );
                """)
                
                for idx, row in df.iterrows():
                    try:
                        # Parse ID if using custom IDs
                        record_id = None
                        if use_custom_id and has_id_column:
                            record_id = parse_int(row[id_col])
                            max_id = max(max_id, record_id)
                        
                        # Parse basic fields - handle various column name formats
                        job_status = parse_int(row.get('Job Status', row.get('job_status', 0)))
                        line_running = parse_bool(row.get('Line Running', row.get('line_running', False)))
                        receiver = parse_numeric(row.get('Receiver', row.get('receiver', 0)))
                        flow_rate = parse_numeric(row.get('Flow Rate', row.get('Flow Rate (t/h)', row.get('flow_rate', 0))))
                        produced_weight = parse_numeric(row.get('Produced Weight', row.get('Produced Weight (kg)', row.get('produced_weight', 0))))
                        water_consumed = parse_numeric(row.get('Water Consumed', row.get('water_consumed', 0)))
                        moisture_offset = parse_numeric(row.get('Moisture Offset', row.get('moisture_offset', 0)))
                        moisture_setpoint = parse_numeric(row.get('Moisture Setpoint', row.get('moisture_setpoint', 0)))
                        cleaning_scale_bypass = parse_bool(row.get('Cleaning Scale Bypass', row.get('cleaning_scale_bypass', False)))
                        
                        # Parse order_name
                        order_name = str(row.get('Order Name', row.get('order_name', ''))).strip()
                        if pd.isna(row.get('Order Name', row.get('order_name', ''))):
                            order_name = ''
                        
                        # Parse created_at
                        created_at = row.get('Created At', row.get('created_at', None))
                        if created_at is None or pd.isna(created_at):
                            created_at = datetime.now()
                        elif isinstance(created_at, str):
                            try:
                                created_at = datetime.strptime(created_at, '%Y-%m-%d %H:%M:%S')
                            except ValueError:
                                created_at = datetime.now()
                        elif isinstance(created_at, pd.Timestamp):
                            created_at = created_at.to_pydatetime()
                        
                        # Build JSON fields from JSON columns and/or flattened columns
                        active_sources = build_active_sources_from_json_and_flat(row)
                        active_destination = build_active_destination_from_json_and_flat(row)
                        fcl_receivers = build_fcl_receivers_from_json_and_flat(row)
                        per_bin_weights = build_per_bin_weights_from_json_and_flat(row)
                        
                        if dry_run:
                            print(f"\n[DRY RUN] Row {idx + 1}:")
                            if use_custom_id:
                                print(f"   ID: {record_id}")
                            print(f"   Order: {order_name}")
                            print(f"   Job Status: {job_status}")
                            print(f"   Line Running: {line_running}")
                            print(f"   Receiver: {receiver}")
                            print(f"   Flow Rate: {flow_rate}")
                            print(f"   Produced Weight: {produced_weight}")
                            print(f"   Created At: {created_at}")
                            print(f"   Active Sources: {len(active_sources)} sources")
                            print(f"   Active Destination: {json.dumps(active_destination)[:100]}...")
                            print(f"   FCL Receivers: {len(fcl_receivers)} receivers")
                            print(f"   Per Bin Weights: {len(per_bin_weights) if isinstance(per_bin_weights, list) else 'dict'}")
                        else:
                            if use_custom_id and record_id is not None:
                                cur.execute("""
                                    INSERT INTO fcl_monitor_logs_archive (
                                        id, job_status, line_running, receiver, flow_rate,
                                        produced_weight, water_consumed, moisture_offset, moisture_setpoint,
                                        active_sources, active_destination, order_name, per_bin_weights,
                                        created_at, fcl_receivers, cleaning_scale_bypass
                                    )
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s, %s::jsonb, %s)
                                    ON CONFLICT (id) DO UPDATE SET
                                        job_status = EXCLUDED.job_status,
                                        line_running = EXCLUDED.line_running,
                                        receiver = EXCLUDED.receiver,
                                        flow_rate = EXCLUDED.flow_rate,
                                        produced_weight = EXCLUDED.produced_weight,
                                        water_consumed = EXCLUDED.water_consumed,
                                        moisture_offset = EXCLUDED.moisture_offset,
                                        moisture_setpoint = EXCLUDED.moisture_setpoint,
                                        active_sources = EXCLUDED.active_sources,
                                        active_destination = EXCLUDED.active_destination,
                                        order_name = EXCLUDED.order_name,
                                        per_bin_weights = EXCLUDED.per_bin_weights,
                                        created_at = EXCLUDED.created_at,
                                        fcl_receivers = EXCLUDED.fcl_receivers,
                                        cleaning_scale_bypass = EXCLUDED.cleaning_scale_bypass
                                """, (
                                    record_id,
                                    job_status,
                                    line_running,
                                    receiver,
                                    flow_rate,
                                    produced_weight,
                                    water_consumed,
                                    moisture_offset,
                                    moisture_setpoint,
                                    json.dumps(active_sources),
                                    json.dumps(active_destination),
                                    order_name,
                                    json.dumps(per_bin_weights),
                                    created_at,
                                    json.dumps(fcl_receivers),
                                    cleaning_scale_bypass
                                ))
                            else:
                                cur.execute("""
                                    INSERT INTO fcl_monitor_logs_archive (
                                        job_status, line_running, receiver, flow_rate,
                                        produced_weight, water_consumed, moisture_offset, moisture_setpoint,
                                        active_sources, active_destination, order_name, per_bin_weights,
                                        created_at, fcl_receivers, cleaning_scale_bypass
                                    )
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s, %s::jsonb, %s)
                                """, (
                                    job_status,
                                    line_running,
                                    receiver,
                                    flow_rate,
                                    produced_weight,
                                    water_consumed,
                                    moisture_offset,
                                    moisture_setpoint,
                                    json.dumps(active_sources),
                                    json.dumps(active_destination),
                                    order_name,
                                    json.dumps(per_bin_weights),
                                    created_at,
                                    json.dumps(fcl_receivers),
                                    cleaning_scale_bypass
                                ))
                            
                            print(f"[OK] Row {idx + 1}: {'Inserted/Updated ID ' + str(record_id) if use_custom_id else 'Inserted'} - {order_name} ({created_at})")
                        
                        inserted_count += 1
                        
                    except Exception as e:
                        print(f"[ERROR] Row {idx + 1}: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        skipped_count += 1
                        continue
                
                if not dry_run:
                    # Reset sequence if using custom IDs
                    if use_custom_id and max_id > 0:
                        cur.execute(f"SELECT setval('fcl_monitor_logs_archive_id_seq', {max_id}, true)")
                        print(f"\n[INFO] Reset sequence to {max_id} (next auto ID will be {max_id + 1})")
                    
                    conn.commit()
        
        if skipped_count > 0:
            print(f"\n[WARN] Skipped {skipped_count} rows due to errors")
        
        print(f"\n[OK] Successfully {'would insert' if dry_run else 'inserted'} {inserted_count} rows")
        return inserted_count
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='FCL Archive Data Injection Tool (Export Format)')
    parser.add_argument('--excel', default='fcl_dec19_5am_to_dec20_5am.xlsx',
                        help='Path to Excel file (default: fcl_dec19_5am_to_dec20_5am.xlsx)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Only print what would be inserted')
    parser.add_argument('--use-custom-id', action='store_true',
                        help='Use ID column from Excel instead of auto-increment')
    parser.add_argument('--db-host', default='127.0.0.1',
                        help='Database host (default: 127.0.0.1)')
    parser.add_argument('--db-port', type=int, default=5432,
                        help='Database port (default: 5432)')
    parser.add_argument('--db-name', default='Dynamic_DB_Hercules',
                        help='Database name (default: Dynamic_DB_Hercules)')
    parser.add_argument('--db-user', default='postgres',
                        help='Database user (default: postgres)')
    parser.add_argument('--db-password', default='trust',
                        help='Database password (default: trust)')
    
    args = parser.parse_args()
    
    # Update DB config from command line
    DB_CONFIG['host'] = args.db_host
    DB_CONFIG['port'] = args.db_port
    DB_CONFIG['database'] = args.db_name
    DB_CONFIG['user'] = args.db_user
    DB_CONFIG['password'] = args.db_password
    
    print("=" * 60)
    print("  FCL Archive Data Injection Tool (Export Format)")
    print("=" * 60)
    
    inject_fcl_data_from_export(args.excel, args.dry_run, args.use_custom_id)
    
    print("\n" + "=" * 60)


