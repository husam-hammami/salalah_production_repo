"""
FCL 2_520WE Data Export Script
==============================
Exports the last 1000 FCL records containing FCL_2_520WE receiver to Excel file.
Records are sorted by timestamp in descending order (newest first).

Usage:
------
    python export_fcl_520we_data.py --output fcl_520we_export.xlsx
    python export_fcl_520we_data.py --output fcl_520we_export.xlsx --limit 1000 --db-host postgres
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


def export_fcl_520we_data(output_file, limit=1000, db_host='127.0.0.1'):
    """
    Export FCL archive data containing FCL_2_520WE receiver to Excel file.
    
    Args:
        output_file: Output Excel file path
        limit: Number of records to export (default: 1000)
        db_host: Database host (default: 127.0.0.1)
    """
    print(f"[INFO] Exporting last {limit} FCL records containing FCL_2_520WE")
    
    try:
        db_config = DB_CONFIG.copy()
        db_config['host'] = db_host
        
        with psycopg2.connect(**db_config) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Query records where fcl_receivers contains FCL_2_520WE
                # Using JSONB containment operator (@>) to check if array contains object with id='FCL_2_520WE'
                cur.execute("""
                    SELECT * FROM fcl_monitor_logs_archive
                    WHERE fcl_receivers @> '[{"id": "FCL_2_520WE"}]'::jsonb
                       OR fcl_receivers @> '[{"name": "FCL 2_520WE"}]'::jsonb
                    ORDER BY created_at DESC
                    LIMIT %s
                """, (limit,))
                
                rows = cur.fetchall()
                
                if not rows:
                    print("[INFO] No records found containing FCL_2_520WE receiver.")
                    return
                
                print(f"[INFO] Found {len(rows)} records")
                
                # Prepare data for Excel
                export_data = []
                for row in rows:
                    # Parse JSON fields
                    active_sources = row.get('active_sources', [])
                    if isinstance(active_sources, str):
                        active_sources = json.loads(active_sources or '[]')
                    
                    active_destination = row.get('active_destination', {})
                    if isinstance(active_destination, str):
                        active_destination = json.loads(active_destination or '{}')
                    
                    fcl_receivers = row.get('fcl_receivers', [])
                    if isinstance(fcl_receivers, str):
                        fcl_receivers = json.loads(fcl_receivers or '[]')
                    
                    per_bin_weights = row.get('per_bin_weights', [])
                    if isinstance(per_bin_weights, str):
                        per_bin_weights = json.loads(per_bin_weights or '[]')
                    
                    # Extract FCL_2_520WE weight
                    fcl_520we_weight = 0
                    fcl_520we_location = ''
                    for rec in fcl_receivers:
                        rec_id = rec.get('id', '')
                        rec_name = rec.get('name', '')
                        if rec_id == 'FCL_2_520WE' or rec_name == 'FCL 2_520WE':
                            fcl_520we_weight = rec.get('weight', 0)
                            fcl_520we_location = rec.get('location', '')
                            break
                    
                    # Extract other receiver weights
                    output_bin_weight = 0
                    for rec in fcl_receivers:
                        if rec.get('id') == '0000' or rec.get('name') == 'Output Bin':
                            output_bin_weight = rec.get('weight', 0)
                            break
                    
                    # Format active_sources as readable string
                    sources_str = ''
                    if active_sources:
                        source_parts = []
                        for src in active_sources:
                            bin_id = src.get('bin_id', '')
                            material_code = src.get('material', {}).get('material_code', '') if isinstance(src.get('material'), dict) else ''
                            material_name = src.get('material', {}).get('material_name', '') if isinstance(src.get('material'), dict) else ''
                            qty_percent = src.get('qty_percent', 0)
                            source_parts.append(f"Bin{bin_id}:{material_code}({material_name}) {qty_percent}%")
                        sources_str = ' | '.join(source_parts)
                    
                    # Format active_destination as readable string
                    dest_str = ''
                    if active_destination:
                        dest_bin_id = active_destination.get('bin_id', '')
                        dest_no = active_destination.get('dest_no', '')
                        prd_code = active_destination.get('prd_code', '')
                        material = active_destination.get('material', {})
                        if isinstance(material, dict):
                            material_code = material.get('material_code', '')
                            material_name = material.get('material_name', '')
                            dest_str = f"Bin{dest_bin_id} Dest{dest_no} Prd{prd_code} {material_code}({material_name})"
                        else:
                            dest_str = f"Bin{dest_bin_id} Dest{dest_no} Prd{prd_code}"
                    
                    # Format per_bin_weights as readable string
                    per_bin_str = ''
                    if per_bin_weights:
                        bin_parts = []
                        for bin_data in per_bin_weights:
                            bin_id = bin_data.get('bin_id', '')
                            total_weight = bin_data.get('total_weight', 0)
                            bin_parts.append(f"Bin{bin_id}:{total_weight}kg")
                        per_bin_str = ' | '.join(bin_parts)
                    
                    # Format fcl_receivers as readable string
                    receivers_str = ''
                    if fcl_receivers:
                        rec_parts = []
                        for rec in fcl_receivers:
                            rec_id = rec.get('id', '')
                            rec_name = rec.get('name', '')
                            rec_weight = rec.get('weight', 0)
                            rec_location = rec.get('location', '')
                            rec_parts.append(f"{rec_name}({rec_id}): {rec_weight}kg @ {rec_location}")
                        receivers_str = ' | '.join(rec_parts)
                    
                    export_data.append({
                        'ID': row.get('id'),
                        'Job Status': row.get('job_status'),
                        'Line Running': row.get('line_running'),
                        'Receiver (kg)': row.get('receiver'),
                        'Flow Rate (t/h)': row.get('flow_rate'),
                        'Produced Weight (kg)': row.get('produced_weight'),
                        'Water Consumed': row.get('water_consumed'),
                        'Moisture Offset': row.get('moisture_offset'),
                        'Moisture Setpoint': row.get('moisture_setpoint'),
                        'Active Sources': sources_str,
                        'Active Destination': dest_str,
                        'Order Name': row.get('order_name'),
                        'Per Bin Weights': per_bin_str,
                        'FCL Receivers': receivers_str,
                        'FCL_2_520WE Weight (kg)': fcl_520we_weight,
                        'FCL_2_520WE Location': fcl_520we_location,
                        'Output Bin Weight (kg)': output_bin_weight,
                        'Cleaning Scale Bypass': row.get('cleaning_scale_bypass'),
                        'Created At': row.get('created_at')
                    })
                
                # Create DataFrame and export to Excel
                df = pd.DataFrame(export_data)
                
                # Sort by created_at descending (newest first) - already sorted in SQL but ensure it
                df = df.sort_values('Created At', ascending=False)
                
                # Export to Excel
                df.to_excel(output_file, index=False, engine='openpyxl')
                
                print(f"[OK] Exported {len(rows)} records to {output_file}")
                print(f"[INFO] Records sorted by timestamp (newest first)")
                print(f"[INFO] First record timestamp: {df['Created At'].iloc[0] if len(df) > 0 else 'N/A'}")
                print(f"[INFO] Last record timestamp: {df['Created At'].iloc[-1] if len(df) > 0 else 'N/A'}")
                
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='FCL 2_520WE Data Export Tool')
    parser.add_argument('--output', default='fcl_520we_export.xlsx',
                        help='Output Excel file (default: fcl_520we_export.xlsx)')
    parser.add_argument('--limit', type=int, default=1000,
                        help='Number of records to export (default: 1000)')
    parser.add_argument('--db-host', default='127.0.0.1',
                        help='Database host (default: 127.0.0.1, use "postgres" for Docker)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("  FCL 2_520WE Data Export Tool")
    print("=" * 60)
    print(f"  Output file: {args.output}")
    print(f"  Record limit: {args.limit}")
    print(f"  Database host: {args.db_host}")
    print("=" * 60)
    print()
    
    export_fcl_520we_data(args.output, args.limit, args.db_host)
    
    print("\n" + "=" * 60)

