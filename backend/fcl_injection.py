"""
FCL Archive Data Injection Script
===================================
Injects FCL data from fcl134.xlsx into fcl_monitor_logs_archive table.

Excel File Format (fcl134.xlsx):
-----------------------------------------
| Column Name                | DB Column              | Type      |
|----------------------------|------------------------|-----------|
| ID                         | id                     | integer   |
| Job Status                 | job_status             | integer   |
| Line Running               | line_running           | boolean   |
| Receiver                   | receiver               | numeric   |
| Flow Rate (t/h)            | flow_rate              | numeric   |
| Produced Weight (kg)       | produced_weight        | numeric   |
| Water Consumed             | water_consumed         | numeric   |
| Moisture Offset            | moisture_offset        | numeric   |
| Moisture Setpoint          | moisture_setpoint      | numeric   |
| Source Bin ID              | active_sources (JSON)  | jsonb     |
| Source Material Code       | active_sources (JSON)  | jsonb     |
| Source Material Name       | active_sources (JSON)  | jsonb     |
| Source Qty Percent         | active_sources (JSON)  | jsonb     |
| Source Produced Qty        | active_sources (JSON)  | jsonb     |
| Destination Bin ID         | active_destination     | jsonb     |
| Destination Product Code   | active_destination     | jsonb     |
| Order Name                 | order_name             | text      |
| created_at                 | created_at             | timestamp |
| Cleaning Scale Bypass      | cleaning_scale_bypass  | boolean   |

Usage:
------
    python fcl_injection.py --excel fcl134.xlsx --db-host postgres
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
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on')
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


def build_active_sources_json(row):
    """Build active_sources JSON array from row data."""
    sources = []
    
    # Check for source columns
    bin_id = row.get('Source Bin ID', '')
    material_code = row.get('Source Material Code', '')
    material_name = row.get('Source Material Name', '')
    qty_percent = row.get('Source Qty Percent', 0)
    produced_qty = row.get('Source Produced Qty', 0)
    
    if not pd.isna(bin_id) and str(bin_id).strip():
        sources.append({
            'bin_id': str(bin_id),
            'material_code': str(material_code) if not pd.isna(material_code) else '',
            'material_name': str(material_name) if not pd.isna(material_name) else '',
            'qty_percent': parse_numeric(qty_percent),
            'produced_qty': parse_numeric(produced_qty)
        })
    
    return sources


def build_active_destination_json(row):
    """Build active_destination JSON object from row data."""
    bin_id = row.get('Destination Bin ID', '')
    product_code = row.get('Destination Product Code', '')
    
    if pd.isna(bin_id) or str(bin_id).strip() == '':
        return {}
    
    return {
        'bin_id': str(bin_id),
        'product_code': str(product_code) if not pd.isna(product_code) else ''
    }


def build_per_bin_weights_json(row):
    """Build per_bin_weights JSON from row data."""
    per_bin_weights = {}
    
    # Map Output Bin Weight
    output_bin_weight = row.get('Output Bin Weight (kg)', 0)
    if not pd.isna(output_bin_weight):
        per_bin_weights['output_bin'] = parse_numeric(output_bin_weight)
    
    return per_bin_weights


def build_fcl_receivers_json(row):
    """Build fcl_receivers JSON array from row data."""
    receivers = []
    
    # Output Bin receiver
    output_bin_weight = row.get('Output Bin Weight (kg)', 0)
    if not pd.isna(output_bin_weight):
        receivers.append({
            'id': 'FCL_2_520WE',
            'product': 'Cumulative Counter',
            'location': 'Output Bin',
            'weight_kg': parse_numeric(output_bin_weight)
        })
    
    # FCL_2_520WE cumulative counter
    fcl_520we_weight = row.get('FCL_2_520WE Weight (kg)', 0)
    if not pd.isna(fcl_520we_weight):
        receivers.append({
            'id': 'FCL_2_520WE',
            'product': 'FCL 2_520WE',
            'location': 'Cumulative Counter',
            'weight_kg': parse_numeric(fcl_520we_weight)
        })
    
    return receivers


def inject_fcl_data(excel_path='fcl134.xlsx', dry_run=False, use_custom_id=False):
    """
    Inject FCL data from Excel file into fcl_monitor_logs_archive table.
    
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
        print(f"[INFO] Available columns: {list(df.columns)}")
        
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
                        flow_rate = parse_numeric(row.get('Flow Rate (t/h)', row.get('flow_rate', 0)))
                        produced_weight = parse_numeric(row.get('Produced Weight (kg)', row.get('produced_weight', 0)))
                        water_consumed = parse_numeric(row.get('Water Consumed', row.get('water_consumed', 0)))
                        moisture_offset = parse_numeric(row.get('Moisture Offset', row.get('moisture_offset', 0)))
                        moisture_setpoint = parse_numeric(row.get('Moisture Setpoint', row.get('moisture_setpoint', 0)))
                        cleaning_scale_bypass = parse_bool(row.get('Cleaning Scale Bypass', row.get('cleaning_scale_bypass', False)))
                        
                        # Parse order_name
                        order_name = str(row.get('Order Name', row.get('order_name', ''))).strip()
                        if pd.isna(row.get('Order Name', row.get('order_name', ''))):
                            order_name = ''
                        
                        # Parse created_at
                        created_at = row.get('created_at', row.get('Created At', None))
                        if created_at is None or pd.isna(created_at):
                            created_at = datetime.now()
                        elif isinstance(created_at, str):
                            created_at = datetime.strptime(created_at, '%Y-%m-%d %H:%M:%S')
                        elif isinstance(created_at, pd.Timestamp):
                            created_at = created_at.to_pydatetime()
                        
                        # Build JSON fields
                        active_sources = build_active_sources_json(row)
                        active_destination = build_active_destination_json(row)
                        
                        # Check if active_sources/active_destination columns exist as JSON strings
                        if 'active_sources' in row.index and not pd.isna(row['active_sources']):
                            val = row['active_sources']
                            if isinstance(val, str) and val.strip():
                                try:
                                    active_sources = json.loads(val)
                                except json.JSONDecodeError:
                                    pass
                        
                        if 'active_destination' in row.index and not pd.isna(row['active_destination']):
                            val = row['active_destination']
                            if isinstance(val, str) and val.strip():
                                try:
                                    active_destination = json.loads(val)
                                except json.JSONDecodeError:
                                    pass
                        
                        # Build per_bin_weights and fcl_receivers from Excel columns
                        per_bin_weights = build_per_bin_weights_json(row)
                        fcl_receivers = build_fcl_receivers_json(row)
                        
                        # Override with JSON string if column exists
                        if 'per_bin_weights' in row.index and not pd.isna(row['per_bin_weights']):
                            val = row['per_bin_weights']
                            if isinstance(val, str) and val.strip():
                                try:
                                    per_bin_weights = json.loads(val)
                                except json.JSONDecodeError:
                                    pass
                        
                        if 'fcl_receivers' in row.index and not pd.isna(row['fcl_receivers']):
                            val = row['fcl_receivers']
                            if isinstance(val, str) and val.strip():
                                try:
                                    fcl_receivers = json.loads(val)
                                except json.JSONDecodeError:
                                    pass
                        
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
                            print(f"   Active Sources: {json.dumps(active_sources)[:100]}...")
                            print(f"   Active Destination: {json.dumps(active_destination)[:100]}...")
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
    parser = argparse.ArgumentParser(description='FCL Archive Data Injection Tool')
    parser.add_argument('--excel', default='fcl134.xlsx',
                        help='Path to Excel file (default: fcl134.xlsx)')
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
    print("  FCL Archive Data Injection Tool")
    print("=" * 60)
    
    inject_fcl_data(args.excel, args.dry_run, args.use_custom_id)
    
    print("\n" + "=" * 60)

