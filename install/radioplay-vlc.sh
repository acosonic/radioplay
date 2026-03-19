#!/bin/bash
# Wrapper script that lets www-data launch VLC as MEDIA_USER
# with the correct home and PipeWire runtime directory.
#
# Replace MEDIA_USER and MEDIA_UID with your values, then:
#   sudo cp radioplay-vlc.sh /usr/local/bin/radioplay-vlc
#   sudo chmod 755 /usr/local/bin/radioplay-vlc

export HOME=/home/MEDIA_USER
export XDG_RUNTIME_DIR=/run/user/MEDIA_UID
exec /usr/bin/cvlc "$@"
