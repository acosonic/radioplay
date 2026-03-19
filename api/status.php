<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/config.php';

$nowFile = RP_NOW_FILE;
$pidFile = RP_PID_FILE;

if (!file_exists($nowFile)) {
    echo json_encode(['playing' => false]);
    exit;
}

$data = json_decode(file_get_contents($nowFile), true);
if (!is_array($data)) {
    echo json_encode(['playing' => false]);
    exit;
}

// Check if VLC process is still alive
$alive = false;
if (file_exists($pidFile)) {
    $pid = (int)trim(file_get_contents($pidFile));
    if ($pid > 0) {
        $alive = posix_kill($pid, 0);
    }
}

if (!$alive) {
    // Process died – clean up
    @unlink($nowFile);
    @unlink($pidFile);
    echo json_encode(['playing' => false]);
    exit;
}

echo json_encode([
    'playing'    => true,
    'name'       => $data['name']       ?? '',
    'url'        => $data['url']        ?? '',
    'favicon'    => $data['favicon']    ?? '',
    'type'       => $data['type']       ?? 'radio',
    'started_at' => (int)($data['started_at'] ?? 0),
]);
