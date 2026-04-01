"""
MILA Archive Data Export Script
==============================
Exports the last 100 MILA records from mila_monitor_logs_archive table to Excel file.
Records are sorted by timestamp in descending order (newest first).

Usage:
------
    python export_mila_data.py --output mila_export.xlsx
    python export_mila_data.py --output mila_export.xlsx --limit 100 --db-host postgres
"""

import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
from datetime import datetime
import json

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


def export_mila_data(output_file, limit=100, db_host='127.0.0.1'):
    """
    Export MILA archive data to Excel file.
    
    Args:
        output_file: Output Excel file path
        limit: Number of records to export (default: 100)
        db_host: Database host (default: 127.0.0.1)
    """
    print(f"[INFO] Exporting last {limit} MILA records from archive table")
    
    try:
        db_config = DB_CONFIG.copy()
        db_config['host'] = db_host
        
        with psycopg2.connect(**db_config) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get last N records ordered by created_at DESC (newest first)
                cur.execute("""
                    SELECT * FROM mila_monitor_logs_archive
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (limit,))
                
                rows = cur.fetchall()
                
                if not rows:
                    print("[INFO] No records found in mila_monitor_logs_archive table.")
                    return
                
                print(f"[INFO] Found {len(rows)} records")
                
                # Prepare data for Excel - include ALL columns
                export_data = []
                for row in rows:
                    # Parse JSON fields
                    receiver = row.get('receiver', [])
                    if isinstance(receiver, str):
                        receiver = json.loads(receiver or '[]')
                    elif receiver is None:
                        receiver = []
                    
                    bran_receiver = row.get('bran_receiver', {})
                    if isinstance(bran_receiver, str):
                        bran_receiver = json.loads(bran_receiver or '{}')
                    elif bran_receiver is None:
                        bran_receiver = {}
                    
                    yield_log = row.get('yield_log', {})
                    if isinstance(yield_log, str):
                        yield_log = json.loads(yield_log or '{}')
                    elif yield_log is None:
                        yield_log = {}
                    
                    setpoints_produced = row.get('setpoints_produced', {})
                    if isinstance(setpoints_produced, str):
                        setpoints_produced = json.loads(setpoints_produced or '{}')
                    elif setpoints_produced is None:
                        setpoints_produced = {}
                    
                    # Start with base columns
                    record = {
                        'ID': row.get('id'),
                        'Order Name': row.get('order_name'),
                        'Status': row.get('status'),
                        'Produced Weight (kg)': row.get('produced_weight'),
                        'Created At': row.get('created_at'),
                        'Order Start Time': row.get('order_start_time'),
                        'Order End Time': row.get('order_end_time'),
                    }
                    
                    # Flatten receiver (JSONB array)
                    if receiver and isinstance(receiver, list):
                        for idx, rec in enumerate(receiver):
                            prefix = f'Receiver {idx+1} ' if len(receiver) > 1 else 'Receiver '
                            record[f'{prefix}Bin ID'] = rec.get('bin_id', '')
                            record[f'{prefix}Material Code'] = rec.get('material_code', '')
                            record[f'{prefix}Material Name'] = rec.get('material_name', '')
                            record[f'{prefix}Weight (kg)'] = rec.get('weight_kg', 0)
                    else:
                        # Add empty columns if no receivers
                        record['Receiver Bin ID'] = ''
                        record['Receiver Material Code'] = ''
                        record['Receiver Material Name'] = ''
                        record['Receiver Weight (kg)'] = ''
                    
                    # Flatten bran_receiver (JSONB object)
                    if bran_receiver and isinstance(bran_receiver, dict):
                        for key, value in bran_receiver.items():
                            record[f'Bran Receiver {key}'] = value
                    
                    # Flatten yield_log (JSONB object)
                    if yield_log and isinstance(yield_log, dict):
                        for key, value in yield_log.items():
                            record[f'Yield {key}'] = value
                    
                    # Flatten setpoints_produced (JSONB object)
                    if setpoints_produced and isinstance(setpoints_produced, dict):
                        for key, value in setpoints_produced.items():
                            record[f'Setpoint {key}'] = value
                    
                    # Add raw JSON columns for reference
                    record['Receiver (JSON)'] = json.dumps(receiver) if receiver else ''
                    record['Bran Receiver (JSON)'] = json.dumps(bran_receiver) if bran_receiver else ''
                    record['Yield Log (JSON)'] = json.dumps(yield_log) if yield_log else ''
                    record['Setpoints Produced (JSON)'] = json.dumps(setpoints_produced) if setpoints_produced else ''
                    
                    export_data.append(record)
                
                # Create DataFrame and export to Excel
                df = pd.DataFrame(export_data)
                
                # Reorder columns to put important ones first
                base_columns = ['ID', 'Created At', 'Order Name', 'Status', 'Order Start Time', 'Order End Time', 'Produced Weight (kg)']
                
                # Get all other columns
                other_columns = [col for col in df.columns if col not in base_columns]
                
                # Reorder: base columns first, then others (sorted)
                column_order = base_columns + sorted(other_columns)
                # Only include columns that actually exist
                column_order = [col for col in column_order if col in df.columns]
                
                df = df[column_order]
                
                # Sort by created_at descending (newest first) - already sorted in SQL but ensure it
                if 'Created At' in df.columns:
                    df = df.sort_values('Created At', ascending=False)
                
                # Export to Excel
                df.to_excel(output_file, index=False, engine='openpyxl')
                
                print(f"[OK] Exported {len(rows)} records to {output_file}")
                print(f"[INFO] Records sorted by timestamp (newest first)")
                print(f"[INFO] First record timestamp: {df['Created At'].iloc[0] if len(df) > 0 else 'N/A'}")
                print(f"[INFO] Last record timestamp: {df['Created At'].iloc[-1] if len(df) > 0 else 'N/A'}")
                print(f"[INFO] Total columns exported: {len(df.columns)}")
                print(f"[INFO] Column names: {', '.join(df.columns[:10])}..." if len(df.columns) > 10 else f"[INFO] Column names: {', '.join(df.columns)}")
                
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='MILA Archive Data Export Tool')
    parser.add_argument('--output', default='mila_export.xlsx',
                        help='Output Excel file (default: mila_export.xlsx)')
    parser.add_argument('--limit', type=int, default=100,
                        help='Number of records to export (default: 100)')
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
    print("  MILA Archive Data Export Tool")
    print("=" * 60)
    print(f"  Output file: {args.output}")
    print(f"  Record limit: {args.limit}")
    print(f"  Database host: {args.db_host}")
    print("=" * 60)
    print()
    
    export_mila_data(args.output, args.limit, args.db_host)
    
    print("\n" + "=" * 60)

