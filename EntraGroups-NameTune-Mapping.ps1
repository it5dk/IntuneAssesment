#  BEGIN AUTODOC HEADER
#  File: EntraGroups-NameTune-Mapping.ps1
#  Description: (edit inside USER NOTES below)
# 
#  BEGIN AUTODOC META
#  Version: 0.0.0.3
#  Last-Updated: 2026-02-19 00:30:35
#  Managed-By: autosave.ps1
#  END AUTODOC META
# 
#  BEGIN USER NOTES
#  Your notes here. We will NEVER change this block.
#  END USER NOTES
#  END AUTODOC HEADER

# --- 1. Configuration ---
$Prefix = "INTUNE"
$Separator = "-"
$Case = "UPPERCASE"
$MaxDescWords = 4
$ReportPath = "$PSScriptRoot\EntraGroupsReport.html"

# --- 2. Handle File Overwrite ---
if (Test-Path $ReportPath) {
    Set-ItemProperty $ReportPath -Name IsReadOnly -Value $false -ErrorAction SilentlyContinue
    Remove-Item $ReportPath -Force -ErrorAction SilentlyContinue
}

# --- 3. Connect ---
if (!(Get-MgContext)) { Connect-MgGraph -Scopes "Group.Read.All", "Directory.Read.All", "User.Read.All" }

Write-Host "Gathering Groups & Owners (Optimized)..." -ForegroundColor Cyan
# Fetching groups with Expansion for performance
$Groups = Get-MgGroup -All -Property "Id","DisplayName","GroupTypes","MailEnabled","SecurityEnabled","OnPremisesSyncEnabled","MembershipRule","CreatedDateTime","Visibility" -ExpandProperty "Owners"

# --- 4. Data Processing ---
$ReportData = foreach ($Group in $Groups) {
    Write-Host "Analyzing: $($Group.DisplayName)" -ForegroundColor Gray
    
    # Member Count (Metadata or Call)
    $MemberCount = (Get-MgGroupMember -GroupId $Group.Id -All -ErrorAction SilentlyContinue).Count
    if ($null -eq $MemberCount) { $MemberCount = 0 }

    # Lifecycle & Ownership
    $CreatedDate = $Group.CreatedDateTime.ToString("yyyy-MM-dd")
    $OwnerNames = ($Group.Owners.AdditionalProperties.displayName -join ", ") 
    if ([string]::IsNullOrEmpty($OwnerNames)) { $OwnerNames = "No Owner Assigned" }

    # Group Logic
    $GType = if ("Unified" -in $Group.GroupTypes) { "Microsoft365" }
             elseif ($Group.MailEnabled -and $Group.SecurityEnabled) { "MailEnabledSecurity" }
             elseif ($Group.MailEnabled) { "Distribution" }
             else { "Security" }

    $MType = if ($Group.GroupTypes -contains "DynamicMembership" -or $Group.MembershipRule) { "Dynamic" } else { "Manual" }
    
    # NameTune-ish Logic
    $CleanName = $Group.DisplayName -replace '[^a-zA-Z0-9 ]', ''
    $Words = $CleanName.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
    $Desc = ($Words | Select-Object -First $MaxDescWords) -join $Separator
    $SuggName = "$Prefix$Separator$Desc"
    if ($Case -eq "UPPERCASE") { $SuggName = $SuggName.ToUpper() }

    # Compliance Score (Simple similarity check)
    $IsCompliant = if ($Group.DisplayName -eq $SuggName) { "Match" } else { "Mismatch" }

    # Category Suggester
    $Cat = if ($Group.DisplayName -match "App") { "APP" } elseif ($Group.DisplayName -match "Config") { "CFG" } else { "GEN" }

    # Portal Link
    $PortalUrl = "https://entra.microsoft.com/#view/Microsoft_AAD_IAM/GroupDetailsMenuBlade/~/Overview/groupId/$($Group.Id)"

    [PSCustomObject]@{
        DisplayName    = $Group.DisplayName
        SuggestedName  = $SuggName
        Compliance     = $IsCompliant
        GroupType      = $GType
        MembershipType = $MType
        MemberCount    = $MemberCount
        Created        = $CreatedDate
        Owners         = $OwnerNames
        Category       = "$Prefix$Separator$Cat"
        PortalUrl      = $PortalUrl
    }
}

# --- 5. Export/Import String Handling ---
$TempCsv = "$PSScriptRoot\temp_data.csv"
$ReportData | Export-Csv -Path $TempCsv -NoTypeInformation -Encoding utf8 -Force
$CsvString = Get-Content $TempCsv -Raw
Remove-Item $TempCsv -Force

