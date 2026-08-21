<#
.SYNOPSIS
  Push linux-tryout-setup.sh + each machine's website folders onto the HAILMARY /
  ROCKY tryout VMs over SSH (Windows / PowerShell).

.DESCRIPTION
  Current login on the targets is  user:bruh . Files land in the login user's home:
      ~/linux-tryout-setup.sh          (the tool, made executable)
      ~/cptc-src/<AppFolder>/          (that machine's website source)

  Password auth is non-interactive via the Posh-SSH module (auto-installed for the
  current user if missing). Windows' built-in ssh/scp cannot take a password on
  the command line, which is why Posh-SSH is used.

.EXAMPLE
  .\push-to-targets.ps1                     # both machines, default creds (user:bruh)
  .\push-to-targets.ps1 rocky               # one machine (rocky|hailmary|all)
  .\push-to-targets.ps1 rocky user:bruh     # pass creds as user:pass (any order)
  .\push-to-targets.ps1 user:bruh           # both machines, given creds
  .\push-to-targets.ps1 rocky user:bruh -DryRun   # build tarball + show plan, no transfer

  (if scripts are blocked:  powershell -ExecutionPolicy Bypass -File .\push-to-targets.ps1 rocky user:bruh)
#>
[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Params,
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------- config -------
$SshUser    = if ($env:SSH_USER)     { $env:SSH_USER }     else { 'user' }
$SshPass    = if ($env:SSH_PASS)     { $env:SSH_PASS }     else { 'bruh' }
$SrcDirName = if ($env:SRC_DIR_NAME) { $env:SRC_DIR_NAME } else { 'cptc-src' }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Tool      = if ($env:TOOL)      { $env:TOOL }      else { Join-Path $ScriptDir 'linux-tryout-setup.sh' }
$AppsRoot  = if ($env:APPS_ROOT) { $env:APPS_ROOT } else { $ScriptDir }

# machine, ip, and the app folders it should receive (names must match on target)
$Targets = @(
  [pscustomobject]@{ Machine = 'hailmary'; Ip = '172.16.124.112'; Apps = @('HR-Portal','wormhole-casino-website') }
  [pscustomobject]@{ Machine = 'rocky';    Ip = '172.16.124.113'; Apps = @('Antimatter-Weapons','Bubble-Control') }
)

$Excludes = @('--exclude=node_modules','--exclude=.git','--exclude=.svelte-kit',
              '--exclude=build','--exclude=venv','--exclude=__pycache__','--exclude=*.pyc',
              '--exclude=*.db','--exclude=*.sqlite*','--exclude=.env')

# --------------------------------------------------------------- logging ------
function Info($m){ Write-Host "[*] $m" -ForegroundColor Cyan }
function Ok($m)  { Write-Host "[+] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[!] $m" -ForegroundColor Yellow }
function Section($m){ Write-Host "`n=== $m ===" -ForegroundColor Blue }

# --------------------------------------------------------------- args ----------
$wantMachines = @()
foreach ($a in $Params) {
  if ($a -match ':') {
    $parts = $a -split ':', 2
    $SshUser = $parts[0]; $SshPass = $parts[1]
  } elseif ($a -in @('rocky','hailmary','all')) {
    $wantMachines += $a
  } else {
    throw "unknown argument '$a' (want a machine rocky|hailmary|all, or creds user:pass)"
  }
}
if ($wantMachines.Count -eq 0) { $wantMachines = @('all') }
if ([string]::IsNullOrEmpty($SshUser)) { throw "empty SSH user in creds" }
$mask = '*' * $SshPass.Length
Info "targets: $($wantMachines -join ',')   login: ${SshUser}:${mask}"

# --------------------------------------------------------------- checks -------
if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
  throw "tar.exe not found (needs Windows 10 1803+). Install tar, or run the .sh from WSL/Git-Bash."
}
if (-not (Test-Path $Tool))     { throw "tool not found: $Tool" }
if (-not (Test-Path $AppsRoot)) { throw "app source dir not found: $AppsRoot (set `$env:APPS_ROOT)" }
$AppsRoot = (Resolve-Path $AppsRoot).Path

function Ensure-PoshSSH {
  if (Get-Module -Name Posh-SSH) { return }
  if (Get-Module -ListAvailable -Name Posh-SSH) { Import-Module Posh-SSH; return }
  Warn "Posh-SSH module not found - installing for the current user (needs internet / PSGallery)"
  try {
    if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) {
      Install-PackageProvider -Name NuGet -Scope CurrentUser -Force | Out-Null
    }
    Install-Module Posh-SSH -Scope CurrentUser -Force -AllowClobber
    Import-Module Posh-SSH
  } catch {
    throw "could not install Posh-SSH. Install it manually and re-run:  Install-Module Posh-SSH -Scope CurrentUser"
  }
}

