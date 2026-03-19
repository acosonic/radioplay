#!/bin/bash
# Wrapper script for volume control via WirePlumber/PipeWire.
# Must run as MEDIA_USER (the user that owns the PipeWire session).
#
# Replace MEDIA_UID with your value, then:
#   sudo cp radioplay-volume.sh /usr/local/bin/radioplay-volume
#   sudo chmod 755 /usr/local/bin/radioplay-volume

# Usage: radioplay-volume <0-150>
export XDG_RUNTIME_DIR=/run/user/MEDIA_UID
VOL=$1
if ! [[ "$VOL" =~ ^[0-9]+$ ]] || [ "$VOL" -gt 150 ]; then
    exit 1
fi

# PID_FILE must match RP_PID_FILE in api/config.php
PID_FILE=/tmp/vlcplay.pid

# Try to find VLC node by PID for per-app volume control
PID=$(cat "$PID_FILE" 2>/dev/null | tr -d '[:space:]')
NODE=""
if [ -n "$PID" ]; then
    NODE=$(wpctl status 2>/dev/null | grep "VLC.*pid:${PID}" | awk '{print $1}' | tr -d '.')
fi

if [ -n "$NODE" ] && [ "$NODE" -gt 0 ] 2>/dev/null; then
    wpctl set-volume "$NODE" "${VOL}%"
else
    wpctl set-volume @DEFAULT_AUDIO_SINK@ "${VOL}%"
fi
