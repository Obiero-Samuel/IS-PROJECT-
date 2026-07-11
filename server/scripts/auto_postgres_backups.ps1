<#
Project-integrated PostgreSQL backup automation for IS PROJECT.

What it can do:
1) Run an immediate backup.
2) Register/update a daily Windows Scheduled Task for automatic backups.
3) Keep only recent backups based on retention days.
4) Load DB defaults from server .env automatically when available.

Examples (from /server):
- Run one backup now:
  .\scripts\auto_postgres_backups.ps1

- Preview actions only:
  .\scripts\auto_postgres_backups.ps1 -DryRun

- Register a daily task at 02:00:
  .\scripts\auto_postgres_backups.ps1 -RegisterDailyTask -TaskTime "02:00"
#>

param(
    [string]$DbName = 'is_project_db',
    [string]$DbUser = 'postgres',
    [string]$DbHost = 'localhost',
    [int]$DbPort = 5432,
    [string]$DbPassword = '',
    [string]$BackupDirectory = "$PSScriptRoot\..\backups\db",
    [int]$RetentionDays = 14,
    [string]$PgDumpPath = 'pg_dump',
    [switch]$RegisterDailyTask,
    [string]$TaskName = 'ISProject-Postgres-AutoBackup',
    [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
    [string]$TaskTime = '02:00',
    [string]$EnvFilePath = "$PSScriptRoot\..\.env",
    [switch]$RunNow,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Warning $Message
}

function Import-DotEnv {
    param([string]$Path)

    if (-not (Test-Path -Path $Path)) {
        return
    }

    $lines = Get-Content -Path $Path -ErrorAction Stop

    foreach ($line in $lines) {
        $trimmed = $line.Trim()

        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
            continue
        }

        $parts = $trimmed -split '=', 2
        if ($parts.Count -ne 2) {
            continue
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        if ([string]::IsNullOrWhiteSpace($key)) {
            continue
        }

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            if ($value.Length -ge 2) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        Set-Item -Path "Env:$key" -Value $value
    }

    Write-Info "Loaded .env values from: $Path"
}

function Apply-DbDefaultsFromEnvironment {
    if (-not $PSBoundParameters.ContainsKey('DbName') -and $env:DB_NAME) {
        $script:DbName = $env:DB_NAME
    }

    if (-not $PSBoundParameters.ContainsKey('DbUser') -and $env:DB_USER) {
        $script:DbUser = $env:DB_USER
    }

    if (-not $PSBoundParameters.ContainsKey('DbHost') -and $env:DB_HOST) {
        $script:DbHost = $env:DB_HOST
    }

    if (-not $PSBoundParameters.ContainsKey('DbPort') -and $env:DB_PORT) {
        $portValue = 0
        if ([int]::TryParse($env:DB_PORT, [ref]$portValue)) {
            $script:DbPort = $portValue
        }
    }

    if (-not $PSBoundParameters.ContainsKey('DbPassword') -and $env:DB_PASSWORD) {
        $script:DbPassword = $env:DB_PASSWORD
    }
}

function Resolve-PgDumpExecutable {
    param([string]$Candidate)

    if (Test-Path -Path $Candidate) {
        return (Resolve-Path -Path $Candidate).Path
    }

    $command = Get-Command -Name $Candidate -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    throw "Could not find 'pg_dump'. Install PostgreSQL client tools or provide -PgDumpPath with a full executable path."
}

function Ensure-BackupDirectory {
    if (-not (Test-Path -Path $BackupDirectory)) {
        if ($DryRun) {
            Write-Info "[DryRun] Would create backup directory: $BackupDirectory"
        } else {
            New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
            Write-Info "Created backup directory: $BackupDirectory"
        }
    }
}

function Compress-BackupFile {
    param([string]$SqlFilePath)

    $zipFilePath = [System.IO.Path]::ChangeExtension($SqlFilePath, '.zip')

    if ($DryRun) {
        Write-Info "[DryRun] Would compress '$SqlFilePath' -> '$zipFilePath'"
        return $zipFilePath
    }

    if (Test-Path -Path $zipFilePath) {
        Remove-Item -Path $zipFilePath -Force
    }

    Compress-Archive -Path $SqlFilePath -DestinationPath $zipFilePath -CompressionLevel Optimal
    Remove-Item -Path $SqlFilePath -Force

    return $zipFilePath
}

function Remove-OldBackups {
    $safeRetention = [Math]::Abs($RetentionDays)
    $cutoff = (Get-Date).AddDays(-1 * $safeRetention)

    $oldFiles = Get-ChildItem -Path $BackupDirectory -Filter "$DbName*.zip" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff }

    foreach ($file in $oldFiles) {
        if ($DryRun) {
            Write-Info "[DryRun] Would remove old backup: $($file.FullName)"
        } else {
            Remove-Item -Path $file.FullName -Force
            Write-Info "Removed old backup: $($file.FullName)"
        }
    }
}

