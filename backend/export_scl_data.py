"""
SCL Archive Data Export Script
==============================
Exports SCL data from scl_monitor_logs_archive table to Excel file with all columns.

Usage:
------
    python export_scl_data.py --start 2025-12-01 --end 2025-12-20 --output scl_export.xlsx
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


def export_scl_data(start_date, end_date, output_file):
    """
    Export SCL archive data to Excel file with all columns.
    """
    print(f"[INFO] Exporting SCL data from {start_date} to {end_date}")
    
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM scl_monitor_logs_archive
                    WHERE created_at >= %s AND created_at < %s
                    ORDER BY created_at ASC
                """, (start_date, end_date))
                
                rows = cur.fetchall()
                
                if not rows:
                    print("[INFO] No records found for the specified date range.")
                    return
                
                print(f"[INFO] Found {len(rows)} records")
                
                # Prepare data for Excel - include ALL columns
                export_data = []
                for row in rows:
                    # Parse JSON fields
                    active_sources = row.get('active_sources', [])
                    if isinstance(active_sources, str):
                        active_sources = json.loads(active_sources or '[]')
                    elif active_sources is None:
                        active_sources = []
                    
                    active_destination = row.get('active_destination', {})
                    if isinstance(active_destination, str):
                        active_destination = json.loads(active_destination or '{}')
                    elif active_destination is None:
                        active_destination = {}
                    
                    per_bin_weights = row.get('per_bin_weights', {})
                    if isinstance(per_bin_weights, str):
                        per_bin_weights = json.loads(per_bin_weights or '{}')
                    elif per_bin_weights is None:
                        per_bin_weights = {}
                    
                    # Start with all base columns
                    record = {
                        'ID': row.get('id'),
                        'Job Status': row.get('job_status'),
                        'Line Running': row.get('line_running'),
                        'Receiver': row.get('receiver'),
                        'Flow Rate': row.get('flow_rate'),
                        'Produced Weight': row.get('produced_weight'),
                        'Water Consumed': row.get('water_consumed'),
                        'Moisture Offset': row.get('moisture_offset'),
                        'Moisture Setpoint': row.get('moisture_setpoint'),
                        'Order Name': row.get('order_name'),
                        'Created At': row.get('created_at'),
                    }
                    
                    # Flatten active_sources (JSONB array)
                    if active_sources and isinstance(active_sources, list):
                        for idx, src in enumerate(active_sources):
                            prefix = f'Source {idx+1} ' if len(active_sources) > 1 else 'Source '
                            record[f'{prefix}Bin ID'] = src.get('bin_id', '')
                            record[f'{prefix}Material Code'] = src.get('material_code', '')
                            record[f'{prefix}Material Name'] = src.get('material_name', '')
                            record[f'{prefix}Qty Percent'] = src.get('qty_percent', 0)
                            record[f'{prefix}Produced Qty'] = src.get('produced_qty', 0)
                    else:
                        # Add empty columns if no sources
                        record['Source Bin ID'] = ''
                        record['Source Material Code'] = ''
                        record['Source Material Name'] = ''
                        record['Source Qty Percent'] = ''
                        record['Source Produced Qty'] = ''
                    
                    # Flatten active_destination (JSONB object)
                    if active_destination and isinstance(active_destination, dict):
                        record['Destination Bin ID'] = active_destination.get('bin_id', '')
                        record['Destination Product Code'] = active_destination.get('product_code', '')
                        record['Destination Material'] = active_destination.get('material', '')
                        record['Destination Material Name'] = active_destination.get('material_name', '')
                    else:
                        record['Destination Bin ID'] = ''
                        record['Destination Product Code'] = ''
                        record['Destination Material'] = ''
                        record['Destination Material Name'] = ''
                    
                    # Flatten per_bin_weights (JSONB object or array)
                    if per_bin_weights:
                        if isinstance(per_bin_weights, dict):
                            # Dictionary format: {"bin_21": 100.5, "bin_22": 200.3, ...}
                            for bin_key, weight in per_bin_weights.items():
                                record[f'Per Bin Weight {bin_key}'] = weight
                        elif isinstance(per_bin_weights, list):
                            # Array format: [{"bin_id": "21", "total_weight": 100.5}, ...]
                            for idx, bin_data in enumerate(per_bin_weights):
                                if isinstance(bin_data, dict):
                                    bin_id = bin_data.get('bin_id', f'bin_{idx+1}')
                                    weight = bin_data.get('total_weight', 0)
                                    record[f'Per Bin Weight {bin_id}'] = weight
                    
                    # Add raw JSON columns for reference
                    record['Active Sources (JSON)'] = json.dumps(active_sources) if active_sources else ''
                    record['Active Destination (JSON)'] = json.dumps(active_destination) if active_destination else ''
                    record['Per Bin Weights (JSON)'] = json.dumps(per_bin_weights) if per_bin_weights else ''
                    
                    export_data.append(record)
                
                # Create DataFrame and export to Excel
                df = pd.DataFrame(export_data)
                
                # Reorder columns to put important ones first
                base_columns = ['ID', 'Created At', 'Order Name', 'Job Status', 'Line Running', 
                               'Receiver', 'Flow Rate', 'Produced Weight', 'Water Consumed',
                               'Moisture Offset', 'Moisture Setpoint']
                
                # Get all other columns
                other_columns = [col for col in df.columns if col not in base_columns]
                
                # Reorder: base columns first, then others
                column_order = base_columns + sorted(other_columns)
                # Only include columns that actually exist
                column_order = [col for col in column_order if col in df.columns]
                
                df = df[column_order]
                
                # Export to Excel
                df.to_excel(output_file, index=False, engine='openpyxl')
                
                print(f"[OK] Exported {len(rows)} records to {output_file}")
                print(f"[INFO] Total columns exported: {len(df.columns)}")
                print(f"[INFO] Column names: {', '.join(df.columns[:10])}..." if len(df.columns) > 10 else f"[INFO] Column names: {', '.join(df.columns)}")
                
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='SCL Archive Data Export Tool')
    parser.add_argument('--start', default='2025-12-01',
                        help='Start date (YYYY-MM-DD, default: 2025-12-01)')
    parser.add_argument('--end', default='2025-12-20',
                        help='End date (YYYY-MM-DD, default: 2025-12-20)')
    parser.add_argument('--output', default='scl_export.xlsx',
                        help='Output Excel file (default: scl_export.xlsx)')
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
    print("  SCL Archive Data Export Tool")
    print("=" * 60)
    
    export_scl_data(args.start, args.end, args.output)
    
    print("\n" + "=" * 60)

