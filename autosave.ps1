<# autosave.ps1 (v3)
Purpose
  - Walk the project tree and (a) add a lightweight, language-appropriate header to each source file,
    (b) NEVER overwrite manual edits, (c) keep a 4-part VERSION4, CHANGELOG.md, and VERSIONS zip,
    and (d) auto-update a README "Auto Docs" section that summarizes the project.
  - Designed to be idempotent and safe to run repeatedly.

Manual-edits safety
  - We only touch the "AUTODOC META" sub-block that we fully own between markers.
  - Any "USER NOTES" sub-block is left intact forever.
  - If no header exists, we create a header with both blocks. If a header exists, we ONLY update META.
  - Binary/large files and excluded folders are skipped.

Markers
  - BEGIN AUTODOC HEADER ...................................... language comment prefix
    BEGIN AUTODOC META  (auto-managed; safe to regen)
    END AUTODOC META
    BEGIN USER NOTES     (your notes; we will not touch)
    END USER NOTES
  - END AUTODOC HEADER

Usage
  .\autosave.ps1 [-ProjectRoot <path>] [-NoBump] [-Quiet]
#>

param(
  [string]$ProjectRoot = $(if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }),
  [switch]$NoBump,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ---- Resolve root safely
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
}
try { $Root = (Resolve-Path $ProjectRoot -ErrorAction Stop).Path } catch { $Root = (Get-Location).Path }

# ---- Paths
$MetaPath    = Join-Path $Root '.auto.json'
$ReadmePath  = Join-Path $Root 'README.md'
$Changelog   = Join-Path $Root 'CHANGELOG.md'
$VersionsDir = Join-Path $Root 'VERSIONS'
$Version4    = Join-Path $Root 'VERSION4'

# ---- Utilities
function Get-ProjectName { Split-Path $Root -Leaf }

function Ensure-File([string]$Path, [string]$Initial) {
  if (-not (Test-Path $Path)) { Set-Content -Path $Path -Value $Initial -Encoding utf8 }
}