function Invoke-DatabaseBackup {
    param([string]$PgDumpExe)

    Ensure-BackupDirectory

    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $sqlFilePath = Join-Path -Path $BackupDirectory -ChildPath "$DbName`_$timestamp.sql"

    $arguments = @(
        "--host=$DbHost",
        "--port=$DbPort",
        "--username=$DbUser",
        '--format=plain',
        '--encoding=UTF8',
        "--file=$sqlFilePath",
        $DbName
    )

    if (-not $env:PGPASSWORD) {
        Write-Warn "PGPASSWORD is not set. For unattended backups, set DB_PASSWORD in server/.env or PGPASSWORD in system environment."
    }

    if ($DryRun) {
        Write-Info "[DryRun] Would run backup command:"
        Write-Host "$PgDumpExe $($arguments -join ' ')"
        Write-Info "[DryRun] Would create backup file at: $sqlFilePath"
        return
    }

    Write-Info "Starting PostgreSQL backup for database '$DbName'..."
    & $PgDumpExe @arguments

    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }

    $zipFile = Compress-BackupFile -SqlFilePath $sqlFilePath
    Write-Info "Backup completed: $zipFile"

    Remove-OldBackups
}

function Register-OrUpdateBackupTask {
    param([string]$ScriptPath)

    if (-not (Get-Command -Name Register-ScheduledTask -ErrorAction SilentlyContinue)) {
        throw "Scheduled Task cmdlets are not available in this PowerShell environment."
    }

    $hours, $minutes = $TaskTime.Split(':')
    $triggerTime = (Get-Date).Date.AddHours([int]$hours).AddMinutes([int]$minutes)

    $taskArgs = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', "`"$ScriptPath`"",
        '-DbName', "`"$DbName`"",
        '-DbUser', "`"$DbUser`"",
        '-DbHost', "`"$DbHost`"",
        '-DbPort', "$DbPort",
        '-BackupDirectory', "`"$BackupDirectory`"",
        '-RetentionDays', "$RetentionDays",
        '-PgDumpPath', "`"$PgDumpPath`"",
        '-EnvFilePath', "`"$EnvFilePath`""
    ) -join ' '

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArgs
    $trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
    $userId = "$env:USERDOMAIN\$env:USERNAME"
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

    if ($DryRun) {
        Write-Info "[DryRun] Would register/update scheduled task '$TaskName' at $TaskTime for user '$userId'."
        Write-Info "[DryRun] Task action: powershell.exe $taskArgs"
        return
    }

    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    if ($null -ne $existingTask) {
        Set-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
        Write-Info "Updated scheduled task '$TaskName' (daily at $TaskTime)."
    } else {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Automated PostgreSQL backups for IS PROJECT' | Out-Null
        Write-Info "Created scheduled task '$TaskName' (daily at $TaskTime)."
    }
}

Import-DotEnv -Path $EnvFilePath
Apply-DbDefaultsFromEnvironment

if ($DbPassword) {
    $env:PGPASSWORD = $DbPassword
}

$scriptPath = $PSCommandPath
if (-not $scriptPath) {
    $scriptPath = $MyInvocation.MyCommand.Path
}

if ($RegisterDailyTask) {
    Register-OrUpdateBackupTask -ScriptPath (Resolve-Path -Path $scriptPath).Path

    if (-not $RunNow) {
        Write-Info 'Task registration complete. Use -RunNow if you also want an immediate backup.'
        return
    }
}

$pgDumpExecutable = if ($DryRun) { $PgDumpPath } else { Resolve-PgDumpExecutable -Candidate $PgDumpPath }
Invoke-DatabaseBackup -PgDumpExe $pgDumpExecutable
Write-Info 'Done.'
