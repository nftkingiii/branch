param(
  [string]$Source = "C:\Users\HP\Downloads\branch vid 1.mp4",
  [string]$Output = "outputs\branch-demo-final.mp4"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$workDir = Join-Path $projectRoot "work\demo-render"
$outputPath = Join-Path $projectRoot $Output
$assPath = Join-Path $PSScriptRoot "branch-demo.ass"

New-Item -ItemType Directory -Force -Path $workDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath) | Out-Null

if (-not (Test-Path -LiteralPath $Source)) { throw "Source video not found: $Source" }

$introFrame = Join-Path $workDir "intro.png"
$outroFrame = Join-Path $workDir "outro.png"
$introVideo = Join-Path $workDir "intro.mp4"
$mainVideo = Join-Path $workDir "main.mp4"
$outroVideo = Join-Path $workDir "outro.mp4"
$silentVideo = Join-Path $workDir "silent.mp4"
$concatFile = Join-Path $workDir "concat.txt"

& ffmpeg -y -hide_banner -loglevel error -ss 0 -i $Source -frames:v 1 -vf "scale=1920:1080,gblur=sigma=22,eq=brightness=-0.47:saturation=0.62" $introFrame
& ffmpeg -y -hide_banner -loglevel error -ss 15 -i $Source -frames:v 1 -vf "scale=1920:1080,gblur=sigma=22,eq=brightness=-0.5:saturation=0.62" $outroFrame
& ffmpeg -y -hide_banner -loglevel error -loop 1 -i $introFrame -t 5 -r 30 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p $introVideo
& ffmpeg -y -hide_banner -loglevel error -i $Source -vf "scale=1920:1080:flags=lanczos" -r 30 -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p $mainVideo
& ffmpeg -y -hide_banner -loglevel error -loop 1 -i $outroFrame -t 7.5 -r 30 -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p $outroVideo

$concatLines = @(
  "file '$($introVideo.Replace("'", "''"))'",
  "file '$($mainVideo.Replace("'", "''"))'",
  "file '$($outroVideo.Replace("'", "''"))'"
)
Set-Content -LiteralPath $concatFile -Value $concatLines -Encoding ascii
& ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $concatFile -c copy $silentVideo

$segments = @(
  @{ start = 0; rate = -1; text = "Branch. Trade the path, not one candle." },
  @{ start = 6000; rate = 0; text = "Prediction markets normally ask for one isolated call. Branch lets a trader express a sequence: continue only while each earlier market settles exactly as expected." },
  @{ start = 22000; rate = 0; text = "The trader chooses Bitcoin or Ethereum, a market window, test collateral, a maximum entry probability, and an expected outcome for every leg. Only the first live contract is bound now. Later legs remain conditional." },
  @{ start = 43000; rate = 0; text = "Before a wallet prompt, Branch refreshes the market generation and verifies its on-chain status, expiry, price grid, lot size, and side-specific liquidity. The order is locally signed and submitted directly to Dream DEX on Somnia Shannon testnet." },
  @{ start = 62000; rate = 1; text = "Positions are monitored through on-chain lifecycle reads. In this verified run, leg one predicted down, settled down, and was redeemed. That match unlocked a freshly bound second market. Leg two predicted up, but settled down, so Branch stopped the path instead of continuing." },
  @{ start = 87000; rate = 0; text = "Recent fills preserve the exact execution history. Closed positions remain visible after redemption, with realized profit or loss and direct transaction evidence. Branch never infers settlement from a stale indexer label." },
  @{ start = 109000; rate = 1; text = "This is a real two-leg Dream DEX path: one matched settlement, one continuation, then a hard stop. Branch turns binary Event Contracts into a non-custodial conditional trading primitive." }
)

$audioInputs = @()
$delayFilters = @()
$voice = New-Object -ComObject SAPI.SpVoice
$voice.Voice = $voice.GetVoices() | Where-Object { $_.GetDescription() -like "Microsoft Zira*" } | Select-Object -First 1
$format = New-Object -ComObject SAPI.SpAudioFormat
$format.Type = 22

for ($i = 0; $i -lt $segments.Count; $i++) {
  $wav = Join-Path $workDir ("voice-{0}.wav" -f $i)
  $stream = New-Object -ComObject SAPI.SpFileStream
  $stream.Format = $format
  $stream.Open($wav, 3, $false)
  $voice.AudioOutputStream = $stream
  $voice.Rate = $segments[$i].rate
  $voice.Volume = 100
  [void]$voice.Speak($segments[$i].text)
  $stream.Close()
  $audioInputs += @("-i", $wav)
  $delay = $segments[$i].start
  $delayFilters += "[$($i + 1):a]adelay=$delay|$delay,volume=1.0[a$i]"
}

$mixInputs = (0..($segments.Count - 1) | ForEach-Object { "[a$_]" }) -join ""
$audioFilter = (($delayFilters -join ";") + ";${mixInputs}amix=inputs=$($segments.Count):duration=longest:normalize=0,alimiter=limit=0.95[aout]")
$escapedAss = $assPath.Replace("\", "/").Replace(":", "\:")

& ffmpeg -y -hide_banner -loglevel error -i $silentVideo @audioInputs -filter_complex "$audioFilter" -map 0:v -map "[aout]" -vf "ass='$escapedAss'" -c:v libx264 -preset medium -crf 18 -profile:v high -level 4.1 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest $outputPath

[System.Runtime.Interopservices.Marshal]::ReleaseComObject($voice) | Out-Null
Write-Output $outputPath
