<# autosave.ps1
ALWAYS bumps 4-part version (0.0.0.0 -> 0.0.0.1 -> ...) on every run,
updates README auto-docs, writes CHANGELOG.md, and creates VERSIONS zip.
Project root defaults to this script's folder (so you can run it from anywhere).
#>

param(
  # Default to the script's folder; fallback to current location if running interactively
  [string]$ProjectRoot = $(if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }),
  [switch]$NoBump,
  [switch]$Quiet
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ---- Paths (root = script folder unless overridden)
# Ensure ProjectRoot is set to a sensible default before resolving
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  if ($PSScriptRoot) { $ProjectRoot = $PSScriptRoot } else { $ProjectRoot = (Get-Location).Path }
}
try {
  $Root = (Resolve-Path $ProjectRoot -ErrorAction Stop).Path
} catch {
  # Fallback: use current location if resolve fails
  $Root = (Get-Location).Path
}
$MetaPath    = Join-Path $Root ".auto.json"
$ReadmePath  = Join-Path $Root "README.md"
$Changelog   = Join-Path $Root "CHANGELOG.md"
$VersionsDir = Join-Path $Root "VERSIONS"
$Version4    = Join-Path $Root "VERSION4"

# ---- Helpers
function Get-ProjectName { Split-Path $Root -Leaf }
function Ensure-File($path, $initial) { if (-not (Test-Path $path)) { Set-Content -Path $path -Value $initial -Encoding utf8 } }

