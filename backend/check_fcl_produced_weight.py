"""
Diagnostic script to check FCL produced_weight values in database
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

def check_produced_weight(start_date, end_date):
    """
    Check produced_weight values in database and calculate totals.
    """
    # Parse dates
    start_datetime = datetime.strptime(start_date, '%Y-%m-%d %H:%M:%S')
    end_datetime = datetime.strptime(end_date, '%Y-%m-%d %H:%M:%S')
    
    # Match system logic: +1 minute buffer on start, inclusive end
    start_with_buffer = start_datetime + timedelta(minutes=1)
    end_with_buffer = end_datetime
    
    print("=" * 80)
    print(f"Checking FCL Produced Weight for: {start_date} to {end_date}")
    print(f"Query range: {start_with_buffer} to {end_with_buffer}")
    print("=" * 80)
    
    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get all records (no line_running filter) - like system's all_rows
                cur.execute("""
                    SELECT * FROM fcl_monitor_logs_archive
                    WHERE created_at >= %s AND created_at <= %s
                    ORDER BY created_at ASC
                """, (start_with_buffer, end_with_buffer))
                all_rows = cur.fetchall()
                
                # Get production records (line_running filter) - like system's rows
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
                
                # Show all records to see which ones have line_running=false
                print("\n" + "-" * 80)
                print("ALL RECORDS (including line_running=false):")
                print("-" * 80)
                for i, record in enumerate(all_rows, 1):
                    created_at = record.get("created_at")
                    record_id = record.get("id")
                    line_running = record.get("line_running")
                    fcl_receivers = record.get("fcl_receivers")
                    if isinstance(fcl_receivers, str):
                        fcl_receivers = json.loads(fcl_receivers or "[]")
                    if fcl_receivers is None:
                        fcl_receivers = []
                    
                    # Find FCL_2_520WE cumulative counter
                    cumulative_weight = None
                    for rec in fcl_receivers:
                        if rec.get("id") == "FCL_2_520WE" and rec.get("location") in ["Cumulative Counter", "FCL 2_520WE"]:
                            cumulative_weight = float(rec.get("weight_kg") or rec.get("weight") or 0)
                            break
                    
                    line_running_str = str(line_running) if line_running is not None else "None"
                    print(f"Record {i:2d} | ID: {record_id:6d} | Created: {created_at} | "
                          f"Line Running: {line_running_str:5s} | FCL_2_520WE: {cumulative_weight if cumulative_weight is not None else 'N/A'}")
                print("-" * 80)
                
                # Calculate produced_weight sum (what system does)
                total_produced_weight = 0
                print("\n" + "-" * 80)
                print("PRODUCED WEIGHT BREAKDOWN (from production records):")
                print("-" * 80)
                for i, record in enumerate(rows, 1):
                    produced = float(record.get("produced_weight") or 0)
                    total_produced_weight += produced
                    created_at = record.get("created_at")
                    record_id = record.get("id")
                    line_running = record.get("line_running")
                    print(f"Record {i:2d} | ID: {record_id:6d} | Created: {created_at} | "
                          f"Produced: {produced:12.3f} kg | Line Running: {line_running}")
                
                total_produced_weight = round(total_produced_weight, 3)
                print("-" * 80)
                print(f"TOTAL PRODUCED WEIGHT (summed): {total_produced_weight} kg")
                print("-" * 80)
                
                # Also check receiver values
                main_receiver_sum = 0
                print("\n" + "-" * 80)
                print("RECEIVER BREAKDOWN (from production records):")
                print("-" * 80)
                for i, record in enumerate(rows, 1):
                    receiver_val = float(record.get("receiver") or 0)
                    main_receiver_sum += receiver_val
                    created_at = record.get("created_at")
                    record_id = record.get("id")
                    print(f"Record {i:2d} | ID: {record_id:6d} | Created: {created_at} | "
                          f"Receiver: {receiver_val:12.3f} kg")
                
                main_receiver_sum = round(main_receiver_sum, 3)
                print("-" * 80)
                print(f"TOTAL RECEIVER (summed): {main_receiver_sum} kg")
                print("-" * 80)
                
                # Check FCL_2_520WE delta (what system shows as "Produced" in Receiver section)
                if all_rows:
                    first_record = all_rows[0]
                    last_record = all_rows[-1]
                    
                    first_fcl_receivers = first_record.get("fcl_receivers")
                    last_fcl_receivers = last_record.get("fcl_receivers")
                    
                    if isinstance(first_fcl_receivers, str):
                        first_fcl_receivers = json.loads(first_fcl_receivers or "[]")
                    if isinstance(last_fcl_receivers, str):
                        last_fcl_receivers = json.loads(last_fcl_receivers or "[]")
                    
                    if first_fcl_receivers is None:
                        first_fcl_receivers = []
                    if last_fcl_receivers is None:
                        last_fcl_receivers = []
                    
                    cumulative_locations = ["Cumulative Counter", "FCL 2_520WE"]
                    
                    output_bin_delta = 0
                    cumulative_counter_last = 0
                    
                    for last_rec in last_fcl_receivers:
                        location = last_rec.get("location", "")
                        last_weight = float(last_rec.get("weight_kg") or last_rec.get("weight") or 0)
                        
                        if last_rec.get("id") == "FCL_2_520WE" and location in cumulative_locations:
                            first_rec = next((r for r in first_fcl_receivers 
                                             if r.get("id") == "FCL_2_520WE" and r.get("location") in cumulative_locations), None)
                            first_weight = float(first_rec.get("weight_kg") or first_rec.get("weight") or 0) if first_rec else 0
                            
                            output_bin_delta = last_weight - first_weight
                            cumulative_counter_last = last_weight
                            
                            print("\n" + "-" * 80)
                            print("FCL_2_520WE CUMULATIVE COUNTER DELTA:")
                            print("-" * 80)
                            print(f"First record ({first_record.get('created_at')}): {first_weight} kg")
                            print(f"Last record ({last_record.get('created_at')}): {last_weight} kg")
                            print(f"Delta (Output Bin): {output_bin_delta} kg")
                            print(f"Last value (Cumulative Counter): {cumulative_counter_last} kg")
                            print("-" * 80)
                            
                            # This is what the system shows as "Produced" in the Receiver section
                            print(f"\n[WARNING] SYSTEM SHOWS THIS AS 'Produced' IN RECEIVER: {output_bin_delta} kg")
                            print(f"[WARNING] BUT PRODUCED_WEIGHT SUM IS: {total_produced_weight} kg")
                            print(f"[WARNING] DIFFERENCE: {abs(output_bin_delta - total_produced_weight)} kg")
                            
                            if output_bin_delta < 0:
                                print(f"\n[ERROR] NEGATIVE DELTA DETECTED! Cumulative counter went DOWN!")
                                print(f"[ERROR] This means first_record weight ({first_weight}) > last_record weight ({last_weight})")
                                print(f"[ERROR] Check if records are in correct chronological order")
                
                print("\n" + "=" * 80)
                
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
        # Default to Dec 17-18
        start_date = "2025-12-17 05:00:00"
        end_date = "2025-12-18 05:00:00"
    
    check_produced_weight(start_date, end_date)

