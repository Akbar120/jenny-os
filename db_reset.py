import os
import json
import sqlite3
from backend.database.engine import engine, SessionLocal
from backend.database.models import Base, Mission, Lead

def reset_database():
    db_path = "jenny.db"
    if os.path.exists(db_path):
        print(f"Deleting existing database file: {db_path}")
        try:
            os.remove(db_path)
            print("Database file deleted.")
        except Exception as e:
            print(f"Error deleting database file: {e}")

    print("--- 1. Recreating Tables ---")
    # Bind engine and recreate tables
    Base.metadata.create_all(bind=engine)
    print("Database tables recreated successfully.")
    
    print("\n--- 2. Verifying Table Schemas ---")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Tables found in database: {tables}")
    
    # Check columns in leads table
    cursor.execute("PRAGMA table_info(leads);")
    leads_cols = {row[1]: row[2] for row in cursor.fetchall()}
    print("\nLeads table columns:")
    for col, col_type in leads_cols.items():
        print(f" - {col}: {col_type}")
        
    required_cols = ["mission_id", "target_service", "service_match", "relevance_score", "source_post_id"]
    missing = [col for col in required_cols if col not in leads_cols]
    if missing:
        print(f"WARNING: Missing columns in leads table: {missing}")
    else:
        print("SUCCESS: All new columns (including source_post_id) are present in the leads table.")

    # Check columns in missions table
    cursor.execute("PRAGMA table_info(missions);")
    missions_cols = {row[1]: row[2] for row in cursor.fetchall()}
    print("\nMissions table columns:")
    for col, col_type in missions_cols.items():
        print(f" - {col}: {col_type}")

    # Check columns in sources table
    cursor.execute("PRAGMA table_info(sources);")
    sources_cols = {row[1]: row[2] for row in cursor.fetchall()}
    print("\nSources table columns:")
    for col, col_type in sources_cols.items():
        print(f" - {col}: {col_type}")
        
    conn.close()
    
    print("\n--- 3. Creating Default Test Mission ---")
    db = SessionLocal()
    try:
        # Check if default mission already exists
        existing = db.query(Mission).filter(Mission.mission_name == "3D Character Artist").first()
        if existing:
            print(f"Default mission already exists with ID: {existing.id}")
        else:
            default_mission = Mission(
                mission_name="3D Character Artist",
                target_service="3D Character Artist",
                keywords=json.dumps([
                    "character artist", 
                    "metahuman", 
                    "uefn", 
                    "unreal", 
                    "roblox", 
                    "stylized character"
                ]),
                score_threshold=7,
                is_active=True
            )
            db.add(default_mission)
            db.commit()
            db.refresh(default_mission)
            print(f"Default mission created successfully!")
            print(f" - ID: {default_mission.id}")
            print(f" - Target Service: {default_mission.target_service}")
            print(f" - Keywords: {default_mission.keywords}")
            print(f" - Threshold: {default_mission.score_threshold}")
    except Exception as e:
        print(f"Error seeding default mission: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_database()
