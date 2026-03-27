"""
SCL Archive Data Injection Script
===================================
Injects SCL data from scl_data_injection.xlsx into scl_monitor_logs_archive table.

Excel File Format (scl_data_injection.xlsx):
-----------------------------------------
| Column Name                | DB Column              | Type      |
|----------------------------|------------------------|-----------|
| ID                         | id                     | integer   |
| Job Status                 | job_status             | integer   |
| Line Running               | line_running           | boolean   |
| Receiver                   | receiver               | numeric   |
| Flow Rate                  | flow_rate              | numeric   |
| Produced Weight            | produced_weight        | numeric   |
| Water Consumed             | water_consumed         | numeric   |
| Moisture Offset            | moisture_offset        | numeric   |
| Moisture Setpoint          | moisture_setpoint      | numeric   |
| Source Bin ID              | active_sources (JSON)  | jsonb     |
| Source Material Code       | active_sources (JSON)  | jsonb     |
| Source Material Name       | active_sources (JSON)  | jsonb     |
| Source Qty Percent         | active_sources (JSON)  | jsonb     |
| Source Produced Qty        | active_sources (JSON)  | jsonb     |
| Destination Bin ID           | active_destination     | jsonb     |
| Destination Product Code   | active_destination     | jsonb     |
| Destination Material        | active_destination     | jsonb     |
| Destination Material Name   | active_destination     | jsonb     |
| Order Name                 | order_name             | text      |
| Per Bin Weight bin_XX      | per_bin_weights (JSON) | jsonb     |
| created_at                 | created_at             | timestamp |

Usage:
------
    python scl_injection.py --excel scl_data_injection.xlsx --db-host postgres
"""

import os
import sys
import json
import argparse
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import errors as psycopg2_errors
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
    
    # Check if there's a direct JSON column first
    if 'active_sources' in row.index and not pd.isna(row['active_sources']):
        val = row['active_sources']
        if isinstance(val, str) and val.strip():
            try:
                parsed = json.loads(val)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
    
    # Check for source columns
    bin_id = row.get('Source Bin ID', row.get('Source 1 Bin ID', ''))
    material_code = row.get('Source Material Code', row.get('Source 1 Material Code', ''))
    material_name = row.get('Source Material Name', row.get('Source 1 Material Name', ''))
    qty_percent = row.get('Source Qty Percent', row.get('Source 1 Qty Percent', 0))
    produced_qty = row.get('Source Produced Qty', row.get('Source 1 Produced Qty', 0))
    
    if not pd.isna(bin_id) and str(bin_id).strip():
        sources.append({
            'bin_id': str(bin_id),
            'material_code': str(material_code) if not pd.isna(material_code) else '',
            'material_name': str(material_name) if not pd.isna(material_name) else '',
            'qty_percent': parse_numeric(qty_percent),
            'produced_qty': parse_numeric(produced_qty)
        })
    
    # Check for multiple sources (Source 2, Source 3, etc.)
    source_idx = 2
    while True:
        source_bin_id = row.get(f'Source {source_idx} Bin ID', '')
        if pd.isna(source_bin_id) or str(source_bin_id).strip() == '':
            break
        
        sources.append({
            'bin_id': str(source_bin_id),
            'material_code': str(row.get(f'Source {source_idx} Material Code', '')) if not pd.isna(row.get(f'Source {source_idx} Material Code', '')) else '',
            'material_name': str(row.get(f'Source {source_idx} Material Name', '')) if not pd.isna(row.get(f'Source {source_idx} Material Name', '')) else '',
            'qty_percent': parse_numeric(row.get(f'Source {source_idx} Qty Percent', 0)),
            'produced_qty': parse_numeric(row.get(f'Source {source_idx} Produced Qty', 0))
        })
        source_idx += 1
    
    return sources


def build_active_destination_json(row):
    """Build active_destination JSON object from row data."""
    # Check if there's a direct JSON column first
    if 'active_destination' in row.index and not pd.isna(row['active_destination']):
        val = row['active_destination']
        if isinstance(val, str) and val.strip():
            try:
                parsed = json.loads(val)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass
    
    bin_id = row.get('Destination Bin ID', '')
    product_code = row.get('Destination Product Code', '')
    material = row.get('Destination Material', '')
    material_name = row.get('Destination Material Name', '')
    
    if pd.isna(bin_id) or str(bin_id).strip() == '':
        return {}
    
    dest = {
        'bin_id': str(bin_id),
        'product_code': str(product_code) if not pd.isna(product_code) else ''
    }
    
    if not pd.isna(material) and str(material).strip():
        dest['material'] = str(material)
    
    if not pd.isna(material_name) and str(material_name).strip():
        dest['material_name'] = str(material_name)
    
    return dest


