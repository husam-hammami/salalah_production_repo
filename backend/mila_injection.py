"""
MILA Archive Data Injection Script
===================================
Injects MILA data from mila_injection.xlsx into mila_monitor_logs_archive table.

Excel File Format (mila_injection.xlsx):
-----------------------------------------
The Excel file should have the following columns:

| Column Name               | Description                           | Example Value                    |
|---------------------------|---------------------------------------|----------------------------------|
| id (OPTIONAL)             | Row ID (use with --use-custom-id)     | 1, 2, 3...                       |
| order_name                | Order identifier                      | MILA153                          |
| status                    | Order status                          | running / completed              |
| created_at                | Timestamp (YYYY-MM-DD HH:MM:SS)       | 2025-12-17 17:00:00              |
| produced_weight           | Total produced weight in kg           | 73.201                           |
|---------------------------|---------------------------------------|----------------------------------|
| RECEIVER COLUMNS (will be converted to JSON array):                                           |
| receiver_bin_id           | Bin ID                                | 51                               |
| receiver_material_code    | Material code                         | 004                              |
| receiver_material_name    | Material name                         | Flour                            |
| receiver_weight_kg        | Weight in kg                          | 0.0                              |
|---------------------------|---------------------------------------|----------------------------------|
| BRAN RECEIVER COLUMNS (will be converted to JSON object):                                     |
| B1Scale (kg)              | B1 Scale weight                       | 393248575                        |
| Semolina (kg)             | Semolina weight                       | 8072103                          |
| MILA_Flour1 (kg)          | MILA Flour1 weight                    | 289085279                        |
| 9105 Bran fine (kg)       | Bran fine weight                      | 51894571                         |
| 9106 Bran coarse (kg)     | Bran coarse weight                    | 37436370                         |
|---------------------------|---------------------------------------|----------------------------------|
| YIELD LOG COLUMNS (will be converted to JSON object):                                         |
| MILA_B1 (%)               | B1 yield percentage                   | 0.0                              |
| MILA_Flour1 (%)           | Flour1 yield percentage               | 72.585                           |
| MILA_BranFine (%)         | Bran fine yield percentage            | 14.355                           |
| MILA_Semolina (%)         | Semolina yield percentage             | 0.616                            |
| MILA_BranCoarse (%)       | Bran coarse yield percentage          | 10.555                           |
| Yield Max Flow (kg/s)     | Max flow rate                         | 0                                |
| Yield Min Flow (kg/s)     | Min flow rate                         | 0                                |
|---------------------------|---------------------------------------|----------------------------------|
| SETPOINTS COLUMNS (will be converted to JSON object):                                         |
| Order Scale Flowrate (t/h)| Scale flowrate in tons/hour           | 12.5                             |
| Feeder 1 Target (%)       | Feeder 1 target percentage            | 55.0                             |
| Feeder 1 Enabled (Bool)   | Feeder 1 enabled                      | TRUE/FALSE                       |
| Feeder 2 Target (%)       | Feeder 2 target percentage            | 0.0                              |
| Feeder 2 Enabled (Bool)   | Feeder 2 enabled                      | TRUE/FALSE                       |
| E11 (Bool)                | E11 selected                          | TRUE/FALSE                       |
| E10 (Bool)                | E10 selected                          | TRUE/FALSE                       |
| B1 Deopt Emptying (Bool)  | B1 Deopt Emptying                     | TRUE/FALSE                       |
| Mill Emptying (Bool)      | Mill Emptying                         | TRUE/FALSE                       |
| B1 Scale1 (Bool)          | B1 Scale1                             | TRUE/FALSE                       |
| B3 Chocke Feeder (Bool)   | B3 Chocke Feeder                      | TRUE/FALSE                       |
| Filter Flour Feeder (Bool)| Filter Flour Feeder                   | TRUE/FALSE                       |
| Flap 1 Selected (Bool)    | Flap 1 selected                       | TRUE/FALSE                       |
| Flap 2 Selected (Bool)    | Flap 2 selected                       | TRUE/FALSE                       |
| Depot Selected (Bool)     | Depot selected                        | TRUE/FALSE                       |
| Semolina Selected (Bool)  | Semolina selected                     | TRUE/FALSE                       |
| MILA_2_B789WE Selected (Bool) | MILA_2_B789WE selected             | TRUE/FALSE                       |

Usage:
------
    python mila_injection.py

Or from another script:
    from mila_injection import inject_mila_data
    inject_mila_data('path/to/mila_injection.xlsx')
"""

import os
import sys
import json
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

