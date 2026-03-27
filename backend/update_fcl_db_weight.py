"""
Update FCL Database Weight Script
=================================
Updates FCL_2_520WE weight value in fcl_monitor_logs_archive table for a specific timestamp.

Usage:
------
    python update_fcl_db_weight.py --date "2025-12-12 04:00:00" --weight 671619100
    python update_fcl_db_weight.py --date "2025-12-12 04:00:00" --weight 671619100 --db-host postgres --execute --yes
"""

import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

# Database connection settings
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'Dynamic_DB_Hercules',
    'user': 'postgres',
    'password': 'trust'
}


def update_fcl_db_weight(target_date, new_weight, db_host='127.0.0.1', dry_run=True, skip_confirm=False):
    """
    Update FCL_2_520WE weight value in database for a specific timestamp.
    
    Args:
        target_date: Target date/time (YYYY-MM-DD HH:MM:SS)
        new_weight: New weight value for FCL_2_520WE
        db_host: Database host (default: 127.0.0.1)
        dry_run: If True, only show what would be updated without making changes
        skip_confirm: If True, skip the confirmation prompt
    """
    conn = None
    try:
        db_config = DB_CONFIG.copy()
        db_config['host'] = db_host
        
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Parse target date
        try:
            if isinstance(target_date, str):
                target_dt = datetime.strptime(target_date, '%Y-%m-%d %H:%M:%S')
            else:
                target_dt = target_date
        except:
            print(f"[ERROR] Invalid date format: {target_date}. Use YYYY-MM-DD HH:MM:SS")
            return
        
        # Find records matching the target hour (archive records are hourly)
        cur.execute("""
            SELECT id, created_at, fcl_receivers, order_name
            FROM fcl_monitor_logs_archive
            WHERE DATE_TRUNC('hour', created_at) = DATE_TRUNC('hour', %s::timestamp)
            ORDER BY created_at DESC
        """, (target_dt,))
        
        rows = cur.fetchall()
        
        if not rows:
            print(f"[ERROR] No records found for date: {target_date}")
            # Show available timestamps
            cur.execute("""
                SELECT created_at
                FROM fcl_monitor_logs_archive
                WHERE created_at >= %s - INTERVAL '1 day'
                  AND created_at <= %s + INTERVAL '1 day'
                ORDER BY created_at DESC
                LIMIT 10
            """, (target_dt, target_dt))
            available = cur.fetchall()
            if available:
                print(f"[INFO] Available timestamps near {target_date}:")
                for row in available:
                    print(f"  - {row['created_at']}")
            return
        
        print(f"\n{'='*60}")
        print(f"FCL Database Weight Update")
        print(f"{'='*60}")
        print(f"Target Date: {target_date}")
        print(f"New Weight: {new_weight}")
        print(f"Records found: {len(rows)}")
        print(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'LIVE UPDATE'}")
        print(f"{'='*60}\n")
        
        # Process each matching record
        for row in rows:
            record_id = row['id']
            created_at = row['created_at']
            fcl_receivers = row.get('fcl_receivers', [])
            order_name = row.get('order_name', 'N/A')
            
            # Parse JSON if it's a string
            if isinstance(fcl_receivers, str):
                fcl_receivers = json.loads(fcl_receivers or '[]')
            elif fcl_receivers is None:
                fcl_receivers = []
            
            # Find FCL_2_520WE and get current weight
            old_weight = None
            updated_receivers = []
            found = False
            
            for rec in fcl_receivers:
                rec_id = rec.get('id', '')
                rec_name = rec.get('name', '')
                
                if rec_id == 'FCL_2_520WE' or rec_name == 'FCL 2_520WE':
                    old_weight = rec.get('weight', rec.get('weight_kg', 0))
                    # Update weight
                    rec['weight'] = float(new_weight)
                    # Also update weight_kg if it exists
                    if 'weight_kg' in rec:
                        rec['weight_kg'] = float(new_weight)
                    found = True
                    print(f"Record ID {record_id} ({created_at}):")
                    print(f"  Order: {order_name}")
                    print(f"  FCL_2_520WE weight: {old_weight} -> {new_weight}")
                updated_receivers.append(rec)
            
            if not found:
                print(f"Record ID {record_id} ({created_at}): FCL_2_520WE not found in JSON")
                continue
        
        if not found:
            print("[ERROR] FCL_2_520WE not found in any records")
            return
        
        if dry_run:
            print("\n[DRY RUN] No changes made. Use --execute to apply changes.")
            return
        
        # Confirm before updating
        if not skip_confirm:
            print(f"\nWARNING: This will update {len(rows)} record(s) in the database!")
            response = input("Type 'yes' to confirm: ")
            if response.lower() != 'yes':
                print("Update cancelled.")
                return
        else:
            print(f"\n[INFO] Skipping confirmation prompt. Updating {len(rows)} record(s)...")
        
        # Update database
        for row in rows:
            record_id = row['id']
            fcl_receivers = row.get('fcl_receivers', [])
            
            # Parse JSON if it's a string
            if isinstance(fcl_receivers, str):
                fcl_receivers = json.loads(fcl_receivers or '[]')
            elif fcl_receivers is None:
                fcl_receivers = []
            
            # Update FCL_2_520WE weight
            for rec in fcl_receivers:
                rec_id = rec.get('id', '')
                rec_name = rec.get('name', '')
                
                if rec_id == 'FCL_2_520WE' or rec_name == 'FCL 2_520WE':
                    rec['weight'] = float(new_weight)
                    if 'weight_kg' in rec:
                        rec['weight_kg'] = float(new_weight)
                    break
            
            # Update the record in database
            cur.execute("""
                UPDATE fcl_monitor_logs_archive
                SET fcl_receivers = %s::jsonb
                WHERE id = %s
            """, (json.dumps(fcl_receivers), record_id))
        
        updated_count = cur.rowcount
        conn.commit()
        
        print(f"\nSUCCESS: Successfully updated {updated_count} record(s) in database")
        print(f"   Changed FCL_2_520WE weight to {new_weight} for {target_date}")
        
        # Verify the update
        cur.execute("""
            SELECT id, created_at, fcl_receivers
            FROM fcl_monitor_logs_archive
            WHERE DATE_TRUNC('hour', created_at) = DATE_TRUNC('hour', %s::timestamp)
            ORDER BY created_at DESC
        """, (target_dt,))
        
        verify_rows = cur.fetchall()
        for verify_row in verify_rows:
            verify_receivers = verify_row.get('fcl_receivers', [])
            if isinstance(verify_receivers, str):
                verify_receivers = json.loads(verify_receivers or '[]')
            for rec in verify_receivers:
                if rec.get('id') == 'FCL_2_520WE' or rec.get('name') == 'FCL 2_520WE':
                    verify_weight = rec.get('weight', rec.get('weight_kg', 0))
                    print(f"   Verified: Record {verify_row['id']} - FCL_2_520WE weight = {verify_weight}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
            conn.close()


def main():
    parser = argparse.ArgumentParser(description='Update FCL_2_520WE weight in database')
    parser.add_argument('--date', required=True,
                        help='Target date/time (YYYY-MM-DD HH:MM:SS, e.g., "2025-12-12 04:00:00")')
    parser.add_argument('--weight', type=float, required=True,
                        help='New weight value for FCL_2_520WE')
    parser.add_argument('--db-host', default='127.0.0.1',
                        help='Database host (default: 127.0.0.1, use "postgres" for Docker)')
    parser.add_argument('--execute', action='store_true',
                        help='Execute the update (default is dry-run)')
    parser.add_argument('--yes', action='store_true',
                        help='Skip confirmation prompt (use with --execute)')
    
    args = parser.parse_args()
    
    update_fcl_db_weight(
        target_date=args.date,
        new_weight=args.weight,
        db_host=args.db_host,
        dry_run=not args.execute,
        skip_confirm=args.yes
    )


if __name__ == '__main__':
    main()

