"""
SCL Order Name Update Script
Update SCL order names in scl_monitor_logs_archive table
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import argparse
from datetime import datetime

DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'Dynamic_DB_Hercules',
    'user': 'postgres',
    'password': 'trust'
}

def update_scl_order_name(old_order_name, new_order_name, dry_run=True, db_host='127.0.0.1', skip_confirm=False):
    """
    Update SCL order names in the archive table.
    
    Args:
        old_order_name: Current order name to replace (e.g., 'SCL7220')
        new_order_name: New order name (e.g., 'SCL167')
        dry_run: If True, only show what would be updated without making changes
        db_host: Database host (default: 127.0.0.1, use 'postgres' for Docker)
        skip_confirm: If True, skip the confirmation prompt
    """
    conn = None
    try:
        db_config = DB_CONFIG.copy()
        db_config['host'] = db_host
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, check how many records will be affected
        cur.execute("""
            SELECT COUNT(*) as count
            FROM scl_monitor_logs_archive
            WHERE order_name = %s
        """, (old_order_name,))
        
        count_result = cur.fetchone()
        affected_count = count_result['count'] if count_result else 0
        
        if affected_count == 0:
            print(f"No records found with order_name = '{old_order_name}'")
            return
        
        print(f"\n{'='*60}")
        print(f"SCL Order Name Update")
        print(f"{'='*60}")
        print(f"Old Order Name: {old_order_name}")
        print(f"New Order Name: {new_order_name}")
        print(f"Records to update: {affected_count}")
        print(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'LIVE UPDATE'}")
        print(f"{'='*60}\n")
        
        # Show sample records that will be updated
        cur.execute("""
            SELECT id, order_name, created_at, job_status, line_running, receiver, produced_weight
            FROM scl_monitor_logs_archive
            WHERE order_name = %s
            ORDER BY created_at DESC
            LIMIT 5
        """, (old_order_name,))
        
        sample_records = cur.fetchall()
        print("Sample records to be updated:")
        print("-" * 60)
        for record in sample_records:
            print(f"ID: {record['id']} | Order: {record['order_name']} | "
                  f"Created: {record['created_at']} | "
                  f"Job Status: {record['job_status']} | "
                  f"Line Running: {record['line_running']} | "
                  f"Receiver: {record['receiver']} | "
                  f"Produced: {record['produced_weight']}")
        print("-" * 60)
        
        if affected_count > 5:
            print(f"... and {affected_count - 5} more records\n")
        
        if dry_run:
            print("\n[DRY RUN] No changes made. Use --execute to apply changes.")
            return
        
        # Confirm before updating
        if not skip_confirm:
            print(f"\nWARNING: This will update {affected_count} records!")
            response = input("Type 'yes' to confirm: ")
            if response.lower() != 'yes':
                print("Update cancelled.")
                return
        else:
            print(f"\n[INFO] Skipping confirmation prompt. Updating {affected_count} records...")
        
        # Perform the update
        cur.execute("""
            UPDATE scl_monitor_logs_archive
            SET order_name = %s
            WHERE order_name = %s
        """, (new_order_name, old_order_name))
        
        updated_count = cur.rowcount
        conn.commit()
        
        print(f"\nSUCCESS: Successfully updated {updated_count} records")
        print(f"   Changed '{old_order_name}' -> '{new_order_name}'")
        
        # Verify the update
        cur.execute("""
            SELECT COUNT(*) as count
            FROM scl_monitor_logs_archive
            WHERE order_name = %s
        """, (new_order_name,))
        
        verify_result = cur.fetchone()
        new_count = verify_result['count'] if verify_result else 0
        print(f"   Total records with new order name '{new_order_name}': {new_count}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")
        if conn:
            conn.rollback()
            conn.close()

def main():
    parser = argparse.ArgumentParser(description='Update SCL order names in archive table')
    parser.add_argument('--old', required=True, help='Old order name (e.g., SCL7220)')
    parser.add_argument('--new', required=True, help='New order name (e.g., SCL167)')
    parser.add_argument('--execute', action='store_true', 
                       help='Execute the update (default is dry-run)')
    parser.add_argument('--db-host', default='127.0.0.1',
                       help='Database host (default: 127.0.0.1, use "postgres" for Docker)')
    parser.add_argument('--yes', action='store_true',
                       help='Skip confirmation prompt (use with --execute)')
    
    args = parser.parse_args()
    
    update_scl_order_name(
        old_order_name=args.old,
        new_order_name=args.new,
        dry_run=not args.execute,
        db_host=args.db_host,
        skip_confirm=args.yes
    )

if __name__ == '__main__':
    main()