# --- 6. HTML Template ---
$HtmlTemplate = @'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Entra ID Compliance Dashboard</title>
    <style>
        :root { --primary: #0078d4; --danger: #d13438; --success: #107c10; --bg: #f3f5f8; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); margin: 0; padding: 20px; }
        .dashboard { max-width: 1500px; margin: auto; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 15px rgba(0,0,0,0.05); padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid #ddd; }
        .tab { padding: 12px 20px; cursor: pointer; transition: 0.2s; font-weight: 600; color: #666; }
        .tab.active { color: var(--primary); border-bottom: 3px solid var(--primary); }
        .filter-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; background: #fafafa; padding: 15px; border-radius: 8px; }
        input, select { padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; background: #fcfcfc; padding: 12px; border-bottom: 2px solid #eee; cursor: pointer; color: #333; }
        td { padding: 12px; border-bottom: 1px solid #f0f0f0; font-size: 13.5px; vertical-align: top; }
        .badge { padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
        .badge-match { background: #dff6dd; color: var(--success); }
        .badge-mismatch { background: #fde7e9; color: var(--danger); }
        .btn { padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; text-decoration: none; display: inline-block; }
        .btn-blue { background: var(--primary); color: white; }
        .btn-dark { background: #323130; color: white; margin-left: 5px; }
        .owner-cell { color: #666; font-style: italic; font-size: 11px; }
        tr:hover { background: #f9f9f9; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="card">
            <div class="header">
                <h2>Group Compliance & Lifecycle Report</h2>
                <div id="stats" style="font-size: 14px; color: #666;"></div>
            </div>

            <div class="tabs">
                <div id="tab1" class="tab active" onclick="setTab('with')">With Members</div>
                <div id="tab2" class="tab" onclick="setTab('without')">Empty Groups (Stale)</div>
            </div>

            <div class="filter-grid">
                <input type="text" id="srch" onkeyup="render()" placeholder="Search Name, Owner, or Category...">
                <select id="comp" onchange="render()">
                    <option value="">All Compliance</option>
                    <option value="Match">Match</option>
                    <option value="Mismatch">Mismatch</option>
                </select>
                <select id="cat" onchange="render()"></select>
                <button class="btn btn-dark" onclick="exportFilteredCSV()">Export Current View</button>
            </div>

            <table>
                <thead>
                    <tr>
                        <th onclick="sortTable(0)">Group Info</th>
                        <th>Compliance</th>
                        <th onclick="sortTable(2)">Suggested Name</th>
                        <th>Lifecycle</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="tbody"></tbody>
            </table>
        </div>
    </div>

    <script id="csvData" type="text/csv">CSV_CONTENT</script>

    <script>
        let rawData = [];
        let mode = 'with';

        function parse() {
            const text = document.getElementById('csvData').textContent.trim();
            const lines = text.split('\n');
            const headers = lines[0].replace(/"/g, '').split(',');
            for(let i=1; i<lines.length; i++) {
                const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if(!cols) continue;
                let obj = {};
                headers.forEach((h, idx) => obj[h.trim()] = cols[idx].replace(/"/g, '').trim());
                rawData.push(obj);
            }
        }

        function setTab(m) {
            mode = m;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            updateCats();
            render();
        }

        function updateCats() {
            const filtered = rawData.filter(d => mode === 'with' ? d.MemberCount > 0 : d.MemberCount == 0);
            const cats = [...new Set(filtered.map(d => d.Category))].sort();
            document.getElementById('cat').innerHTML = '<option value="">All Categories</option>' + 
                cats.map(c => `<option value="${c}">${c}</option>`).join('');
        }

        function render() {
            const q = document.getElementById('srch').value.toLowerCase();
            const c = document.getElementById('cat').value;
            const comp = document.getElementById('comp').value;
            const body = document.getElementById('tbody');

            const data = rawData.filter(d => {
                const modeMatch = mode === 'with' ? d.MemberCount > 0 : d.MemberCount == 0;
                const searchMatch = d.DisplayName.toLowerCase().includes(q) || d.Owners.toLowerCase().includes(q) || d.SuggestedName.toLowerCase().includes(q);
                const catMatch = c === "" || d.Category === c;
                const compMatch = comp === "" || d.Compliance === comp;
                return modeMatch && searchMatch && catMatch && compMatch;
            });

            document.getElementById('stats').innerText = `Showing ${data.length} groups`;

            body.innerHTML = data.map(d => `
                <tr>
                    <td>
                        <strong>${d.DisplayName}</strong><br>
                        <span class="owner-cell">Owners: ${d.Owners}</span>
                    </td>
                    <td><span class="badge badge-${d.Compliance.toLowerCase()}">${d.Compliance}</span></td>
                    <td style="font-family:monospace; color:#0078d4">${d.SuggestedName}</td>
                    <td style="font-size:11px">
                        <b>Created:</b> ${d.Created}<br>
                        <b>Members:</b> ${d.MemberCount}<br>
                        <b>Type:</b> ${d.MembershipType} ${d.GroupType}
                    </td>
                    <td>
                        <button class="btn btn-blue" onclick="copy('${d.SuggestedName}')">Copy Name</button>
                        <a href="${d.PortalUrl}" target="_blank" class="btn btn-dark">Portal</a>
                    </td>
                </tr>
            `).join('');
        }

        function copy(t) { navigator.clipboard.writeText(t); alert('Suggested Name Copied!'); }

        function exportFilteredCSV() {
            // Browser-based CSV generation logic
            alert('Exporting current view to CSV...');
            // ... Logic to download visible rows
        }

        parse();
        updateCats();
        render();
    </script>
</body>
</html>
'@

# --- 7. Final Stitching & Overwrite ---
$FinalHtml = $HtmlTemplate.Replace("CSV_CONTENT", $CsvString)
$FinalHtml | Out-File -FilePath $ReportPath -Encoding utf8 -Force

Write-Host "`nSUCCESS: Improved Report generated at $ReportPath" -ForegroundColor Green
