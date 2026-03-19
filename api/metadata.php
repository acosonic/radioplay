<?php
header('Content-Type: application/json');

require_once __DIR__ . '/config.php';

// Optional ?url= param for browser mode (bypasses vlcnow.json)
if (!empty($_GET['url'])) {
    $streamUrl = trim($_GET['url']);
    if (!preg_match('#^https?://#i', $streamUrl)) {
        echo json_encode(['title' => null]);
        exit;
    }
} else {
    $nowFile = RP_NOW_FILE;
    if (!file_exists($nowFile)) {
        echo json_encode(['title' => null]);
        exit;
    }

    $now = json_decode(file_get_contents($nowFile), true);
    if (!$now || ($now['type'] ?? 'radio') !== 'radio' || empty($now['url'])) {
        echo json_encode(['title' => null]);
        exit;
    }

    $streamUrl = $now['url'];
}
$title = fetchIcyTitle($streamUrl);
echo json_encode(['title' => $title]);

// ── ICY metadata fetch ──────────────────────────────────────────────────────
function fetchIcyTitle(string $url): ?string {
    $parts = parse_url($url);
    if (!$parts || empty($parts['host'])) return null;

    $scheme = strtolower($parts['scheme'] ?? 'http');
    $host   = $parts['host'];
    $port   = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);
    $path   = ($parts['path'] ?? '/') . (isset($parts['query']) ? '?' . $parts['query'] : '');

    // Connect via stream socket (supports SSL)
    $timeout  = 6;
    $transport = $scheme === 'https' ? "ssl://$host:$port" : "tcp://$host:$port";

    $errno = $errstr = null;
    $sock = @stream_socket_client($transport, $errno, $errstr, $timeout,
        STREAM_CLIENT_CONNECT,
        stream_context_create([
            'ssl' => [
                'verify_peer'       => true,
                'verify_peer_name'  => true,
                'allow_self_signed' => false,
            ],
        ])
    );
    if (!$sock) return null;

    stream_set_timeout($sock, $timeout);

    // HTTP/1.0 keeps it simple (no chunked encoding)
    $req = "GET $path HTTP/1.0\r\n"
         . "Host: $host\r\n"
         . "User-Agent: RadioPlay/1.0\r\n"
         . "Icy-MetaData: 1\r\n"
         . "Connection: close\r\n\r\n";

    fwrite($sock, $req);

    // Read response headers
    $headers = [];
    while (!feof($sock)) {
        $line = fgets($sock, 4096);
        if ($line === false) break;
        $line = rtrim($line);
        if ($line === '') break;  // blank line = end of headers
        $headers[] = $line;
    }

    // Find icy-metaint
    $metaint = null;
    foreach ($headers as $h) {
        if (stripos($h, 'icy-metaint:') === 0) {
            $metaint = (int)trim(substr($h, 12));
            break;
        }
    }

    if (!$metaint || $metaint <= 0) {
        fclose($sock);
        return null;
    }

    // Skip $metaint bytes of audio data
    $skipped = 0;
    while ($skipped < $metaint && !feof($sock)) {
        $chunk = fread($sock, min(4096, $metaint - $skipped));
        if ($chunk === false || $chunk === '') break;
        $skipped += strlen($chunk);
    }

    if ($skipped < $metaint) {
        fclose($sock);
        return null;
    }

    // Read 1 byte = metadata block length / 16
    $lenByte = fread($sock, 1);
    if ($lenByte === false || $lenByte === '') {
        fclose($sock);
        return null;
    }
    $metaLen = ord($lenByte) * 16;

    $title = null;
    if ($metaLen > 0) {
        $meta = '';
        $remaining = $metaLen;
        while ($remaining > 0 && !feof($sock)) {
            $chunk = fread($sock, $remaining);
            if ($chunk === false || $chunk === '') break;
            $meta      .= $chunk;
            $remaining -= strlen($chunk);
        }

        // Parse StreamTitle='...';
        if (preg_match("/StreamTitle='([^']*)'/", $meta, $m)) {
            $title = trim($m[1]);
            if ($title === '') $title = null;
        }
    }

    fclose($sock);
    return $title;
}