function Get-RelativePath([string]$Base, [string]$Full) {
  $typ = [type]'System.IO.Path'
  if ($typ.GetMethod('GetRelativePath',[type[]]@([string],[string]))) { return [System.IO.Path]::GetRelativePath($Base, $Full) }
  $baseUri = New-Object System.Uri(($Base.TrimEnd('\','/') + [System.IO.Path]::DirectorySeparatorChar))
  $fullUri = New-Object System.Uri($Full)
  ($baseUri.MakeRelativeUri($fullUri).ToString()) -replace '/','\'
}

# ---- Version helpers
function Normalize-Version4($v) {
  if ($null -eq $v) { return '0.0.0.0' }
  if ($v -is [System.Array]) { $v = ($v | Where-Object { $_ -match '\d' } | Select-Object -Last 1) }
  $m = [regex]::Match([string]$v, '(\d+)\.(\d+)\.(\d+)\.(\d+)')
  if ($m.Success) { return $m.Value } else { return '0.0.0.0' }
}
function Parse-Version4([string]$v) {
  $v = Normalize-Version4 $v
  if ($v -notmatch '^(\d+)\.(\d+)\.(\d+)\.(\d+)$') { throw "Bad 4-part version: $v" }
  @([int]$Matches[1], [int]$Matches[2], [int]$Matches[3], [int]$Matches[4])
}
function Bump-Revision([string]$v) {
  $a = Parse-Version4 $v
  $a[3] = $a[3] + 1
  '{0}.{1}.{2}.{3}' -f $a[0],$a[1],$a[2],$a[3]
}

# ---- Inclusion/Exclusion
$ExcludeDirs = @('.git','node_modules','.venv','venv','bin','obj','packages','dist','build','coverage','.idea','.vscode','__pycache__','target','.pytest_cache')
$MaxFileSizeKB = 512 # skip anything larger (likely generated/binary)

# Known text extensions with comment syntax
$CommentStyles = @{
  # linePrefix, blockStart, blockEnd
  '.ps1'  = @{ line='# '; start='# '; end='# ' }
  '.psm1' = @{ line='# '; start='# '; end='# ' }
  '.psd1' = @{ line='# '; start='# '; end='# ' }
  '.ps1xml' = @{ line='<!-- '; start='<!-- '; end=' -->' }
  '.pssc' = @{ line='# '; start='# '; end='# ' }
  '.psrc' = @{ line='# '; start='# '; end='# ' }

  '.cs'   = @{ line='// '; start='/* '; end=' */' }
  '.ts'   = @{ line='// '; start='/* '; end=' */' }
  '.tsx'  = @{ line='// '; start='/* '; end=' */' }
  '.js'   = @{ line='// '; start='/* '; end=' */' }
  '.jsx'  = @{ line='// '; start='/* '; end=' */' }
  '.java' = @{ line='// '; start='/* '; end=' */' }
  '.go'   = @{ line='// '; start='/* '; end=' */' }
  '.php'  = @{ line='// '; start='/* '; end=' */' }

  '.py'   = @{ line='# '; start='"""'; end='"""' }
  '.rb'   = @{ line='# '; start='# '; end='# ' }
  '.rs'   = @{ line='// '; start='/* '; end=' */' }
  '.c'    = @{ line='// '; start='/* '; end=' */' }
  '.cpp'  = @{ line='// '; start='/* '; end=' */' }
  '.h'    = @{ line='// '; start='/* '; end=' */' }
  '.hpp'  = @{ line='// '; start='/* '; end=' */' }

  '.sh'   = @{ line='# '; start=": <<'AUTODOC'"; end='AUTODOC' }
  '.bat'  = @{ line=':: '; start=':: '; end=':: ' }
  '.cmd'  = @{ line=':: '; start=':: '; end=':: ' }

  '.sql'  = @{ line='-- '; start='/* '; end=' */' }
  '.yml'  = @{ line='# '; start='# '; end='# ' }
  '.yaml' = @{ line='# '; start='# '; end='# ' }
  '.toml' = @{ line='# '; start='# '; end='# ' }
  '.ini'  = @{ line='; '; start='; '; end='; ' }
  '.md'   = @{ line='<!-- '; start='<!-- '; end=' -->' }
}

function Is-Excluded([string]$FullPath) {
  foreach ($dir in $ExcludeDirs) {
    if ($FullPath -match [regex]::Escape([System.IO.Path]::DirectorySeparatorChar + $dir + [System.IO.Path]::DirectorySeparatorChar)) { return $true }
  }
  return $false
}

function Get-TextFiles {
  Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
      -not (Is-Excluded $_.FullName) -and
      ($CommentStyles.ContainsKey([System.IO.Path]::GetExtension($_.Name).ToLower())) -and
      ($_.Length -lt ($MaxFileSizeKB * 1024))
    }
}

# ---- Header helpers
$HDR_BEGIN = 'BEGIN AUTODOC HEADER'
$HDR_END   = 'END AUTODOC HEADER'
$META_BEGIN = 'BEGIN AUTODOC META'
$META_END   = 'END AUTODOC META'
$USER_BEGIN = 'BEGIN USER NOTES'
$USER_END   = 'END USER NOTES'

function New-Header([string]$Rel, [hashtable]$style, [string]$version) {
  $now = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $lp = $style.line; $bs = $style.start; $be = $style.end
  $lines = @()
  if ($bs -and $be -and $bs -ne $lp) {
    $lines += "$bs $HDR_BEGIN"
    $lines += "$lp File: $Rel"
    $lines += "$lp Description: (edit inside USER NOTES below)"
    $lines += "$lp"
    $lines += "$lp $META_BEGIN"
    $lines += "$lp Version: $version"
    $lines += "$lp Last-Updated: $now"
    $lines += "$lp Managed-By: autosave.ps1"
    $lines += "$lp $META_END"
    $lines += "$lp"
    $lines += "$lp $USER_BEGIN"
    $lines += "$lp Your notes here. We will NEVER change this block."
    $lines += "$lp $USER_END"
    $lines += "$be $HDR_END"
  } else {
    # line comments only
    $lines += "$lp $HDR_BEGIN"
    $lines += "$lp File: $Rel"
    $lines += "$lp Description: (edit inside USER NOTES below)"
    $lines += "$lp"
    $lines += "$lp $META_BEGIN"
    $lines += "$lp Version: $version"
    $lines += "$lp Last-Updated: $now"
    $lines += "$lp Managed-By: autosave.ps1"
    $lines += "$lp $META_END"
    $lines += "$lp"
    $lines += "$lp $USER_BEGIN"
    $lines += "$lp Your notes here. We will NEVER change this block."
    $lines += "$lp $USER_END"
    $lines += "$lp $HDR_END"
  }
  ($lines -join [Environment]::NewLine) + [Environment]::NewLine + [Environment]::NewLine
}

function Update-Meta([string]$Text, [hashtable]$style, [string]$version) {
  $now = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $metaBegin = [regex]::Escape("$($style.line)$META_BEGIN".TrimEnd())
  $metaEnd   = [regex]::Escape("$($style.line)$META_END".TrimEnd())
  $pattern = "(?s)($metaBegin).*?($metaEnd)"
  if ($Text -match $pattern) {
    $newMeta = @(
      "$($style.line) $META_BEGIN",
      "$($style.line) Version: $version",
      "$($style.line) Last-Updated: $now",
      "$($style.line) Managed-By: autosave.ps1",
      "$($style.line) $META_END"
    ) -join [Environment]::NewLine
    return ($Text -replace $pattern, [System.Text.RegularExpressions.Regex]::Escape($newMeta) -replace '\\r\\n', [Environment]::NewLine)
  }
  return $Text
}

function Has-Header([string]$Text) {
  return $Text -match [regex]::Escape($HDR_BEGIN)
}

# ---- Snapshot & state
function Snapshot-Tree {
  $files = Get-TextFiles
  $map = @{}
  foreach ($f in $files) {
    $rel = Get-RelativePath $Root $f.FullName
    $map[$rel] = @{ hash = (Get-FileHash -Path $f.FullName -Algorithm SHA256).Hash; size = $f.Length }
  }
  $map
}

function Load-State {
  $state = @{ version = '0.0.0.0'; snapshot = @{} }
  if (Test-Path $MetaPath) {
    try {
      $obj = Get-Content $MetaPath -Raw | ConvertFrom-Json
      if ($obj.version) { $state.version = [string]$obj.version }
      if ($obj.snapshot) {
        $snap = @{}
        if ($obj.snapshot -is [System.Collections.IDictionary]) { foreach ($k in $obj.snapshot.Keys){ $snap[$k] = $obj.snapshot[$k] } }
        else { foreach ($p in $obj.snapshot.PSObject.Properties){ $snap[$p.Name] = $p.Value } }
        $state.snapshot = $snap
      }
    } catch { }
  } elseif (Test-Path $Version4) {
    $state.version = (Get-Content $Version4 -Raw).Trim()
  }
  $state
}

function Save-State([string]$version, $snapshot) {
  $obj = [pscustomobject]@{ version = $version; snapshot = $snapshot; ts = (Get-Date).ToString('s') }
  $json = $obj | ConvertTo-Json -Depth 6
  Set-Content -Path $MetaPath -Value $json -Encoding utf8
  Set-Content -Path $Version4 -Value $version -Encoding utf8 -NoNewline
}

function Diff-Snapshots($old, $new) {
  $added    = @()
  $modified = @()
  $removed  = @()

  if ($null -eq $old -or -not ($old -is [System.Collections.IDictionary])) { $old = @{} }
  if ($null -eq $new -or -not ($new -is [System.Collections.IDictionary])) { $new = @{} }

  function _GetHash($entry) {
    if ($null -eq $entry) { return $null }
    if ($entry -is [string]) { return $entry }
    if ($entry -is [System.Collections.IDictionary]) {
      if ($entry.Contains('hash')) { return $entry['hash'] }
      if ($entry.Contains('Hash')) { return $entry['Hash'] }
    }
    $p = $entry.PSObject.Properties
    if ($p['hash']) { return $entry.hash }
    if ($p['Hash']) { return $entry.Hash }
    return $null
  }

  $oldKeys = @($old.Keys)
  $newKeys = @($new.Keys)

  foreach ($k in $newKeys) {
    if (-not $old.ContainsKey($k)) {
      $added += $k
    } else {
      $oldHash = _GetHash $old[$k]
      $newHash = _GetHash $new[$k]
      if ($oldHash -ne $newHash) {
        $modified += $k
      }
    }
  }

  foreach ($k in $oldKeys) {
    if (-not $new.ContainsKey($k)) {
      $removed += $k
    }
  }

  [pscustomobject]@{
    Added    = @($added | Sort-Object)
    Modified = @($modified | Sort-Object)
    Removed  = @($removed | Sort-Object)
  }
}

# ---- README auto-docs
function Extract-FileDescriptions {
  $rows = @()
  foreach ($f in Get-TextFiles) {
    $rel = Get-RelativePath $Root $f.FullName
    $ext = [System.IO.Path]::GetExtension($f.Name).ToLower()
    $style = $CommentStyles[$ext]
    $text = (Get-Content $f.FullName -Raw)
    $desc = '(no user notes yet)'
    if ($text -match [regex]::Escape($HDR_BEGIN)) {
      if ($text -match "(?s)$([regex]::Escape($USER_BEGIN))(?<content>.*?)(?=$([regex]::Escape($USER_END)))") {
        $descRaw = $Matches['content']
        if ($null -ne $descRaw) {
          $descLine = (
            $descRaw -split "`r?`n" |
            ForEach-Object { $_ -replace '^\s*' + [regex]::Escape($style.line), '' } |
            Where-Object { $_ -match '\S' } |
            Select-Object -First 1
          )
          if (-not [string]::IsNullOrWhiteSpace($descLine)) {
            $desc = $descLine
          }
        }
      }
    }
    $rows += [pscustomobject]@{
      File = $rel
      Size = $f.Length
      Updated = $f.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
      Notes = $desc -replace '\r?\n',' '
    }
  }
  $rows | Sort-Object File
}

function Update-Readme-AutoSection {
  $project = Get-ProjectName
  Ensure-File $ReadmePath "# $project`r`n"
  $ver = (Get-Content $Version4 -Raw).Trim()
  $rows = Extract-FileDescriptions
  $lines = @()
  $lines += "## Auto Docs"
  $lines += ""
  $lines += "**Version:** $ver"
  $lines += ""
  $lines += "| File | Updated | Size | Notes |"
  $lines += "|---|---:|---:|---|"
  foreach ($r in $rows) {
    $lines += "| $($r.File) | $($r.Updated) | $($r.Size) | $([regex]::Replace($r.Notes,'\|','\\|')) |"
  }
  $block = ($lines -join "`r`n")

  $start = '<!-- BEGIN AUTODOC -->'
  $end   = '<!-- END AUTODOC -->'
  $readme = Get-Content $ReadmePath -Raw
  if ($readme -match [regex]::Escape($start)) {
    $readme = $readme -replace "(?s)$([regex]::Escape($start)).*?$([regex]::Escape($end))", "$start`r`n$block`r`n$end"
  } else {
    $readme = $readme.TrimEnd() + "`r`n`r`n$start`r`n$block`r`n$end`r`n"
  }
  Set-Content -Path $ReadmePath -Value $readme -Encoding utf8
}

# ---- Changelog
function Write-ChangeLogEntry([string]$version, $diff) {
  Ensure-File $Changelog "# Changelog`r`n"
  $dt = Get-Date
  $lines = @()
  $lines += "## $version - $($dt.ToString('yyyy-MM-dd HH:mm'))"
  if ($diff.Added.Count -eq 0 -and $diff.Modified.Count -eq 0 -and $diff.Removed.Count -eq 0) {
    $lines += "- No source changes (meta-only run)"
  } else {
    if ($diff.Added.Count)    { $lines += "- Added:`r`n  - "    + ($diff.Added -join "`r`n  - ") }
    if ($diff.Modified.Count) { $lines += "- Modified:`r`n  - " + ($diff.Modified -join "`r`n  - ") }
    if ($diff.Removed.Count)  { $lines += "- Removed:`r`n  - "  + ($diff.Removed -join "`r`n  - ") }
  }
  $entry = ($lines -join "`r`n") + "`r`n`r`n"
  Add-Content -Path $Changelog -Value $entry -Encoding utf8
}

# ---- Versioned ZIP
function Make-VersionZip([string]$version) {
  if (-not (Test-Path $VersionsDir)) { New-Item -ItemType Directory -Path $VersionsDir | Out-Null }
  $safeName = "{0}-{1}.zip" -f (Get-ProjectName), $version
  $zipPath = Join-Path $VersionsDir $safeName

  # Create temp staging folder to avoid zip including existing zips
  $tmp = Join-Path $VersionsDir ('.staging_' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    Get-ChildItem -Path $Root -Recurse -File | Where-Object {
      -not (Is-Excluded $_.FullName) -and ($_.DirectoryName -notlike "$VersionsDir*")
    } | ForEach-Object {
      $rel = Get-RelativePath $Root $_.FullName
      $dest = Join-Path $tmp $rel
      New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
      Copy-Item -Path $_.FullName -Destination $dest -Force
    }
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $zipPath)
  } finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
  $zipPath
}

# ---- Per-file processing
function Process-Files([string]$version) {
  $touched = @()
  foreach ($f in Get-TextFiles) {
    $ext = [System.IO.Path]::GetExtension($f.Name).ToLower()
    $style = $CommentStyles[$ext]
    if (-not $style) { continue }
    $rel = Get-RelativePath $Root $f.FullName
    $text = (Get-Content $f.FullName -Raw)
    $changed = $false

    if (-not (Has-Header $text)) {
      $header = New-Header -Rel $rel -style $style -version $version
      $text = $header + $text
      $changed = $true
    } else {
      $updated = Update-Meta -Text $text -style $style -version $version
      if ($updated -ne $text) { $text = $updated; $changed = $true }
    }

    if ($changed) {
      Set-Content -Path $f.FullName -Value $text -Encoding utf8
      $touched += $rel
      if (-not $Quiet) { Write-Host "Updated header: $rel" }
    }
  }
  $touched
}

# ---- Main
# Load state & calculate new version
$state = Load-State
$oldVer = Normalize-Version4 $state.version
$newVer = if ($NoBump) { $oldVer } else { Bump-Revision $oldVer }

# Ensure marker files
Ensure-File $Version4 $oldVer
Ensure-File $ReadmePath "# $(Get-ProjectName)`r`n"
Ensure-File $Changelog "# Changelog`r`n"

# Apply doc headers (safe; preserves user edits)
$touched = Process-Files -version $newVer

# Build new snapshot AFTER possible file updates
$newSnap = Snapshot-Tree
$diff = Diff-Snapshots -old $state.snapshot -new $newSnap

# Persist state & outputs
Save-State -version $newVer -snapshot $newSnap
Update-Readme-AutoSection
Write-ChangeLogEntry -version $newVer -diff $diff
$zip = Make-VersionZip -version $newVer

if (-not $Quiet) {
  Write-Host "Autosave complete:"
  Write-Host "  Previous: $oldVer"
  Write-Host "  Version:  $newVer"
  Write-Host "  Files touched: $(@($touched).Count)"
  Write-Host "  Zip:      $zip"
  Write-Host "  Root:     $Root"
} else {
  Write-Host "Autosave: $newVer ($Root)" -ForegroundColor DarkGray
}
