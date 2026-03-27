import psycopg2
from psycopg2.extras import RealDictCursor
import argparse

DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'Dynamic_DB_Hercules',
    'user': 'postgres',
    'password': 'trust'
}

def check_fcl_data(start_date, end_date):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT * FROM fcl_monitor_logs_archive
        WHERE created_at >= %s AND created_at < %s
        ORDER BY created_at;
    """, (start_date, end_date))
    
    rows = cur.fetchall()
    print(f"Found {len(rows)} records from {start_date} to {end_date}")
    print("=" * 100)
    
    for row in rows:
        print(f"ID: {row['id']}")
        print(f"Order Name: {row['order_name']}")
        print(f"Created At: {row['created_at']}")
        print(f"Job Status: {row['job_status']}")
        print(f"Line Running: {row['line_running']}")
        print(f"Receiver: {row['receiver']}")
        print(f"Flow Rate: {row['flow_rate']}")
        print(f"Produced Weight: {row['produced_weight']}")
        print(f"Active Sources: {row['active_sources']}")
        print(f"Active Destination: {row['active_destination']}")
        print(f"Per Bin Weights: {row['per_bin_weights']}")
        print(f"FCL Receivers: {row['fcl_receivers']}")
        print("-" * 100)
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--start', default='2025-12-19')
    parser.add_argument('--end', default='2025-12-21')
    parser.add_argument('--db-host', default='127.0.0.1')
    args = parser.parse_args()
    
    DB_CONFIG['host'] = args.db_host
    check_fcl_data(args.start, args.end)

