import json
import time
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"

def run_request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    
    body = None
    if data:
        body = json.dumps(data).encode("utf-8")
        
    try:
        with urllib.request.urlopen(req, data=body) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body)
    except urllib.error.HTTPError as e:
        res_body = e.read().decode("utf-8")
        try:
            parsed_err = json.loads(res_body)
        except Exception:
            parsed_err = res_body
        return e.code, parsed_err
    except Exception as e:
        return 500, {"error": str(e)}

def test_endpoints():
    print("Waiting 2 seconds for backend server to be ready...")
    time.sleep(2.5)

    print("\n--- 1. Testing GET /api/missions ---")
    status, missions = run_request("/api/missions")
    print(f"Status: {status}")
    print(f"Missions count: {len(missions)}")
    print(f"Missions detail: {json.dumps(missions, indent=2)}")
    
    # Extract the default mission ID
    default_mission_id = None
    for m in missions:
        if m["mission_name"] == "3D Character Artist":
            default_mission_id = m["id"]
            break

    print("\n--- 2. Testing GET /api/leads ---")
    status, leads = run_request("/api/leads")
    print(f"Status: {status}")
    print(f"Leads count: {len(leads)}")

    print("\n--- 3. Testing POST /api/missions ---")
    new_mission_data = {
        "mission_name": "AI Automation Leads",
        "target_service": "AI Automation",
        "keywords": ["automation", "n8n", "zapier", "workflow"],
        "score_threshold": 5
    }
    status, mission = run_request("/api/missions", method="POST", data=new_mission_data)
    print(f"Status: {status}")
    print(f"Created Mission: {json.dumps(mission, indent=2)}")

    print("\n--- 4. Testing POST /api/analyze ---")
    if not default_mission_id:
        print("ERROR: Default mission ID not found. Skipping analyze request.")
        return
        
    analyze_data = {
        "content": "We urgently need a skilled metahuman character artist to join our team for a UEFN project.",
        "mission_id": default_mission_id
    }
    status, analysis = run_request("/api/analyze", method="POST", data=analyze_data)
    print(f"Status: {status}")
    print(f"Analysis Response: {json.dumps(analysis, indent=2)}")

if __name__ == "__main__":
    test_endpoints()