def build_per_bin_weights_json(row):
    """Build per_bin_weights JSON from row data."""
    # Check if there's a direct JSON column first
    if 'per_bin_weights' in row.index and not pd.isna(row['per_bin_weights']):
        val = row['per_bin_weights']
        if isinstance(val, str) and val.strip():
            try:
                parsed = json.loads(val)
                if isinstance(parsed, (dict, list)):
                    return parsed
            except json.JSONDecodeError:
                pass
    
    per_bin_weights = {}
    
    # Look for columns like "Per Bin Weight bin_21", "Per Bin Weight bin_22", etc.
    for col in row.index:
        if 'Per Bin Weight' in str(col) or 'per_bin_weight' in str(col).lower():
            bin_key = str(col).replace('Per Bin Weight ', '').replace('per_bin_weight ', '').strip()
            if bin_key and not pd.isna(row[col]):
                weight = parse_numeric(row[col])
                if weight != 0 or bin_key in per_bin_weights:  # Include even if 0, or if already exists
                    per_bin_weights[bin_key] = weight
    
    # Also check for "output_bin" column
    output_bin = row.get('Output Bin Weight', row.get('output_bin', None))
    if not pd.isna(output_bin):
        per_bin_weights['output_bin'] = parse_numeric(output_bin)
    
    # If no per_bin_weights found, return empty dict
    return per_bin_weights if per_bin_weights else {}


