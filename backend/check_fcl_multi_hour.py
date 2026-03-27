"""
Diagnostic script to check FCL records for multi-hour periods
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

def check_fcl_records(start_date, end_date):
    """
    Check FCL records in database for the time range.
    """
    # Parse dates
    start_datetime = datetime.strptime(start_date, '%Y-%m-%d %H:%M:%S')
    end_datetime = datetime.strptime(end_date, '%Y-%m-%d %H:%M:%S')
    
    # Apply same logic as FCL summary
    time_diff = end_datetime - start_datetime
    is_daily_or_longer = time_diff >= timedelta(hours=23, minutes=59)
    
    if is_daily_or_longer:
        start_with_buffer = start_datetime + timedelta(minutes=1)
        print(f"[INFO] Daily/Weekly/Monthly report ({time_diff}), using +1 minute buffer")
    else:
        start_with_buffer = start_datetime
        print(f"[INFO] Hourly/Multi-hour report ({time_diff}), using exact start time (no buffer)")
    
    end_with_buffer = end_datetime
    
    print("=" * 80)
    print(f"Checking FCL records for: {start_date} to {end_date}")
    print(f"Query range: {start_with_buffer} to {end_with_buffer}")
    print("=" * 80)
    
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get all records (no line_running filter)
                cur.execute("""
                    SELECT * FROM fcl_monitor_logs_archive
                    WHERE created_at >= %s AND created_at <= %s
                    ORDER BY created_at ASC
                """, (start_with_buffer, end_with_buffer))
                all_rows = cur.fetchall()
                
                # Get production records (line_running filter)
                cur.execute("""
                    SELECT * FROM fcl_monitor_logs_archive
                    WHERE created_at >= %s 
                      AND created_at <= %s
                      AND (line_running = true OR line_running IS NULL)
                    ORDER BY created_at ASC
                """, (start_with_buffer, end_with_buffer))
                rows = cur.fetchall()
                
                print(f"\nTotal records (all): {len(all_rows)}")
                print(f"Production records (line_running=true or NULL): {len(rows)}")
                
                if not rows:
                    print("No production records found!")
                    return
                
                # Show all production records
                print("\n" + "-" * 80)
                print("PRODUCTION RECORDS IN RANGE:")
                print("-" * 80)
                for i, record in enumerate(rows, 1):
                    created_at = record.get("created_at")
                    record_id = record.get("id")
                    order_name = record.get("order_name")
                    produced_weight = record.get("produced_weight")
                    receiver = record.get("receiver")
                    
                    # Get FCL_2_520WE cumulative value
                    fcl_receivers = record.get("fcl_receivers")
                    if isinstance(fcl_receivers, str):
                        fcl_receivers = json.loads(fcl_receivers or "[]")
                    if fcl_receivers is None:
                        fcl_receivers = []
                    
                    cumulative_value = None
                    for rec in fcl_receivers:
                        if rec.get("id") == "FCL_2_520WE" and rec.get("location") in ["Cumulative Counter", "FCL 2_520WE"]:
                            cumulative_value = float(rec.get("weight_kg") or rec.get("weight") or 0)
                            break
                    
                    print(f"Record {i:2d} | ID: {record_id:6d} | Order: {order_name:10s} | "
                          f"Created: {created_at} | Produced: {produced_weight:10.3f} kg | "
                          f"Receiver: {receiver:10.3f} kg | FCL_2_520WE: {cumulative_value if cumulative_value is not None else 'N/A'}")
                
                print("-" * 80)
                
                # Calculate delta
                if len(rows) >= 2:
                    first_record = rows[0]
                    last_record = rows[-1]
                    
                    first_fcl_receivers = first_record.get("fcl_receivers")
                    last_fcl_receivers = last_record.get("fcl_receivers")
                    
                    if isinstance(first_fcl_receivers, str):
                        first_fcl_receivers = json.loads(first_fcl_receivers or "[]")
                    if isinstance(last_fcl_receivers, str):
                        last_fcl_receivers = json.loads(last_fcl_receivers or "[]")
                    
                    first_weight = 0
                    last_weight = 0
                    
                    for rec in first_fcl_receivers:
                        if rec.get("id") == "FCL_2_520WE" and rec.get("location") in ["Cumulative Counter", "FCL 2_520WE"]:
                            first_weight = float(rec.get("weight_kg") or rec.get("weight") or 0)
                            break
                    
                    for rec in last_fcl_receivers:
                        if rec.get("id") == "FCL_2_520WE" and rec.get("location") in ["Cumulative Counter", "FCL 2_520WE"]:
                            last_weight = float(rec.get("weight_kg") or rec.get("weight") or 0)
                            break
                    
                    delta = last_weight - first_weight
                    
                    print("\n" + "=" * 80)
                    print("DELTA CALCULATION:")
                    print("=" * 80)
                    print(f"First record ({first_record.get('created_at')}): {first_weight:,.3f} kg")
                    print(f"Last record ({last_record.get('created_at')}): {last_weight:,.3f} kg")
                    print(f"Delta (Last - First): {delta:,.3f} kg")
                    print(f"Delta in tons: {delta / 1000:,.3f} tons")
                    
                    # Also calculate sum of produced_weight
                    total_produced_sum = sum(float(r.get("produced_weight") or 0) for r in rows)
                    print(f"\nSum of produced_weight from all records: {total_produced_sum:,.3f} kg")
                    print(f"Sum in tons: {total_produced_sum / 1000:,.3f} tons")
                    print("=" * 80)
                elif len(rows) == 1:
                    print("\n[INFO] Only 1 record found - delta calculation not applicable")
                
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
        # Default to 1 PM to 3 PM
        start_date = "2026-01-06 13:00:00"
        end_date = "2026-01-06 15:00:00"
    
    check_fcl_records(start_date, end_date)

