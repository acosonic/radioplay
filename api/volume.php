<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$level = isset($_POST['level']) ? (int)$_POST['level'] : -1;

if ($level < 0 || $level > 150) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Level must be 0-150']);
    exit;
}

require_once __DIR__ . '/config.php';

exec('sudo -u ' . RP_MEDIA_USER . ' ' . RP_VOLUME_WRAPPER . ' ' . escapeshellarg((string)$level) . ' 2>&1', $out, $code);

echo json_encode(['ok' => $code === 0, 'level' => $level]);
