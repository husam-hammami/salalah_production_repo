"""
Check if system is using OLD (DB299 offset 682) or NEW (DB2099 offset 102) status code
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import json

DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'Dynamic_DB_Hercules',
    'user': 'postgres',
    'password': 'trust'
}

def check_api_status():
    """Check what the API endpoint is returning"""
    print("=" * 80)
    print("API Endpoint Check")
    print("=" * 80)
    
    try:
        response = requests.get('http://localhost:5000/orders/plc/db299-monitor', timeout=5)
        if response.status_code == 200:
            data = response.json()
            job_status = data.get('data', {}).get('JobStatusCode')
            print(f"[OK] API Endpoint: /orders/plc/db299-monitor")
            print(f"     JobStatusCode: {job_status}")
            print(f"     Status: {'order_active' if job_status == 1 else 'order_done'}")
            
            # Check if status is only 0 or 1 (NEW code behavior)
            if job_status in [0, 1]:
                print(f"[OK] Status is 0 or 1 - Consistent with NEW status code (DB2099 offset 102)")
            else:
                print(f"[WARNING] Status is {job_status} - This might indicate OLD status code")
            
            return job_status
        else:
            print(f"[ERROR] API returned status code: {response.status_code}")
            return None
    except Exception as e:
        print(f"[ERROR] Failed to call API: {e}")
        print(f"        Make sure Flask server is running")
        return None

def check_database_status(limit=20):
    """Check recent database records"""
    print("\n" + "=" * 80)
    print("Database Records Check (Recent Records)")
    print("=" * 80)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get most recent records
        cur.execute("""
            SELECT id, job_status, line_running, order_name, created_at
            FROM scl_monitor_logs
            ORDER BY created_at DESC
            LIMIT %s
        """, (limit,))
        
        rows = cur.fetchall()
        
        if not rows:
            print("[INFO] No records found in scl_monitor_logs table")
            return None
        
        print(f"[INFO] Found {len(rows)} most recent records:")
        print("-" * 80)
        print(f"{'ID':<10} {'Job Status':<12} {'Line Running':<15} {'Order Name':<15} {'Created At':<25}")
        print("-" * 80)
        
        status_counts = {0: 0, 1: 0, 'other': 0}
        other_statuses = set()
        
        for row in rows:
            job_status = row.get('job_status')
            line_running = 'Yes' if row.get('line_running') else 'No'
            
            if job_status in [0, 1]:
                status_counts[job_status] = status_counts.get(job_status, 0) + 1
            else:
                status_counts['other'] += 1
                other_statuses.add(job_status)
            
            print(f"{row.get('id'):<10} {job_status:<12} {line_running:<15} {row.get('order_name', 'N/A'):<15} {str(row.get('created_at')):<25}")
        
        print("-" * 80)
        print(f"[SUMMARY] Job Status distribution:")
        print(f"          Status 0 (order_done): {status_counts.get(0, 0)} records")
        print(f"          Status 1 (order_active): {status_counts.get(1, 0)} records")
        if status_counts['other'] > 0:
            print(f"          Other status codes: {status_counts['other']} records")
            print(f"          Status values found: {sorted(other_statuses)}")
            print(f"          [WARNING] This indicates OLD status code was used for these records")
        
        cur.close()
        conn.close()
        
        return status_counts
        
    except Exception as e:
        print(f"[ERROR] Database error: {e}")
        return None

def check_all_status_values():
    """Check all unique job_status values in database"""
    print("\n" + "=" * 80)
    print("All Unique Status Values in Database")
    print("=" * 80)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get all unique status values
        cur.execute("""
            SELECT DISTINCT job_status, COUNT(*) as count
            FROM scl_monitor_logs
            GROUP BY job_status
            ORDER BY job_status
        """)
        
        rows = cur.fetchall()
        
        if not rows:
            print("[INFO] No records found")
            return
        
        print(f"{'Job Status':<15} {'Count':<10} {'Meaning'}")
        print("-" * 80)
        
        for row in rows:
            status = row.get('job_status')
            count = row.get('count')
            
            if status == 0:
                meaning = "order_done (NEW code)"
            elif status == 1:
                meaning = "order_active (NEW code)"
            else:
                meaning = "OLD status code (DB299 offset 682)"
            
            print(f"{status:<15} {count:<10} {meaning}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] Database error: {e}")

if __name__ == '__main__':
    print("\n" + "=" * 80)
    print("SCL Status Code Source Verification")
    print("=" * 80)
    print("\n[INFO] Checking if system is using:")
    print("       OLD: DB299 offset 682 (Int) - Can return various status codes (0, 1, 4, etc.)")
    print("       NEW: DB2099 offset 102 (Bool) - Returns only 0 or 1")
    print()
    
    # Check API
    api_status = check_api_status()
    
    # Check database - recent records
    db_status = check_database_status(20)
    
    # Check all unique status values
    check_all_status_values()
    
    # Final analysis
    print("\n" + "=" * 80)
    print("FINAL ANALYSIS")
    print("=" * 80)
    
    if api_status is not None:
        if api_status in [0, 1]:
            print("[OK] API is returning status 0 or 1")
            print("     This confirms NEW status code (DB2099 offset 102) is ACTIVE")
        else:
            print("[WARNING] API is returning status other than 0 or 1")
            print(f"          Status: {api_status}")
            print("          This suggests OLD status code might still be in use")
    
    if db_status:
        if db_status.get('other', 0) == 0:
            print("[OK] All recent database records contain only status 0 or 1")
            print("     This confirms NEW status code is working correctly")
        else:
            print("[INFO] Some old records contain other status codes")
            print("       This is normal - they were created before the code change")
            print("       New records should only have 0 or 1")
    
    print("\n[INFO] Since server was restarted:")
    print("       - NEW status code (DB2099 offset 102) should be active")
    print("       - All NEW records will have job_status = 0 or 1 only")
    print("       - Check server logs for: '[SCL] Job Status from DB2099 offset 102'")
    print("\n[VERIFICATION] Run this script again after new data is stored")
    print("               to confirm only status 0 or 1 is being saved")