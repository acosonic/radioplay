<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/_kill_vlc.php';
killVlc();

@unlink(RP_NOW_FILE);
@unlink(RP_PID_FILE);

echo json_encode(['ok' => true]);
