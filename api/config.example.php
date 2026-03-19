<?php
// ── RadioPlay Configuration ───────────────────────────────────────────────
// Copy this file to config.php and adjust to your environment.

// Linux user that owns the PipeWire/audio session and will run VLC
define('RP_MEDIA_USER',     'youruser');

// Absolute paths to the two sudo wrapper scripts (see install/ directory)
define('RP_VLC_WRAPPER',    '/usr/local/bin/radioplay-vlc');
define('RP_VOLUME_WRAPPER', '/usr/local/bin/radioplay-volume');

// yt-dlp binary (falls back to 'which yt-dlp' when not found here)
define('RP_YTDLP_PATH',     '/usr/local/bin/yt-dlp');

// pkill binary
define('RP_PKILL_PATH',     '/usr/bin/pkill');

// Runtime temp files (must be writable by the web server user, e.g. www-data)
define('RP_NOW_FILE', '/tmp/vlcnow.json');
define('RP_PID_FILE', '/tmp/vlcplay.pid');
define('RP_LOG_FILE', '/tmp/vlcplay.log');
