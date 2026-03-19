<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$tests = [];

function t(string $label, bool $ok, string $detail = ''): array {
    return ['label' => $label, 'ok' => $ok, 'detail' => $detail];
}

// Config file
$configLoaded = false;
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
    $configLoaded = true;
}
$tests[] = t('config.php loaded', $configLoaded);

// PHP extensions
foreach (['posix', 'json', 'pdo', 'pdo_sqlite'] as $ext) {
    $tests[] = t("PHP ext: $ext", extension_loaded($ext));
}

if ($configLoaded) {
    // VLC wrapper
    $vlc = defined('RP_VLC_WRAPPER') ? RP_VLC_WRAPPER : '';
    $tests[] = t('VLC wrapper exists', $vlc !== '' && file_exists($vlc), $vlc ?: 'RP_VLC_WRAPPER not defined');

    if ($vlc && file_exists($vlc)) {
        $tests[] = t('VLC wrapper executable', is_executable($vlc));
    }

    // Volume wrapper
    $vol = defined('RP_VOLUME_WRAPPER') ? RP_VOLUME_WRAPPER : '';
    $tests[] = t('Volume wrapper exists', $vol !== '' && file_exists($vol), $vol ?: 'RP_VOLUME_WRAPPER not defined');

    if ($vol && file_exists($vol)) {
        $tests[] = t('Volume wrapper executable', is_executable($vol));
    }

    // yt-dlp
    $ytdlp = defined('RP_YTDLP_PATH') ? RP_YTDLP_PATH : '/usr/local/bin/yt-dlp';
    $tests[] = t('yt-dlp exists', file_exists($ytdlp), $ytdlp);
    if (file_exists($ytdlp)) {
        $ver = shell_exec(escapeshellcmd($ytdlp) . ' --version 2>&1');
        $tests[] = t('yt-dlp runs', $ver !== null && trim($ver) !== '', $ver ? trim($ver) : 'no output');
    }

    // PID file directory writable
    $pidFile = defined('RP_PID_FILE') ? RP_PID_FILE : '';
    if ($pidFile) {
        $pidDir = dirname($pidFile);
        $tests[] = t('PID file dir writable', is_writable($pidDir), $pidDir);
    }

    // Log file directory writable
    $logFile = defined('RP_LOG_FILE') ? RP_LOG_FILE : '';
    if ($logFile) {
        $logDir = dirname($logFile);
        $tests[] = t('Log file dir writable', is_writable($logDir), $logDir);
    }

    // NOW file directory writable
    $nowFile = defined('RP_NOW_FILE') ? RP_NOW_FILE : '';
    if ($nowFile) {
        $nowDir = dirname($nowFile);
        $tests[] = t('Now-file dir writable', is_writable($nowDir), $nowDir);
    }
}

// Radio Browser API reachable from server
$ctx = stream_context_create(['http' => ['timeout' => 6, 'method' => 'GET',
    'header' => "User-Agent: RadioPlay/1.0\r\n"]]);
$rb = @file_get_contents('https://all.api.radio-browser.info/json/stats', false, $ctx);
$tests[] = t('Radio Browser API reachable (server)', $rb !== false,
    $rb !== false ? 'OK' : 'Could not connect');

echo json_encode(['ok' => true, 'tests' => $tests]);