# PS5 compat: Path.GetRelativePath fallback
function Get-RelativePath([string]$Base, [string]$Full) {
  if ([string]::IsNullOrWhiteSpace($Base)) { return $Full }
  $typ = [type]'System.IO.Path'
  if ($typ.GetMethod('GetRelativePath',[type[]]@([string],[string]))) { return [System.IO.Path]::GetRelativePath($Base, $Full) }
  $baseUri = New-Object System.Uri(($Base.TrimEnd('\','/') + [System.IO.Path]::DirectorySeparatorChar))
  $fullUri = New-Object System.Uri($Full)
  ($baseUri.MakeRelativeUri($fullUri).ToString()) -replace '/','\'
}

# --- Version helpers (hardened) ---
function Normalize-Version4($v) {
  if ($null -eq $v) { return "0.0.0.0" }
  if ($v -is [System.Array]) { $v = ($v | Where-Object { $_ -match '\d' } | Select-Object -Last 1) }
  $s = [string]$v
  $m = [regex]::Match($s, '(\d+)\.(\d+)\.(\d+)\.(\d+)')
  if ($m.Success) { return $m.Value }
  "0.0.0.0"
}
function Parse-Version4([string]$v) {
  $v = Normalize-Version4 $v
  if ($v -notmatch '^(\d+)\.(\d+)\.(\d+)\.(\d+)$') { throw "Bad 4-part version after normalize: $v" }
  @([int]$Matches[1], [int]$Matches[2], [int]$Matches[3], [int]$Matches[4])
}
function Bump-Revision([string]$v) {
  $a = Parse-Version4 $v
  $a[3] = $a[3] + 1
  [string]::Format("{0}.{1}.{2}.{3}", $a[0], $a[1], $a[2], $a[3])
}

# --- Path filters (no regex pitfalls) ---
function Test-ExcludedPath([string]$FullPath) {
  $p = ($FullPath -replace '\\','/').ToLowerInvariant()
  return ($p -like '*/.git/*'      -or $p -like '*/.git'      -or
          $p -like '*/versions/*'  -or $p -like '*/versions'  -or
          $p -like '*/.backups/*'  -or $p -like '*/.backups')
}
function Get-IncludeFiles {
  Get-ChildItem -Path $Root -Recurse -File |
    Where-Object { -not (Test-ExcludedPath $_.FullName) }
}

# --- Snapshot / diff (for CHANGELOG entry)
function Snapshot-Tree {
  $map = @{}
  foreach ($f in Get-IncludeFiles) {
    $rel = Get-RelativePath -Base $Root -Full $f.FullName
    try { $map[$rel] = (Get-FileHash -Algorithm SHA256 -LiteralPath $f.FullName).Hash } catch {}
  }
  $map
}
function Diff-Snapshots($old, $new) {
  function To-Dict($obj) {
    if ($obj -is [System.Collections.IDictionary]) { return $obj }
    $d = @{}; if ($obj) { foreach ($p in $obj.PSObject.Properties) { $d[$p.Name] = $p.Value } }
    $d
  }
  $o = To-Dict $old; $n = To-Dict $new
  $added=@(); $modified=@(); $removed=@()
  $oldKeys=@($o.Keys); $newKeys=@($n.Keys)
  foreach ($k in $newKeys) { if (-not $o.ContainsKey($k)) { $added+= $k } elseif ($o[$k] -ne $n[$k]) { $modified+= $k } }
  foreach ($k in $oldKeys) { if (-not $n.ContainsKey($k)) { $removed += $k } }
  [pscustomobject]@{ Added=@($added|Sort-Object); Modified=@($modified|Sort-Object); Removed=@($removed|Sort-Object) }
}

# --- State: load from .auto.json OR VERSION4, save back to both
function Load-State {
  $version = $null
  $snapshot = @{}
  $last = $null

  if (Test-Path $MetaPath) {
    $m = Get-Content $MetaPath -Raw | ConvertFrom-Json
    if ($m) {
      if ($m.snapshot) {
        if ($m.snapshot -is [System.Collections.IDictionary]) { foreach ($k in $m.snapshot.Keys){ $snapshot[$k]=$m.snapshot[$k] } }
        else { foreach ($p in $m.snapshot.PSObject.Properties){ $snapshot[$p.Name]=$p.Value } }
      }
      $version = $m.version
      $last    = $m.last_run
    }
  }

  if (Test-Path $Version4) {
    $version = [System.IO.File]::ReadAllText($Version4).Trim()
  }

  if ([string]::IsNullOrWhiteSpace($version)) { $version = "0.0.0.0" }

  [pscustomobject]@{ version = (Normalize-Version4 $version); snapshot = $snapshot; last_run = $last }
}

function Save-State([string]$version, $snapshot) {
  $clean = Normalize-Version4 $version
  # write VERSION4 first to ensure it exists for next run
  Set-Content -Path $Version4 -Value $clean -Encoding utf8 -NoNewline
  # write .auto.json
  [pscustomobject]@{
    version  = $clean
    snapshot = $snapshot
    last_run = (Get-Date).ToString("s")
  } | ConvertTo-Json -Depth 6 | Set-Content -Path $MetaPath -Encoding utf8
}

# --- CHANGELOG ---
function Write-ChangeLogEntry([string]$version, $diff) {
  Ensure-File $Changelog "# Changelog`n`n"
  $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $added=@($diff.Added); $modified=@($diff.Modified); $removed=@($diff.Removed)
  $lines = @("## $version - $ts")
  if ($added.Count)    { $lines += ""; $lines += "- Added:";    $lines += ($added    | ForEach-Object { "  - $_" }) }
  if ($modified.Count) { $lines += ""; $lines += "- Modified:"; $lines += ($modified | ForEach-Object { "  - $_" }) }
  if ($removed.Count)  { $lines += ""; $lines += "- Removed:";  $lines += ($removed  | ForEach-Object { "  - $_" }) }
  if (-not $added.Count -and -not $modified.Count -and -not $removed.Count) {
    $lines += ""; $lines += "- No file changes since last run"
  }
  $lines += ""
  $entry = ($lines -join "`n") + "`n"
  $existing = Get-Content $Changelog -Raw
  if ($existing) {
    $body = $existing -replace '(?m)^# Changelog\s*' -replace '^\s+'
    "# Changelog`n`n$entry$body" | Set-Content -Path $Changelog -Encoding utf8
  } else {
    "# Changelog`n`n$entry" | Set-Content -Path $Changelog -Encoding utf8
  }
}

# --- README auto-docs ---
function Extract-AutoDocs {
  $files = Get-ChildItem -Path $Root -Recurse -File -Include *.ps1,*.psm1 |
           Where-Object { -not (Test-ExcludedPath $_.FullName) }
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("## Auto Documentation")
  [void]$sb.AppendLine()
  [void]$sb.AppendLine("> Generated by autosave.ps1")
  foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    $funcs = [regex]::Matches($content, '(?m)^\s*function\s+([a-zA-Z_][\w-]*)\s*(?:\(|\{)')
    if ($funcs.Count -eq 0) { continue }
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("### " + (Get-RelativePath -Base $Root -Full $f.FullName))
    foreach ($m in $funcs) {
      $name = $m.Groups[1].Value
      $syn = ""
      $synMatch = [regex]::Match($content, "(?ms)<#\s*\.SYNOPSIS\s*(.*?)#>")
      if ($synMatch.Success) { $syn = ($synMatch.Groups[1].Value -replace '^\s+|\s+$','') -replace '\r','' }
      if ([string]::IsNullOrWhiteSpace($syn)) { $syn = "(no synopsis)" }
      [void]$sb.AppendLine("- **$name** — $syn")
    }
  }
  $sb.ToString()
}
function Get-FileModificationTime([string]$path) {
  try {
    if (Test-Path $path) {
      $item = Get-Item $path
      if ($item) {
        return $item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
      }
    }
  } catch {
    # Ignore any errors
  }
  return "Updates with changes"
}

function Extract-FileDescriptions {
  $title = Get-ProjectName
  
  # Ensure VERSION4 exists
  if (-not (Test-Path $Version4)) {
    Set-Content -Path $Version4 -Value "0.0.0.0" -Encoding utf8 -NoNewline
  }
  
  $version = (Get-Content $Version4 -Raw).Trim()
  $lastUpdate = Get-FileModificationTime $Version4
  
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine("# $title")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("**Version:** $version")
  [void]$sb.AppendLine("**Last updated:** $lastUpdate")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("## Project Files Overview")
  [void]$sb.AppendLine("")
  [void]$sb.AppendLine("### Core Files")
  [void]$sb.AppendLine("")
  # Always document autosave.ps1 if present (this script)
  if (Test-Path (Join-Path $Root "autosave.ps1")) {
    [void]$sb.AppendLine('#### `autosave.ps1`')
    [void]$sb.AppendLine('- **Purpose:** Main automation script that handles version control and project maintenance')
    [void]$sb.AppendLine('- **Features:**')
    [void]$sb.AppendLine('  - Automatically increments 4-part version numbers (0.0.0.0 → 0.0.0.1)')
    [void]$sb.AppendLine('  - Creates versioned ZIP archives of the project')
    [void]$sb.AppendLine('  - Updates changelog with file modifications')
    [void]$sb.AppendLine('  - Generates automatic documentation')
    [void]$sb.AppendLine('  - Maintains project state')
    [void]$sb.AppendLine("- **Last Modified:** " + (Get-FileModificationTime "autosave.ps1"))
    [void]$sb.AppendLine("")
  }

  # Optional: manage.ps1 (only if present)
  if (Test-Path (Join-Path $Root "manage.ps1")) {
    [void]$sb.AppendLine('#### `manage.ps1`')
    [void]$sb.AppendLine('- **Purpose:** Project management and utility script')
    [void]$sb.AppendLine('- **Features:**')
    [void]$sb.AppendLine('  - Provides timestamp functionality')
    [void]$sb.AppendLine('  - Handles version management utilities')
    [void]$sb.AppendLine('  - Contains helper functions for project management')
    [void]$sb.AppendLine("- **Last Modified:** " + (Get-FileModificationTime "manage.ps1"))
    [void]$sb.AppendLine("")
  }

  [void]$sb.AppendLine("### Project Files")
  [void]$sb.AppendLine("")
  if (Test-Path (Join-Path $Root "CHANGELOG.md")) {
    [void]$sb.AppendLine('#### `CHANGELOG.md`')
    [void]$sb.AppendLine('- **Purpose:** Maintains a detailed history of project changes')
    [void]$sb.AppendLine('- **Features:**')
    [void]$sb.AppendLine('  - Records version updates')
    [void]$sb.AppendLine('  - Lists added, modified, and removed files')
    [void]$sb.AppendLine('  - Includes timestamps for each change')
    [void]$sb.AppendLine("- **Last Modified:** " + (Get-FileModificationTime "CHANGELOG.md"))
    [void]$sb.AppendLine("")
  }

  if (Test-Path $Version4) {
    [void]$sb.AppendLine('#### `VERSION4`')
    [void]$sb.AppendLine('- **Purpose:** Stores the current project version')
    [void]$sb.AppendLine('- **Features:**')
    [void]$sb.AppendLine('  - Contains the latest 4-part version number')
    [void]$sb.AppendLine('  - Used by autosave.ps1 for version tracking')
    [void]$sb.AppendLine("- **Last Modified:** " + (Get-FileModificationTime "VERSION4"))
    [void]$sb.AppendLine("")
  }

  if (Test-Path (Join-Path $Root "project.json")) {
    [void]$sb.AppendLine('#### `project.json`')
    [void]$sb.AppendLine('- **Purpose:** Project configuration and settings')
    [void]$sb.AppendLine('- **Features:**')
    [void]$sb.AppendLine('  - Stores project-specific settings')
    [void]$sb.AppendLine('  - Configuration parameters')
    [void]$sb.AppendLine("- **Last Modified:** " + (Get-FileModificationTime "project.json"))
    [void]$sb.AppendLine("")
  }

  [void]$sb.AppendLine("### System Files")
  [void]$sb.AppendLine("")
  if (Test-Path (Join-Path $Root ".auto.json")) {
    [void]$sb.AppendLine('#### `.auto.json`')
    [void]$sb.AppendLine('- **Purpose:** Internal state tracking')
    [void]$sb.AppendLine('- **Features:**')
    [void]$sb.AppendLine('  - Stores last run state')
    [void]$sb.AppendLine('  - Maintains file snapshots for change detection')
    [void]$sb.AppendLine('  - Tracks version history')
    [void]$sb.AppendLine("- **Last Modified:** " + (Get-FileModificationTime ".auto.json"))
    [void]$sb.AppendLine("")
  }

  if (Test-Path $VersionsDir) {
    [void]$sb.AppendLine('#### `VERSIONS/`')
    [void]$sb.AppendLine('- **Purpose:** Directory containing versioned project archives')
    [void]$sb.AppendLine('- **Features:**')
    [void]$sb.AppendLine('  - Stores ZIP files of each version')
    [void]$sb.AppendLine('  - Format: ProjectName-X.X.X.X.zip')
    [void]$sb.AppendLine("")
  }
  $sb.ToString()
}

function Update-Readme-AutoSection {
  # First update the file descriptions
  $descriptions = Extract-FileDescriptions
  $auto = Extract-AutoDocs
  
  # Update auto-docs section
  $begin = "<!-- AUTO-DOCS:BEGIN -->"; $end = "<!-- AUTO-DOCS:END -->"
  $block = "$begin`n$auto`n$end"
  
  if (Test-Path $ReadmePath) {
    Set-Content -Path $ReadmePath -Value $descriptions -Encoding utf8
    $txt = Get-Content $ReadmePath -Raw
    if ($txt -match [regex]::Escape($begin) -and $txt -match [regex]::Escape($end)) {
      $pattern = "(?ms)" + [regex]::Escape($begin) + ".*?" + [regex]::Escape($end)
      $txt = [regex]::Replace($txt, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $block })
      Set-Content -Path $ReadmePath -Value $txt -Encoding utf8
    } else {
      Add-Content -Path $ReadmePath -Value "`n$block`n" -Encoding utf8
    }
  } else {
    $title = Get-ProjectName
    Set-Content -Path $ReadmePath -Value "$descriptions`n$block`n" -Encoding utf8
  }
}

# --- Zip snapshot ---
function Make-VersionZip([string]$version) {
  $version = Normalize-Version4 $version
  if (-not (Test-Path $VersionsDir)) { New-Item -ItemType Directory -Path $VersionsDir | Out-Null }
  $name = "{0}-{1}.zip" -f (Get-ProjectName), $version
  $zipPath = Join-Path $VersionsDir $name
  $files = Get-IncludeFiles | ForEach-Object { $_.FullName }
  if ($files.Count -gt 0) {
    Compress-Archive -Path $files -DestinationPath $zipPath -Force -CompressionLevel Optimal
  } else { Set-Content -Path $zipPath -Value "" }
  $zipPath
}

# -------------------- Run once --------------------

# 1) Load last state from .auto.json or VERSION4
$state   = Load-State
$oldSnap = $state.snapshot
$oldVer  = $state.version

# 2) Compute new snapshot & diff (for changelog details)
$newSnap = Snapshot-Tree
$diff    = Diff-Snapshots -old $oldSnap -new $newSnap

# 3) Always refresh README auto-docs
Update-Readme-AutoSection

# 4) Bump version unless NoBump requested
if (-not $NoBump) {
  $newVer = Bump-Revision $oldVer
  $newVer = Normalize-Version4 $newVer  # keep clean
} else {
  $newVer = $oldVer
}

# 5) Persist version to VERSION4 + .auto.json, then write changelog + zip
Save-State -version $newVer -snapshot $newSnap
Write-ChangeLogEntry -version $newVer -diff $diff
$zip = Make-VersionZip -version $newVer

if (-not $Quiet) {
  Write-Host "Autosave complete:"
  Write-Host "  Previous: $oldVer"
  Write-Host "  Version:  $newVer"
  Write-Host "  Zip:      $zip"
  Write-Host "  Root:     $Root"
} else {
  # Quiet mode: minimal output
  Write-Host "Autosave: $newVer ($Root)" -ForegroundColor DarkGray
}
