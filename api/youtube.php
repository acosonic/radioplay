<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$url  = isset($_POST['url'])  ? trim($_POST['url'])  : '';
$mode = isset($_POST['mode']) ? trim($_POST['mode']) : 'server';

if (!preg_match('#^https?://(www\.)?(youtube\.com|youtu\.be)/#i', $url)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Not a valid YouTube URL']);
    exit;
}

require_once __DIR__ . '/config.php';

$ytdlp = file_exists(RP_YTDLP_PATH) ? RP_YTDLP_PATH : trim(shell_exec('which yt-dlp 2>/dev/null'));
if (empty($ytdlp)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'yt-dlp not installed']);
    exit;
}

$safeUrl = escapeshellarg($url);

$streamUrl = trim(shell_exec("$ytdlp -g --no-playlist --format 'bestaudio/best' $safeUrl 2>/dev/null"));
if (empty($streamUrl) || !preg_match('#^https?://#i', $streamUrl)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to extract stream URL from YouTube']);
    exit;
}

$title = trim(shell_exec("$ytdlp --get-title --no-playlist $safeUrl 2>/dev/null"));
if (empty($title)) $title = 'YouTube Audio';
$title       = substr($title, 0, 150);
$displayName = 'YouTube: ' . $title;

if ($mode === 'browser') {
    echo json_encode(['ok' => true, 'name' => $displayName, 'streamUrl' => $streamUrl]);
    exit;
}

require_once __DIR__ . '/_kill_vlc.php';
killVlc();

$nowFile = RP_NOW_FILE;
$pidFile = RP_PID_FILE;
$logFile = RP_LOG_FILE;

file_put_contents($nowFile, json_encode([
    'name'       => $displayName,
    'url'        => $url,
    'favicon'    => '',
    'type'       => 'youtube',
    'started_at' => time(),
]));

$safeStream = escapeshellarg($streamUrl);
$cmd = "sudo -u " . RP_MEDIA_USER . " " . RP_VLC_WRAPPER . " --no-video --quiet $safeStream > " . escapeshellarg($logFile) . " 2>&1 & echo \$!";
$pid = trim(shell_exec($cmd));

if (!is_numeric($pid) || (int)$pid <= 0) {
    @unlink($nowFile);
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to start VLC']);
    exit;
}

file_put_contents($pidFile, $pid);

echo json_encode(['ok' => true, 'name' => $displayName]);
