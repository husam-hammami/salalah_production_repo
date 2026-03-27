"""
MILA Data Query Script
Check MILA archive data for a specific date range
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

# Database connection settings
DB_CONFIG = {
    'host': 'postgres',  # Use 'postgres' for Docker, '127.0.0.1' for local
    'port': 5432,
    'database': 'Dynamic_DB_Hercules',
    'user': 'postgres',
    'password': 'trust'
}

def query_mila_data(start_date, end_date):
    """
    Query MILA archive data for a date range.
    
    Args:
        start_date: Start date string (YYYY-MM-DD)
        end_date: End date string (YYYY-MM-DD)
    """
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT *
            FROM fcl_monitor_logs_archive
            WHERE created_at >= %s
              AND created_at < %s
            ORDER BY created_at;
        """
        
        cursor.execute(query, (f"{start_date} 00:00:00", f"{end_date} 00:00:00"))
        rows = cursor.fetchall()
        
        print(f"\n[INFO] Found {len(rows)} records from {start_date} to {end_date}")
        print("=" * 80)
        
        for row in rows:
            print(f"\nID: {row['id']}")
            print(f"Order Name: {row['order_name']}")
            print(f"Status: {row['status']}")
            print(f"Produced Weight: {row['produced_weight']} kg")
            print(f"Created At: {row['created_at']}")
            print(f"Receiver: {json.dumps(row['receiver'], indent=2) if row['receiver'] else '[]'}")
            print(f"Bran Receiver: {json.dumps(row['bran_receiver'], indent=2) if row['bran_receiver'] else '{}'}")
            print(f"Yield Log: {json.dumps(row['yield_log'], indent=2) if row['yield_log'] else '{}'}")
            print(f"Setpoints: {json.dumps(row['setpoints_produced'], indent=2) if row['setpoints_produced'] else '{}'}")
            print("-" * 80)
        
        cursor.close()
        conn.close()
        
        return rows
        
    except Exception as e:
        print(f"[ERROR] {e}")
        return []


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Query MILA Archive Data')
    parser.add_argument('--start', '-s', default='2025-12-01',
                        help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end', '-e', default='2025-12-02',
                        help='End date (YYYY-MM-DD)')
    parser.add_argument('--db-host', default='postgres',
                        help='Database host (default: postgres)')
    
    args = parser.parse_args()
    
    DB_CONFIG['host'] = args.db_host
    
    print("=" * 80)
    print("  MILA Archive Data Query")
    print("=" * 80)
    
    query_mila_data(args.start, args.end)

