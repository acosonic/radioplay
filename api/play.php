<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$url     = isset($_POST['url'])     ? trim($_POST['url'])     : '';
$name    = isset($_POST['name'])    ? trim($_POST['name'])    : 'Unknown Station';
$favicon = isset($_POST['favicon']) ? trim($_POST['favicon']) : '';

if (!preg_match('#^https?://#i', $url)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid URL']);
    exit;
}

$name    = substr(preg_replace('/[^\x20-\x7E\x80-\xFF]/', '', $name), 0, 200);
$favicon = preg_match('#^https?://#i', $favicon) ? $favicon : '';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/_kill_vlc.php';
killVlc();

$nowFile = RP_NOW_FILE;
$pidFile = RP_PID_FILE;
$logFile = RP_LOG_FILE;

file_put_contents($nowFile, json_encode([
    'name'       => $name,
    'url'        => $url,
    'favicon'    => $favicon,
    'type'       => 'radio',
    'started_at' => time(),
]));

$safeUrl = escapeshellarg($url);
$cmd = "sudo -u " . RP_MEDIA_USER . " " . RP_VLC_WRAPPER . " --no-video --quiet $safeUrl > " . escapeshellarg($logFile) . " 2>&1 & echo \$!";
$pid = trim(shell_exec($cmd));

if (!is_numeric($pid) || (int)$pid <= 0) {
    @unlink($nowFile);
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Failed to start VLC']);
    exit;
}

file_put_contents($pidFile, $pid);

echo json_encode(['ok' => true, 'name' => $name, 'pid' => (int)$pid]);