# Column mappings for JSON fields
BRAN_RECEIVER_COLUMNS = [
    'B1Scale (kg)',
    'Semolina (kg)',
    'MILA_Flour1 (kg)',
    '9105 Bran fine (kg)',
    '9106 Bran coarse (kg)'
]

YIELD_LOG_COLUMNS = [
    'MILA_B1 (%)',
    'MILA_Flour1 (%)',
    'MILA_BranFine (%)',
    'MILA_Semolina (%)',
    'MILA_BranCoarse (%)',
    'Yield Max Flow (kg/s)',
    'Yield Min Flow (kg/s)'
]

SETPOINTS_COLUMNS = [
    'Order Scale Flowrate (t/h)',
    'Feeder 1 Target (%)',
    'Feeder 1 Enabled (Bool)',
    'Feeder 2 Target (%)',
    'Feeder 2 Enabled (Bool)',
    'E11 (Bool)',
    'E10 (Bool)',
    'B1 Deopt Emptying (Bool)',
    'Mill Emptying (Bool)',
    'B1 Scale1 (Bool)',
    'B3 Chocke Feeder (Bool)',
    'Filter Flour Feeder (Bool)',
    'Flap 1 Selected (Bool)',
    'Flap 2 Selected (Bool)',
    'Depot Selected (Bool)',
    'Semolina Selected (Bool)',
    'MILA_2_B789WE Selected (Bool)'
]

RECEIVER_COLUMNS = [
    'receiver_bin_id',
    'receiver_material_code',
    'receiver_material_name',
    'receiver_weight_kg'
]


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


def build_receiver_json(row):
    """Build receiver JSON array from row data."""
    # Check if receiver columns exist
    if not all(col in row.index for col in RECEIVER_COLUMNS):
        return []
    
    bin_id = row.get('receiver_bin_id', '')
    material_code = row.get('receiver_material_code', '')
    material_name = row.get('receiver_material_name', '')
    weight_kg = parse_numeric(row.get('receiver_weight_kg', 0))
    
    if pd.isna(bin_id) or bin_id == '':
        return []
    
    return [{
        'bin_id': str(bin_id),
        'material_code': str(material_code),
        'material_name': str(material_name),
        'weight_kg': weight_kg
    }]


def build_bran_receiver_json(row):
    """Build bran_receiver JSON object from row data."""
    bran_receiver = {}
    for col in BRAN_RECEIVER_COLUMNS:
        if col in row.index and not pd.isna(row[col]):
            bran_receiver[col] = parse_numeric(row[col])
    return bran_receiver


def build_yield_log_json(row):
    """Build yield_log JSON object from row data."""
    yield_log = {}
    for col in YIELD_LOG_COLUMNS:
        if col in row.index and not pd.isna(row[col]):
            yield_log[col] = parse_numeric(row[col])
    return yield_log


def build_setpoints_json(row):
    """Build setpoints_produced JSON object from row data."""
    setpoints = {}
    for col in SETPOINTS_COLUMNS:
        if col in row.index and not pd.isna(row[col]):
            if '(Bool)' in col:
                setpoints[col] = parse_bool(row[col])
            else:
                setpoints[col] = parse_numeric(row[col])
    return setpoints


