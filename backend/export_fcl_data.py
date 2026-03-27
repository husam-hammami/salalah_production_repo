"""
FCL Archive Data Export Script
==============================
Exports FCL data from fcl_monitor_logs_archive table to Excel file.

Usage:
------
    python export_fcl_data.py --start 2025-12-01 --end 2025-12-08 --output fcl_export.xlsx
"""

import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
from datetime import datetime, timedelta
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


def export_fcl_data(start_date, end_date, output_file, include_all_records=False):
    """
    Export FCL archive data to Excel file with all columns matching table schema.
    Matches the system's filtering logic used in FCL Daily Report.
    
    Args:
        start_date: Start date/time (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD)
        end_date: End date/time (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD)
        output_file: Output Excel file path
        include_all_records: If True, includes all records (no line_running filter).
                            If False, only includes records where line_running=true or NULL (matches UI count).
    """
    # Parse dates with time support
    try:
        if len(start_date) <= 10:  # Just date, add default time 05:00:00
            start_datetime_str = f"{start_date} 05:00:00"
        else:
            start_datetime_str = start_date
        
        if len(end_date) <= 10:  # Just date, add default time 05:00:00
            end_datetime_str = f"{end_date} 05:00:00"
        else:
            end_datetime_str = end_date
        
        # Parse to datetime objects
        start_datetime = datetime.strptime(start_datetime_str, '%Y-%m-%d %H:%M:%S')
        end_datetime = datetime.strptime(end_datetime_str, '%Y-%m-%d %H:%M:%S')
    except:
        # Fallback if parsing fails
        start_datetime = datetime.strptime(start_date, '%Y-%m-%d %H:%M:%S') if len(start_date) > 10 else datetime.strptime(f"{start_date} 05:00:00", '%Y-%m-%d %H:%M:%S')
        end_datetime = datetime.strptime(end_date, '%Y-%m-%d %H:%M:%S') if len(end_date) > 10 else datetime.strptime(f"{end_date} 05:00:00", '%Y-%m-%d %H:%M:%S')
    
    # ✅ Match system logic: Add +1 minute buffer to start time (excludes records at exactly start time)
    # This matches the FCL summary endpoint behavior
    start_with_buffer = start_datetime + timedelta(minutes=1)
    end_with_buffer = end_datetime  # End time is inclusive (uses <=)
    
    print(f"[INFO] Exporting FCL data from {start_datetime} to {end_datetime}")
    print(f"[INFO] Applied filter: created_at >= {start_with_buffer} AND created_at <= {end_with_buffer}")
    if not include_all_records:
        print(f"[INFO] Filtering: line_running = true OR line_running IS NULL (matches UI record count)")
    else:
        print(f"[INFO] Including ALL records (no line_running filter)")
    
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # ✅ Match system logic: Use >= start_with_buffer AND <= end_with_buffer
                # ✅ Optionally filter by line_running to match UI record count
                if include_all_records:
                    cur.execute("""
                        SELECT * FROM fcl_monitor_logs_archive
                        WHERE created_at >= %s AND created_at <= %s
                        ORDER BY created_at ASC
                    """, (start_with_buffer, end_with_buffer))
                else:
                    cur.execute("""
                        SELECT * FROM fcl_monitor_logs_archive
                        WHERE created_at >= %s 
                          AND created_at <= %s
                          AND (line_running = true OR line_running IS NULL)
                        ORDER BY created_at ASC
                    """, (start_with_buffer, end_with_buffer))
                
                rows = cur.fetchall()
                
                if not rows:
                    print("[INFO] No records found for the specified date range.")
                    return
                
                print(f"[INFO] Found {len(rows)} records")
                
                # Prepare data for Excel - include ALL columns matching table schema
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
                    
                    fcl_receivers = row.get('fcl_receivers', [])
                    if isinstance(fcl_receivers, str):
                        fcl_receivers = json.loads(fcl_receivers or '[]')
                    elif fcl_receivers is None:
                        fcl_receivers = []
                    
                    per_bin_weights = row.get('per_bin_weights', {})
                    if isinstance(per_bin_weights, str):
                        per_bin_weights = json.loads(per_bin_weights or '{}')
                    elif per_bin_weights is None:
                        per_bin_weights = {}
                    
                    # Start with all base columns matching table schema
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
                        'Cleaning Scale Bypass': row.get('cleaning_scale_bypass'),
                    }
                    
                    # Flatten active_sources (JSONB array)
                    if active_sources and isinstance(active_sources, list):
                        for idx, src in enumerate(active_sources):
                            prefix = f'Source {idx+1} ' if len(active_sources) > 1 else 'Source '
                            # Handle nested material object
                            material = src.get('material', {})
                            if isinstance(material, dict):
                                record[f'{prefix}Material Code'] = material.get('material_code', '')
                                record[f'{prefix}Material Name'] = material.get('material_name', '')
                            else:
                                record[f'{prefix}Material Code'] = src.get('material_code', '')
                                record[f'{prefix}Material Name'] = src.get('material_name', '')
                            record[f'{prefix}Bin ID'] = src.get('bin_id', '')
                            record[f'{prefix}Qty Percent'] = src.get('qty_percent', 0)
                            record[f'{prefix}Produced Qty'] = src.get('produced_qty', 0)
                            record[f'{prefix}Flowrate (t/h)'] = src.get('flowrate_tph', src.get('weight', 0))
                            record[f'{prefix}Is Active'] = src.get('is_active', False)
                            record[f'{prefix}Source Index'] = src.get('source_index', idx + 1)
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
                        record['Destination Dest No'] = active_destination.get('dest_no', '')
                        record['Destination Prd Code'] = active_destination.get('prd_code', '')
                        # Handle nested material object
                        material = active_destination.get('material', {})
                        if isinstance(material, dict):
                            record['Destination Material Code'] = material.get('material_code', '')
                            record['Destination Material Name'] = material.get('material_name', '')
                        else:
                            record['Destination Material Code'] = active_destination.get('material_code', '')
                            record['Destination Material Name'] = active_destination.get('material_name', '')
                    else:
                        record['Destination Bin ID'] = ''
                        record['Destination Dest No'] = ''
                        record['Destination Prd Code'] = ''
                        record['Destination Material Code'] = ''
                        record['Destination Material Name'] = ''
                    
                    # Flatten fcl_receivers (JSONB array)
                    if fcl_receivers and isinstance(fcl_receivers, list):
                        for idx, rec in enumerate(fcl_receivers):
                            prefix = f'Receiver {idx+1} ' if len(fcl_receivers) > 1 else 'Receiver '
                            record[f'{prefix}ID'] = rec.get('id', '')
                            record[f'{prefix}Name'] = rec.get('name', '')
                            record[f'{prefix}Location'] = rec.get('location', '')
                            record[f'{prefix}Weight'] = rec.get('weight', rec.get('weight_kg', 0))
                            record[f'{prefix}Bin ID'] = rec.get('bin_id', '')
                    else:
                        # Add empty columns if no receivers
                        record['Receiver ID'] = ''
                        record['Receiver Name'] = ''
                        record['Receiver Location'] = ''
                        record['Receiver Weight'] = ''
                    
                    # Flatten per_bin_weights (JSONB object or array)
                    if per_bin_weights:
                        if isinstance(per_bin_weights, dict):
                            # Dictionary format: {"bin_21": 100.5, "bin_22": 200.3, ...}
                            for bin_key, weight in per_bin_weights.items():
                                record[f'Per Bin Weight {bin_key}'] = weight
                        elif isinstance(per_bin_weights, list):
                            # Array format: [{"bin_id": 21, "total_weight": 100.5}, ...]
                            for idx, bin_data in enumerate(per_bin_weights):
                                if isinstance(bin_data, dict):
                                    bin_id = bin_data.get('bin_id', f'bin_{idx+1}')
                                    weight = bin_data.get('total_weight', 0)
                                    record[f'Per Bin Weight Bin {bin_id}'] = weight
                    
                    # Add raw JSON columns for reference
                    record['Active Sources (JSON)'] = json.dumps(active_sources) if active_sources else ''
                    record['Active Destination (JSON)'] = json.dumps(active_destination) if active_destination else ''
                    record['FCL Receivers (JSON)'] = json.dumps(fcl_receivers) if fcl_receivers else ''
                    record['Per Bin Weights (JSON)'] = json.dumps(per_bin_weights) if per_bin_weights else ''
                    
                    export_data.append(record)
                
                # Create DataFrame and export to Excel
                df = pd.DataFrame(export_data)
                
                # Reorder columns to put important ones first
                base_columns = ['ID', 'Created At', 'Order Name', 'Job Status', 'Line Running', 
                               'Receiver', 'Flow Rate', 'Produced Weight', 'Water Consumed',
                               'Moisture Offset', 'Moisture Setpoint', 'Cleaning Scale Bypass']
                
                # Get all other columns
                other_columns = [col for col in df.columns if col not in base_columns]
                
                # Reorder: base columns first, then others (sorted)
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
    parser = argparse.ArgumentParser(description='FCL Archive Data Export Tool')
    parser.add_argument('--start', default='2025-12-12 05:00:00',
                        help='Start date/time (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD, default: 2025-12-12 05:00:00)')
    parser.add_argument('--end', default='2025-12-13 05:00:00',
                        help='End date/time (YYYY-MM-DD HH:MM:SS or YYYY-MM-DD, default: 2025-12-13 05:00:00)')
    parser.add_argument('--output', default='fcl_export.xlsx',
                        help='Output Excel file (default: fcl_export.xlsx)')
    parser.add_argument('--all-records', action='store_true',
                        help='Include all records (no line_running filter). Default: only production records (line_running=true or NULL)')
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
    print("  FCL Archive Data Export Tool")
    print("=" * 60)
    
    export_fcl_data(args.start, args.end, args.output, include_all_records=args.all_records)
    
    print("\n" + "=" * 60)

