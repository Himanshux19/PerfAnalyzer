import psycopg2, os
from pathlib import Path

def load_env():
    env_path = Path(r'D:\Project\PerfAnalyzer\perfAnalyzer-backend\.env')
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip()
load_env()

conn = psycopg2.connect(
    host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT'),
    database=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASS')
)
cur = conn.cursor()

print("=== projects table columns ===")
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'projects'
    ORDER BY ordinal_position;
""")
for row in cur.fetchall():
    print(row)

print("\n=== project_files table columns ===")
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'project_files'
    ORDER BY ordinal_position;
""")
for row in cur.fetchall():
    print(row)

cur.close()
conn.close()
