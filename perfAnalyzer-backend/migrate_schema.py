"""
Migrate the projects and project_files tables to match what the backend expects.
Safe to run multiple times (uses ALTER TABLE ... IF NOT EXISTS).
"""
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

print("Migrating projects table...")

# Allow username to be nullable so existing rows don't break
cur.execute("ALTER TABLE projects ALTER COLUMN username DROP NOT NULL;")

# Add owner column (already exists, but just in case)
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner VARCHAR(255) DEFAULT '';")

# Add updated_at if missing
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")

# Add description / tags if missing
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';")
cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';")

print("Migrating project_files table...")

# Add stored_path (alias/replacement for file_path)
cur.execute("ALTER TABLE project_files ADD COLUMN IF NOT EXISTS stored_path TEXT DEFAULT '';")

# Copy existing file_path values to stored_path where stored_path is empty
cur.execute("""
    UPDATE project_files
    SET stored_path = file_path
    WHERE stored_path = '' AND file_path IS NOT NULL AND file_path != '';
""")

# Add file_size
cur.execute("ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;")

# Add uploaded_at
cur.execute("ALTER TABLE project_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")

# Make file_type nullable so we can set a default safely
cur.execute("ALTER TABLE project_files ALTER COLUMN file_type SET DEFAULT 'other';")

conn.commit()
print("Migration complete!")

# Verify
cur.execute("""
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'projects' ORDER BY ordinal_position;
""")
print("\nprojects columns:", [r[0] for r in cur.fetchall()])

cur.execute("""
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'project_files' ORDER BY ordinal_position;
""")
print("project_files columns:", [r[0] for r in cur.fetchall()])

cur.close()
conn.close()
