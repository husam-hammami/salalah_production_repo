import psycopg2

conn = psycopg2.connect(
    host='127.0.0.1',
    port=5432,
    database='Dynamic_DB_Hercules',
    user='postgres',
    password='trust'
)

cur = conn.cursor()
cur.execute('SELECT MAX(id) FROM fcl_monitor_logs_archive')
max_id = cur.fetchone()[0]
print(f'Current max ID: {max_id}')

cur.execute(f"SELECT setval('fcl_monitor_logs_archive_id_seq', {max_id}, true)")
print(f'Sequence set to {max_id} (next auto ID will be {max_id + 1})')

conn.commit()
conn.close()


