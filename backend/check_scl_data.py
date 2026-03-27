"""
SCL Data Verification Script
Check SCL archive data for a specific date range to verify data injection
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import argparse
import json
from datetime import datetime

DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'Dynamic_DB_Hercules',
    'user': 'postgres',
    'password': 'trust'
}

def check_scl_data(start_date, end_date, show_all=False):
    """
    Check SCL data in the database for the given date range.
    
    Args:
        start_date: Start date/time string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
        end_date: End date/time string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
        show_all: If True, show all fields. If False, show summary only.
    """
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Parse dates - handle both date-only and datetime formats
        if len(start_date) == 10:  # YYYY-MM-DD
            start_date = f"{start_date} 00:00:00"
        if len(end_date) == 10:  # YYYY-MM-DD
            end_date = f"{end_date} 23:59:59"
        
        # Query with the same conditions as the report endpoint
        cur.execute("""
            SELECT *
            FROM scl_monitor_logs_archive
            WHERE created_at >= %s AND created_at <= %s
            ORDER BY created_at ASC;
        """, (start_date, end_date))
        
        rows = cur.fetchall()
        
        print(f"\n{'='*100}")
        print(f"SCL Data Verification Report")
        print(f"{'='*100}")
        print(f"Date Range: {start_date} to {end_date}")
        print(f"Total Records Found: {len(rows)}")
        print(f"{'='*100}\n")
        
        if len(rows) == 0:
            print("[ERROR] NO DATA FOUND in the specified date range!")
            print("\nPossible issues:")
            print("  1. Data was not injected for this date range")
            print("  2. Date/time format mismatch")
            print("  3. Data exists but outside the specified range")
            print("\n[TIP] Try expanding the date range or check the injection logs")
            cur.close()
            conn.close()
            return
        
        # Show summary first
        print("[SUMMARY]")
        print("-" * 100)
        print(f"{'ID':<6} {'Order Name':<15} {'Created At':<25} {'Line Running':<15} {'Flow Rate':<12} {'Produced Weight':<15}")
        print("-" * 100)
        
        for row in rows:
            order_name = str(row.get('order_name', 'N/A'))[:14]
            created_at = str(row.get('created_at', 'N/A'))
            line_running = 'Yes' if row.get('line_running') else 'No'
            flow_rate = row.get('flow_rate') or row.get('Flowrate') or 0
            produced_weight = row.get('produced_weight') or 0
            
            print(f"{row.get('id', 'N/A'):<6} {order_name:<15} {created_at:<25} {line_running:<15} {flow_rate:<12.2f} {produced_weight:<15.2f}")
        
        # Show detailed information if requested or if there are few records
        if show_all or len(rows) <= 5:
            print(f"\n{'='*100}")
            print("[DETAILED RECORDS]")
            print(f"{'='*100}\n")
            
            for idx, row in enumerate(rows, 1):
                print(f"Record {idx}/{len(rows)}:")
                print(f"  ID: {row.get('id', 'N/A')}")
                print(f"  Order Name: {row.get('order_name', 'N/A')}")
                print(f"  Created At: {row.get('created_at', 'N/A')}")
                print(f"  Job Status: {row.get('job_status', 'N/A')}")
                print(f"  Line Running: {row.get('line_running', 'N/A')}")
                print(f"  Receiver: {row.get('receiver', 'N/A')}")
                print(f"  Flow Rate: {row.get('flow_rate') or row.get('Flowrate', 'N/A')}")
                print(f"  Produced Weight: {row.get('produced_weight', 'N/A')}")
                print(f"  Water Consumed: {row.get('water_consumed', 'N/A')}")
                print(f"  Moisture Offset: {row.get('moisture_offset', 'N/A')}")
                print(f"  Moisture Setpoint: {row.get('moisture_setpoint', 'N/A')}")
                
                # Show JSON fields
                active_sources = row.get('active_sources')
                if active_sources:
                    print(f"  Active Sources: {json.dumps(active_sources, indent=4)}")
                else:
                    print(f"  Active Sources: None")
                
                active_destination = row.get('active_destination')
                if active_destination:
                    print(f"  Active Destination: {json.dumps(active_destination, indent=4)}")
                else:
                    print(f"  Active Destination: None")
                
                per_bin_weights = row.get('per_bin_weights')
                if per_bin_weights:
                    print(f"  Per Bin Weights: {json.dumps(per_bin_weights, indent=4)}")
                else:
                    print(f"  Per Bin Weights: None")
                
                print("-" * 100)
        
        # Check for report filtering conditions
        print(f"\n{'='*100}")
        print("[REPORT FILTERING CHECK]")
        print(f"{'='*100}")
        
        # Count records that would be included in the report
        # (line_running = true OR line_running IS NULL)
        report_eligible = [r for r in rows if r.get('line_running') is True or r.get('line_running') is None]
        excluded = [r for r in rows if r.get('line_running') is False]
        
        print(f"Records eligible for report (line_running = true OR NULL): {len(report_eligible)}")
        print(f"Records excluded from report (line_running = false): {len(excluded)}")
        
        if len(excluded) > 0:
            print(f"\n[WARNING] {len(excluded)} records are excluded from reports due to line_running = false")
            print("   Excluded record IDs:", [r.get('id') for r in excluded])
        
        if len(report_eligible) == 0 and len(rows) > 0:
            print(f"\n[ERROR] PROBLEM FOUND: Data exists but will NOT appear in reports!")
            print("   All records have line_running = false")
            print("   Solution: Check the line_running values in your injection data")
        
        cur.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"[ERROR] Database Error: {e}")
    except Exception as e:
        print(f"[ERROR] Error: {e}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Verify SCL data in database')
    parser.add_argument('--start', '-s', default='2025-12-01 05:00:00',
                        help='Start date/time (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--end', '-e', default='2025-12-02 05:00:00',
                        help='End date/time (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)')
    parser.add_argument('--db-host', default='127.0.0.1',
                        help='Database host (default: 127.0.0.1, use "postgres" for Docker)')
    parser.add_argument('--all', '-a', action='store_true',
                        help='Show all fields for each record')
    
    args = parser.parse_args()
    
    DB_CONFIG['host'] = args.db_host
    check_scl_data(args.start, args.end, show_all=args.all)

