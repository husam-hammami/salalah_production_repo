"""
Diagnostic script to check MILA B1Scale values in database
and compare with what the system calculates.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import json

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

def check_mila_b1(start_date, end_date):
    """
    Check B1Scale values in database and calculate totals.
    """
    # Parse dates
    start_datetime = datetime.strptime(start_date, '%Y-%m-%d %H:%M:%S')
    end_datetime = datetime.strptime(end_date, '%Y-%m-%d %H:%M:%S')
    
    # Match system logic: -5 min buffer on start, +5 min buffer on end
    start_with_buffer = start_datetime - timedelta(minutes=5)
    end_with_buffer = end_datetime + timedelta(minutes=5)
    
    print("=" * 80)
    print(f"Checking MILA B1Scale for: {start_date} to {end_date}")
    print(f"Query range (with buffer): {start_with_buffer} to {end_with_buffer}")
    print("=" * 80)
    
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get all records in range
                cur.execute("""
                    SELECT * FROM mila_monitor_logs_archive
                    WHERE created_at >= %s AND created_at <= %s
                    ORDER BY created_at ASC
                """, (start_with_buffer, end_with_buffer))
                rows = cur.fetchall()
                
                print(f"\nTotal records found: {len(rows)}")
                
                if not rows:
                    print("No records found!")
                    return
                
                # Show all records
                print("\n" + "-" * 80)
                print("ALL RECORDS IN RANGE:")
                print("-" * 80)
                for i, record in enumerate(rows, 1):
                    created_at = record.get("created_at")
                    record_id = record.get("id")
                    order_name = record.get("order_name")
                    
                    bran_receiver = record.get("bran_receiver")
                    if isinstance(bran_receiver, str):
                        bran_receiver = json.loads(bran_receiver or "{}")
                    if bran_receiver is None:
                        bran_receiver = {}
                    
                    b1_value = bran_receiver.get("B1Scale (kg)", 0)
                    
                    print(f"Record {i:2d} | ID: {record_id:6d} | Order: {order_name:10s} | "
                          f"Created: {created_at} | B1Scale: {b1_value:15.3f} kg")
                
                print("-" * 80)
                
                # Calculate delta (what system does)
                first_record = rows[0]
                last_record = rows[-1]
                
                first_bran = first_record.get("bran_receiver")
                last_bran = last_record.get("bran_receiver")
                
                if isinstance(first_bran, str):
                    first_bran = json.loads(first_bran or "{}")
                if isinstance(last_bran, str):
                    last_bran = json.loads(last_bran or "{}")
                
                if first_bran is None:
                    first_bran = {}
                if last_bran is None:
                    last_bran = {}
                
                first_b1 = float(first_bran.get("B1Scale (kg)", 0))
                last_b1 = float(last_bran.get("B1Scale (kg)", 0))
                delta_b1 = last_b1 - first_b1
                
                print("\n" + "=" * 80)
                print("B1Scale DELTA CALCULATION (System Method - Using Buffer):")
                print("=" * 80)
                print(f"First record ({first_record.get('created_at')}): {first_b1:,.3f} kg")
                print(f"Last record ({last_record.get('created_at')}): {last_b1:,.3f} kg")
                print(f"Delta (Last - First): {delta_b1:,.3f} kg")
                print(f"Delta in tons: {delta_b1 / 1000:,.3f} tons")
                print("=" * 80)
                
                # Calculate correct delta (only records within exact time range)
                # Include records at exactly start and end times
                exact_rows = [r for r in rows if start_datetime <= r.get('created_at') <= end_datetime]
                if exact_rows:
                    exact_first = exact_rows[0]
                    exact_last = exact_rows[-1]
                    
                    exact_first_bran = exact_first.get("bran_receiver")
                    exact_last_bran = exact_last.get("bran_receiver")
                    
                    if isinstance(exact_first_bran, str):
                        exact_first_bran = json.loads(exact_first_bran or "{}")
                    if isinstance(exact_last_bran, str):
                        exact_last_bran = json.loads(exact_last_bran or "{}")
                    
                    exact_first_b1 = float(exact_first_bran.get("B1Scale (kg)", 0)) if exact_first_bran else 0
                    exact_last_b1 = float(exact_last_bran.get("B1Scale (kg)", 0)) if exact_last_bran else 0
                    exact_delta_b1 = exact_last_b1 - exact_first_b1
                    
                    print("\n" + "=" * 80)
                    print("B1Scale DELTA CALCULATION (CORRECT - Exact Time Range):")
                    print("=" * 80)
                    print(f"First record ({exact_first.get('created_at')}): {exact_first_b1:,.3f} kg")
                    print(f"Last record ({exact_last.get('created_at')}): {exact_last_b1:,.3f} kg")
                    print(f"Delta (Last - First): {exact_delta_b1:,.3f} kg")
                    print(f"Delta in tons: {exact_delta_b1 / 1000:,.3f} tons")
                    print(f"\n⚠️  DIFFERENCE: {exact_delta_b1 - delta_b1:,.3f} kg ({abs(exact_delta_b1 - delta_b1) / 1000:,.3f} tons)")
                    print("=" * 80)
                else:
                    print("\n⚠️  No records found in exact time range!")
                
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) >= 3:
        start_date = sys.argv[1]
        end_date = sys.argv[2]
    else:
        # Default to Jan 5-6, 2026
        start_date = "2026-01-07 07:00:00"
        end_date = "2026-01-07 08:05:00"
    
    check_mila_b1(start_date, end_date)

