param(
    [string]$Topic,
    [string]$Workspace = "",
    [string]$Include = "",
    [int]$Timeout = 600,
    [string]$ApiUrl = "http://localhost:8080",
    [string]$ApiKey = "local-dev-key"
)

Write-Host "Starting async OpenBotMan discussion..."
Write-Host "Topic: $Topic"

# Build request body
$body = @{
    topic = $Topic
    async = $true
    timeout = 120
    agents = 3
}

if ($Workspace) {
    $body.workspace = $Workspace
    if ($Include) {
        $body.include = $Include -split ','
    }
}

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
}

# Start job
try {
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/discuss" -Method POST -Headers $headers -Body ($body | ConvertTo-Json)
    $jobId = $response.id
    Write-Host "Job started: $jobId"
} catch {
    Write-Host "ERROR: Failed to start job: $_"
    exit 1
}

# Poll for results
$startTime = Get-Date
$pollInterval = 5

while ($true) {
    Start-Sleep -Seconds $pollInterval
    
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    if ($elapsed -gt $Timeout) {
        Write-Host "ERROR: Timeout after $Timeout seconds"
        exit 1
    }
    
    try {
        $status = Invoke-RestMethod -Uri "$ApiUrl/api/v1/jobs/$jobId" -Headers $headers
        
        Write-Host "Status: $($status.status) (${elapsed}s elapsed)"
        
        if ($status.status -eq "complete") {
            Write-Host "`n=== RESULT ===" 
            Write-Host $status.result
            if ($status.actionItems -and $status.actionItems.Count -gt 0) {
                Write-Host "`n=== ACTION ITEMS ==="
                $status.actionItems | ForEach-Object { Write-Host "- $_" }
            }
            exit 0
        }
        elseif ($status.status -eq "error") {
            Write-Host "ERROR: $($status.error)"
            exit 1
        }
    } catch {
        Write-Host "Warning: Poll failed, retrying..."
    }
}