# --------------------------------------------------------------- helpers ------
function New-AppTarball($apps, $out) {
  $tarArgs = @('-czf', $out) + $Excludes + @('-C', $AppsRoot) + $apps
  & tar @tarArgs
  if ($LASTEXITCODE -ne 0) { throw "tar failed building $out" }
}

function Copy-ToRemote($ip, $cred, $local, $remoteDir) {
  if (Get-Command Set-SCPItem -ErrorAction SilentlyContinue) {
    Set-SCPItem -ComputerName $ip -Credential $cred -AcceptKey -Path $local -Destination $remoteDir | Out-Null
  } elseif (Get-Command Set-SCPFile -ErrorAction SilentlyContinue) {
    Set-SCPFile -ComputerName $ip -Credential $cred -AcceptKey -LocalFile $local -RemotePath $remoteDir | Out-Null
  } else {
    throw "no Posh-SSH SCP cmdlet (Set-SCPItem/Set-SCPFile) available"
  }
}

# --------------------------------------------------------------- push ----------
function Push-Target($t) {
  Section "$($t.Machine) ($($t.Ip))"

  $present = @()
  foreach ($a in $t.Apps) {
    if (Test-Path (Join-Path $AppsRoot $a)) { $present += $a } else { Warn "missing source: $a (skipped)" }
  }
  $tgz = Join-Path $env:TEMP ("cptc-" + $t.Machine + "-" + $PID + ".tgz")
  Info "packing website(s): $($present -join ', ')"
  New-AppTarball $present $tgz
  $tgzKB = [math]::Round((Get-Item $tgz).Length / 1KB)
  Info "payload: $(Split-Path $tgz -Leaf) ($tgzKB KB)"

  if ($DryRun) {
    Ok "[dry-run] would place ~/linux-tryout-setup.sh + ~/$SrcDirName/ ($($present -join ', ')) on $SshUser@$($t.Ip)"
    Remove-Item $tgz -ErrorAction SilentlyContinue
    return
  }

  $secure = ConvertTo-SecureString $SshPass -AsPlainText -Force
  $cred   = New-Object System.Management.Automation.PSCredential($SshUser, $secure)

  $sess = New-SSHSession -ComputerName $t.Ip -Credential $cred -AcceptKey -ConnectionTimeout 15
  try {
    $rhome = (((Invoke-SSHCommand -SessionId $sess.SessionId -Command 'printf %s "$HOME"').Output) -join '').Trim()
    if ([string]::IsNullOrEmpty($rhome)) { $rhome = "/home/$SshUser" }
    $dest    = "$rhome/$SrcDirName"
    $tgzName = Split-Path $tgz -Leaf

    Info "copying tool + payload -> ${rhome}/"
    Copy-ToRemote $t.Ip $cred $Tool $rhome
    Copy-ToRemote $t.Ip $cred $tgz  $rhome

    $tool = "$rhome/linux-tryout-setup.sh"
    $remote = "mkdir -p '$dest'; tar xzf '$rhome/$tgzName' -C '$dest'; rm -f '$rhome/$tgzName'; tr -d '\r' < '$tool' > '$rhome/.tool.tmp' && mv '$rhome/.tool.tmp' '$tool'; chmod +x '$tool'; echo OK"
    $r = Invoke-SSHCommand -SessionId $sess.SessionId -Command $remote
    if ($r.ExitStatus -ne 0) { Warn "remote setup returned $($r.ExitStatus): $($r.Output -join ' ')" }

    Ok "$($t.Machine): tool -> $tool ; apps -> $dest/"
    Write-Host "     next: ssh $SshUser@$($t.Ip) (password: $SshPass), become root, then:" -ForegroundColor DarkGray
    Write-Host "       $tool $($t.Machine) --audit" -ForegroundColor DarkGray
    Write-Host "       $tool $($t.Machine) --accounts --privesc --launch" -ForegroundColor DarkGray
    Write-Host "       (use the full path above, not ~ ; --launch reads $dest by default)" -ForegroundColor DarkGray
  } finally {
    Remove-SSHSession -SessionId $sess.SessionId | Out-Null
    Remove-Item $tgz -ErrorAction SilentlyContinue
  }
}

# --------------------------------------------------------------- main ----------
if (-not $DryRun) { Ensure-PoshSSH }

$did = $false
foreach ($t in $Targets) {
  if (($wantMachines -contains 'all') -or ($wantMachines -contains $t.Machine)) {
    Push-Target $t
    $did = $true
  }
}
if (-not $did) { throw "no matching target in: $($wantMachines -join ',')  (valid: hailmary rocky all)" }
Write-Host "`n[+] transfer complete" -ForegroundColor Green
