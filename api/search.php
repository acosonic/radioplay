<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Validate and sanitize inputs
$q          = isset($_GET['q'])          ? trim(substr($_GET['q'], 0, 200))       : '';
$tag        = isset($_GET['tag'])        ? trim(substr($_GET['tag'], 0, 100))     : '';
$country    = isset($_GET['country'])    ? trim(substr($_GET['country'], 0, 10))  : '';
$language   = isset($_GET['language'])   ? trim(substr($_GET['language'], 0, 50)) : '';
$limit      = isset($_GET['limit'])      ? (int)$_GET['limit']                    : 30;
$bitrateMin = isset($_GET['bitrateMin']) ? (int)$_GET['bitrateMin']               : 0;

// Clamp limit
$limit = max(1, min(200, $limit));

// Build Radio Browser API query
$params = [
    'name'         => $q,
    'tag'          => $tag,
    'countrycode'  => $country,
    'language'     => $language,
    'limit'        => $limit,
    'hidebroken'   => 'true',
    'order'        => 'votes',
    'reverse'      => 'true',
    'bitrateMin'   => $bitrateMin > 0 ? $bitrateMin : '',
];

// Remove empty params
$params = array_filter($params, fn($v) => $v !== '' && $v !== 0);

$url = 'https://all.api.radio-browser.info/json/stations/search?' . http_build_query($params);

$context = stream_context_create([
    'http' => [
        'method'  => 'GET',
        'timeout' => 10,
        'header'  => "User-Agent: RadioPlay/1.0\r\n",
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ],
]);

$response = @file_get_contents($url, false, $context);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to reach Radio Browser API']);
    exit;
}

$data = json_decode($response, true);
if (!is_array($data)) {
    http_response_code(502);
    echo json_encode(['error' => 'Invalid response from Radio Browser API']);
    exit;
}

// Return only needed fields
$result = array_map(function($s) {
    return [
        'stationuuid' => $s['stationuuid'] ?? '',
        'name'        => $s['name']        ?? '',
        'url'         => $s['url_resolved'] ?? $s['url'] ?? '',
        'favicon'     => $s['favicon']     ?? '',
        'tags'        => $s['tags']        ?? '',
        'country'     => $s['country']     ?? '',
        'countrycode' => $s['countrycode'] ?? '',
        'bitrate'     => (int)($s['bitrate'] ?? 0),
        'codec'       => $s['codec']       ?? '',
        'votes'       => (int)($s['votes'] ?? 0),
        'language'    => $s['language']    ?? '',
        'lastcheckok' => (int)($s['lastcheckok'] ?? 0),
    ];
}, $data);

echo json_encode($result);