def inject_mila_data(excel_path='mila_injection.xlsx', dry_run=False, use_custom_id=False):
    """
    Inject MILA data from Excel file into mila_monitor_logs_archive table.
    
    Args:
        excel_path: Path to the Excel file
        dry_run: If True, only print what would be inserted without actually inserting
        use_custom_id: If True, use 'id' column from Excel file instead of auto-increment
    
    Returns:
        Number of rows successfully inserted
    """
    # Check if file exists
    if not os.path.exists(excel_path):
        print(f"[ERROR] File not found: {excel_path}")
        return 0
    
    print(f"[INFO] Reading Excel file: {excel_path}")
    
    try:
        # Read Excel file
        df = pd.read_excel(excel_path)
        print(f"[INFO] Found {len(df)} rows in Excel file")
        
        if df.empty:
            print("[WARN] Excel file is empty")
            return 0
        
        # Print available columns for debugging
        print(f"[INFO] Available columns: {list(df.columns)}")
        
        # Check if 'id' column exists when use_custom_id is True
        has_id_column = 'id' in df.columns
        if use_custom_id and not has_id_column:
            print(f"[WARN] --use-custom-id specified but 'id' column not found. Will auto-generate IDs.")
            use_custom_id = False
        elif has_id_column:
            print(f"[INFO] 'id' column found in Excel. Use --use-custom-id flag to inject with specific IDs.")
        
        # Validate required columns
        required_cols = ['order_name', 'status', 'created_at', 'produced_weight']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            print(f"[ERROR] Missing required columns: {missing_cols}")
            return 0
        
        inserted_count = 0
        skipped_count = 0
        max_id = 0
        
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Ensure table exists
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS mila_monitor_logs_archive (
                        id SERIAL PRIMARY KEY,
                        order_name TEXT,
                        status TEXT,
                        receiver JSONB,
                        bran_receiver JSONB,
                        yield_log JSONB,
                        setpoints_produced JSONB,
                        produced_weight NUMERIC,
                        created_at TIMESTAMP
                    );
                """)
                
                for idx, row in df.iterrows():
                    try:
                        # Parse ID if using custom IDs
                        record_id = None
                        if use_custom_id and has_id_column:
                            record_id = int(row['id'])
                            max_id = max(max_id, record_id)
                        
                        # Parse basic fields
                        order_name = str(row['order_name']).strip()
                        status = str(row['status']).strip() if not pd.isna(row['status']) else 'completed'
                        produced_weight = parse_numeric(row['produced_weight'])
                        
                        # Parse created_at
                        created_at = row['created_at']
                        if isinstance(created_at, str):
                            created_at = datetime.strptime(created_at, '%Y-%m-%d %H:%M:%S')
                        elif isinstance(created_at, pd.Timestamp):
                            created_at = created_at.to_pydatetime()
                        
                        # Build JSON fields
                        receiver = build_receiver_json(row)
                        bran_receiver = build_bran_receiver_json(row)
                        yield_log = build_yield_log_json(row)
                        setpoints_produced = build_setpoints_json(row)
                        
                        if dry_run:
                            print(f"\n[DRY RUN] Row {idx + 1}:")
                            if use_custom_id:
                                print(f"   ID: {record_id}")
                            print(f"   Order: {order_name}")
                            print(f"   Status: {status}")
                            print(f"   Created At: {created_at}")
                            print(f"   Produced Weight: {produced_weight}")
                            print(f"   Receiver: {json.dumps(receiver)[:100]}...")
                            print(f"   Bran Receiver: {json.dumps(bran_receiver)[:100]}...")
                            print(f"   Yield Log: {json.dumps(yield_log)[:100]}...")
                            print(f"   Setpoints: {json.dumps(setpoints_produced)[:100]}...")
                        else:
                            if use_custom_id and record_id is not None:
                                # Insert with specific ID
                                cur.execute("""
                                    INSERT INTO mila_monitor_logs_archive (
                                        id, order_name, status, receiver,
                                        bran_receiver, yield_log, setpoints_produced,
                                        produced_weight, created_at
                                    )
                                    VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                                            %s::jsonb, %s, %s)
                                    ON CONFLICT (id) DO UPDATE SET
                                        order_name = EXCLUDED.order_name,
                                        status = EXCLUDED.status,
                                        receiver = EXCLUDED.receiver,
                                        bran_receiver = EXCLUDED.bran_receiver,
                                        yield_log = EXCLUDED.yield_log,
                                        setpoints_produced = EXCLUDED.setpoints_produced,
                                        produced_weight = EXCLUDED.produced_weight,
                                        created_at = EXCLUDED.created_at
                                """, (
                                    record_id,
                                    order_name,
                                    status,
                                    json.dumps(receiver),
                                    json.dumps(bran_receiver),
                                    json.dumps(yield_log),
                                    json.dumps(setpoints_produced),
                                    produced_weight,
                                    created_at
                                ))
                                print(f"[OK] Row {idx + 1}: Inserted/Updated ID {record_id} - {order_name} ({created_at})")
                            else:
                                # Insert with auto-generated ID
                                cur.execute("""
                                    INSERT INTO mila_monitor_logs_archive (
                                        order_name, status, receiver,
                                        bran_receiver, yield_log, setpoints_produced,
                                        produced_weight, created_at
                                    )
                                    VALUES (%s, %s, %s::jsonb, %s::jsonb, %s::jsonb,
                                            %s::jsonb, %s, %s)
                                """, (
                                    order_name,
                                    status,
                                    json.dumps(receiver),
                                    json.dumps(bran_receiver),
                                    json.dumps(yield_log),
                                    json.dumps(setpoints_produced),
                                    produced_weight,
                                    created_at
                                ))
                                print(f"[OK] Row {idx + 1}: Inserted {order_name} ({created_at})")
                        
                        inserted_count += 1
                        
                    except Exception as e:
                        print(f"[ERROR] Row {idx + 1}: {e}")
                        skipped_count += 1
                        continue
                
                # Reset the sequence to max ID + 1 if custom IDs were used
                if use_custom_id and max_id > 0 and not dry_run:
                    cur.execute("""
                        SELECT setval('mila_monitor_logs_archive_id_seq', %s, true)
                    """, (max_id,))
                    print(f"\n[INFO] Reset sequence to {max_id} (next auto ID will be {max_id + 1})")
                
                if not dry_run:
                    conn.commit()
                    print(f"\n[OK] Successfully inserted {inserted_count} rows")
                else:
                    print(f"\n[DRY RUN] Would insert {inserted_count} rows")
                
                if skipped_count > 0:
                    print(f"[WARN] Skipped {skipped_count} rows due to errors")
                
                return inserted_count
                
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return 0


def create_sample_excel(output_path='mila_injection_sample.xlsx'):
    """Create a sample Excel file with the correct format."""
    print(f"[INFO] Creating sample Excel file: {output_path}")
    
    sample_data = {
        # ID column (optional - use with --use-custom-id flag)
        'id': [1, 2],
        
        'order_name': ['MILA153', 'MILA154'],
        'status': ['completed', 'running'],
        'created_at': ['2025-12-17 17:00:00', '2025-12-17 18:00:00'],
        'produced_weight': [73.201, 85.500],
        
        # Receiver columns
        'receiver_bin_id': ['51', '52'],
        'receiver_material_code': ['004', '005'],
        'receiver_material_name': ['Flour', 'Semolina'],
        'receiver_weight_kg': [0.0, 10.5],
        
        # Bran receiver columns
        'B1Scale (kg)': [393248575, 393250000],
        'Semolina (kg)': [8072103, 8073000],
        'MILA_Flour1 (kg)': [289085279, 289090000],
        '9105 Bran fine (kg)': [51894571, 51895000],
        '9106 Bran coarse (kg)': [37436370, 37437000],
        
        # Yield log columns
        'MILA_B1 (%)': [0.0, 0.0],
        'MILA_Flour1 (%)': [72.585, 72.6],
        'MILA_BranFine (%)': [14.355, 14.4],
        'MILA_Semolina (%)': [0.616, 0.62],
        'MILA_BranCoarse (%)': [10.555, 10.56],
        'Yield Max Flow (kg/s)': [0, 0],
        'Yield Min Flow (kg/s)': [0, 0],
        
        # Setpoints columns
        'Order Scale Flowrate (t/h)': [12.5, 13.0],
        'Feeder 1 Target (%)': [55.0, 60.0],
        'Feeder 1 Enabled (Bool)': [True, True],
        'Feeder 2 Target (%)': [0.0, 5.0],
        'Feeder 2 Enabled (Bool)': [False, True],
        'E11 (Bool)': [True, True],
        'E10 (Bool)': [False, False],
        'B1 Deopt Emptying (Bool)': [True, True],
        'Mill Emptying (Bool)': [False, False],
        'B1 Scale1 (Bool)': [True, True],
        'B3 Chocke Feeder (Bool)': [True, True],
        'Filter Flour Feeder (Bool)': [True, True],
        'Flap 1 Selected (Bool)': [False, False],
        'Flap 2 Selected (Bool)': [False, False],
        'Depot Selected (Bool)': [False, False],
        'Semolina Selected (Bool)': [True, True],
        'MILA_2_B789WE Selected (Bool)': [False, False]
    }
    
    df = pd.DataFrame(sample_data)
    df.to_excel(output_path, index=False)
    print(f"[OK] Sample file created: {output_path}")
    print(f"   Columns: {list(df.columns)}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='MILA Archive Data Injection Tool')
    parser.add_argument('--file', '-f', default='mila_injection.xlsx',
                        help='Path to Excel file (default: mila_injection.xlsx)')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='Print what would be inserted without actually inserting')
    parser.add_argument('--use-custom-id', '-i', action='store_true',
                        help='Use "id" column from Excel file instead of auto-increment. '
                             'If ID already exists, it will UPDATE the row.')
    parser.add_argument('--create-sample', '-s', action='store_true',
                        help='Create a sample Excel file with correct format')
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
    print("  MILA Archive Data Injection Tool")
    print("=" * 60)
    
    if args.create_sample:
        create_sample_excel()
        print("\n[TIP] Edit the sample file and run again without --create-sample")
    else:
        inject_mila_data(args.file, dry_run=args.dry_run, use_custom_id=args.use_custom_id)
    
    print("\n" + "=" * 60)

