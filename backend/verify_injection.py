import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect(
    host='127.0.0.1',
    port=5432,
    database='Dynamic_DB_Hercules',
    user='postgres',
    password='trust'
)

cur = conn.cursor(cursor_factory=RealDictCursor)
# Check Dec 19 data
cur.execute("""
    SELECT id, order_name, created_at, line_running, produced_weight, receiver 
    FROM fcl_monitor_logs_archive 
    WHERE created_at >= %s AND created_at < %s 
    ORDER BY created_at
""", ('2025-12-19 05:00:00', '2025-12-20 05:00:00'))

rows = cur.fetchall()
print(f'Found {len(rows)} records for Dec 19:')
print('=' * 80)
for r in rows:
    print(f"ID: {r['id']:3d} | Order: {r['order_name']:6s} | Created: {r['created_at']} | "
          f"Line Running: {str(r['line_running']):5s} | Produced: {r['produced_weight']:10.3f} kg | "
          f"Receiver: {r['receiver']:10.3f} kg")

print('\n' + '=' * 80)
# Check Dec 20 data still exists
cur.execute("""
    SELECT COUNT(*) as count
    FROM fcl_monitor_logs_archive 
    WHERE created_at >= %s AND created_at < %s
""", ('2025-12-20 05:00:00', '2025-12-21 05:00:00'))
result = cur.fetchone()
dec20_count = result['count'] if result else 0
print(f'\nDec 20 records still exist: {dec20_count} records')
print('=' * 80)
print('=' * 80)
for r in rows:
    print(f"ID: {r['id']:3d} | Order: {r['order_name']:6s} | Created: {r['created_at']} | "
          f"Line Running: {str(r['line_running']):5s} | Produced: {r['produced_weight']:10.3f} kg | "
          f"Receiver: {r['receiver']:10.3f} kg")

conn.close()

