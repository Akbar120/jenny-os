# Jeju Island Raid — Download & Live Preview

## 1-Click Download (ZIP of whole game branch)

**Download ZIP:**  
https://github.com/Akbar120/jenny-os/archive/refs/tags/jeju-raid-v1.zip

**Alternate (branch):**  
https://github.com/Akbar120/jenny-os/archive/refs/heads/arena/01a08720-jenny-os.zip

**Release page:**  
https://github.com/Akbar120/jenny-os/releases/tag/jeju-raid-v1

**Repo:**  
https://github.com/Akbar120/jenny-os/tree/arena/01a08720-jenny-os/jeju-island-raid

---

## PowerShell — download + auto-open + live preview

Copy-paste this entire block into PowerShell:

```powershell
irm https://raw.githubusercontent.com/Akbar120/jenny-os/arena/01a08720-jenny-os/jeju-island-raid/INSTALL.ps1 | iex
```

What it does:
1. Downloads the game ZIP to your Desktop
2. Extracts it
3. Opens the single-file game in your browser
4. Starts `http://localhost:8080` live preview (if Python is installed)

---

## Manual (no script)

### A) Single HTML (fastest preview)
1. Download:  
   https://github.com/Akbar120/jenny-os/blob/arena/01a08720-jenny-os/jeju-island-raid/jeju-island-raid-PLAY.html  
   (click **Download raw file**)
2. Double-click the file → play

### B) Full folder + live server
```powershell
# Download + unzip
Invoke-WebRequest -Uri "https://github.com/Akbar120/jenny-os/archive/refs/tags/jeju-raid-v1.zip" -OutFile "$env:TEMP\jeju.zip"
Expand-Archive "$env:TEMP\jeju.zip" -DestinationPath "$env:USERPROFILE\Desktop\Jeju-Island-Raid" -Force

# Find and serve
cd (Get-ChildItem "$env:USERPROFILE\Desktop\Jeju-Island-Raid" -Recurse -Filter "index.html" | Where-Object { $_.DirectoryName -match "jeju-island-raid$" } | Select-Object -First 1).DirectoryName
Start-Process "http://localhost:8080"
python -m http.server 8080
```

Live preview: **http://localhost:8080**

---

## Controls
| Key | Action |
|-----|--------|
| WASD | Move |
| Click canvas | Lock camera |
| LMB | Attack |
| 1–5 | Skills |
| Q / E / R | Speed / Stealth / Teleport |
| F | ARISE |
| Esc | Pause |

Push **north** on the minimap to reach the Ant King nest.
