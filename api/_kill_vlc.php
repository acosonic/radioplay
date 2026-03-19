<?php
require_once __DIR__ . '/config.php';

// Kill running VLC: first by saved PID, then by user+process name
function killVlc(): void {
    $pidFile = RP_PID_FILE;
    $user    = RP_MEDIA_USER;
    $pkill   = RP_PKILL_PATH;

    // Kill the specific PID if we have one
    if (file_exists($pidFile)) {
        $pid = (int)trim(file_get_contents($pidFile));
        if ($pid > 0) {
            // Kill the vlc process and its sudo parent
            exec("sudo -u $user $pkill -TERM -P $pid 2>/dev/null");
            exec("sudo -u $user $pkill -TERM -g $pid 2>/dev/null");
            posix_kill($pid, 15);
        }
    }

    // Catch-all: kill all vlc processes owned by the media user
    exec("sudo -u $user $pkill -u $user -x vlc 2>/dev/null");
    // Kill any leftover radioplay-vlc sudo wrappers
    exec("$pkill -f radioplay-vlc 2>/dev/null");

    usleep(600000); // 0.6s for process to die
}