def inject_scl_data(excel_path='scl_data_injection.xlsx', dry_run=False, use_custom_id=False):
    """
    Inject SCL data from Excel file into scl_monitor_logs_archive table.
    
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
                    CREATE TABLE IF NOT EXISTS scl_monitor_logs_archive (
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
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                """)
                conn.commit()  # Commit table creation
                
                for idx, row in df.iterrows():
                    try:
                        # Parse ID from Excel if column exists
                        record_id = None
                        if has_id_column:
                            record_id_val = row[id_col]
                            if not pd.isna(record_id_val):
                                parsed_id = parse_int(record_id_val)
                                if parsed_id and parsed_id > 0:
                                    record_id = parsed_id
                                    if use_custom_id:
                                        max_id = max(max_id, record_id)
                                else:
                                    record_id = None  # Invalid ID, treat as auto-increment
                        
                        # Debug: Print ID status
                        if not dry_run and idx < 3:  # Print first 3 rows for debugging
                            print(f"[DEBUG] Row {idx + 1}: use_custom_id={use_custom_id}, record_id={record_id}, has_id_column={has_id_column}")
                        
                        # Parse basic fields - handle various column name formats
                        job_status = parse_int(row.get('Job Status', row.get('job_status', 0)))
                        line_running = parse_bool(row.get('Line Running', row.get('line_running', False)))
                        receiver = parse_numeric(row.get('Receiver', row.get('receiver', 0)))
                        flow_rate = parse_numeric(row.get('Flow Rate', row.get('flow_rate', row.get('Flow Rate (t/h)', 0))))
                        produced_weight = parse_numeric(row.get('Produced Weight', row.get('produced_weight', row.get('Produced Weight (kg)', 0))))
                        water_consumed = parse_numeric(row.get('Water Consumed', row.get('water_consumed', 0)))
                        moisture_offset = parse_numeric(row.get('Moisture Offset', row.get('moisture_offset', 0)))
                        moisture_setpoint = parse_numeric(row.get('Moisture Setpoint', row.get('moisture_setpoint', 0)))
                        
                        # Parse order_name
                        order_name = str(row.get('Order Name', row.get('order_name', ''))).strip()
                        if pd.isna(row.get('Order Name', row.get('order_name', ''))):
                            order_name = ''
                        
                        # Parse created_at
                        created_at = row.get('created_at', row.get('Created At', None))
                        if created_at is None or pd.isna(created_at):
                            created_at = datetime.now()
                        elif isinstance(created_at, str):
                            # Try multiple date formats
                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%d/%m/%Y %H:%M:%S', '%d/%m/%Y']:
                                try:
                                    created_at = datetime.strptime(created_at, fmt)
                                    break
                                except ValueError:
                                    continue
                            else:
                                created_at = datetime.now()
                        elif isinstance(created_at, pd.Timestamp):
                            created_at = created_at.to_pydatetime()
                        
                        # Build JSON fields
                        active_sources = build_active_sources_json(row)
                        active_destination = build_active_destination_json(row)
                        per_bin_weights = build_per_bin_weights_json(row)
                        
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
                            print(f"   Per Bin Weights: {json.dumps(per_bin_weights)[:100]}...")
                        else:
                            # Always use ON CONFLICT if we have an ID value, regardless of flag
                            if record_id is not None and record_id > 0:
                                try:
                                    cur.execute("""
                                        INSERT INTO scl_monitor_logs_archive (
                                            id, job_status, line_running, receiver, flow_rate,
                                            produced_weight, water_consumed, moisture_offset, moisture_setpoint,
                                            active_sources, active_destination, order_name, per_bin_weights,
                                            created_at
                                        )
                                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s)
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
                                            created_at = EXCLUDED.created_at
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
                                        created_at
                                    ))
                                except psycopg2_errors.UniqueViolation as e:
                                    # If ON CONFLICT didn't work (shouldn't happen), try UPDATE instead
                                    print(f"[WARN] Row {idx + 1}: ID {record_id} exists, attempting UPDATE instead...")
                                    cur.execute("""
                                        UPDATE scl_monitor_logs_archive SET
                                            job_status = %s,
                                            line_running = %s,
                                            receiver = %s,
                                            flow_rate = %s,
                                            produced_weight = %s,
                                            water_consumed = %s,
                                            moisture_offset = %s,
                                            moisture_setpoint = %s,
                                            active_sources = %s::jsonb,
                                            active_destination = %s::jsonb,
                                            order_name = %s,
                                            per_bin_weights = %s::jsonb,
                                            created_at = %s
                                        WHERE id = %s
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
                                        record_id
                                    ))
                                    if cur.rowcount == 0:
                                        raise Exception(f"ID {record_id} exists but UPDATE affected 0 rows")
                            else:
                                # Insert without ID (auto-increment)
                                cur.execute("""
                                    INSERT INTO scl_monitor_logs_archive (
                                        job_status, line_running, receiver, flow_rate,
                                        produced_weight, water_consumed, moisture_offset, moisture_setpoint,
                                        active_sources, active_destination, order_name, per_bin_weights,
                                        created_at
                                    )
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s)
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
                                    created_at
                                ))
                            
                            print(f"[OK] Row {idx + 1}: {'Inserted/Updated ID ' + str(record_id) if use_custom_id else 'Inserted'} - {order_name} ({created_at})")
                            
                            # Commit after each successful insert to avoid transaction issues
                            conn.commit()
                        
                        inserted_count += 1
                        
                    except Exception as e:
                        print(f"[ERROR] Row {idx + 1}: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        # Rollback the failed transaction
                        conn.rollback()
                        skipped_count += 1
                        continue
                
                if not dry_run:
                    # Reset sequence if using custom IDs
                    if use_custom_id and max_id > 0:
                        try:
                            cur.execute(f"SELECT setval('scl_monitor_logs_archive_id_seq', {max_id}, true)")
                            conn.commit()
                            print(f"\n[INFO] Reset sequence to {max_id} (next auto ID will be {max_id + 1})")
                        except Exception as e:
                            conn.rollback()
                            print(f"[WARN] Failed to reset sequence: {str(e)}")
        
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
    parser = argparse.ArgumentParser(description='SCL Archive Data Injection Tool')
    parser.add_argument('--excel', default='scl_data_injection.xlsx',
                        help='Path to Excel file (default: scl_data_injection.xlsx)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Only print what would be inserted')
    parser.add_argument('--use-custom-id', action='store_true',
                        help='Use ID column from Excel instead of auto-increment')
    parser.add_argument('--db-host', default='127.0.0.1',
                        help='Database host (default: 127.0.0.1, use "postgres" for Docker)')
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
    print("  SCL Archive Data Injection Tool")
    print("=" * 60)
    
    inject_scl_data(args.excel, args.dry_run, args.use_custom_id)
    
    print("\n" + "=" * 60)

