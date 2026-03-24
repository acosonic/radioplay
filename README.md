# 📻 RadioPlay

A self-hosted web radio & YouTube audio player. Searches 30 000+ stations via the [Radio Browser API](https://www.radio-browser.info/) and supports two distinct playback modes.

> Inspired by [RompR](https://fatg3erman.github.io/RompR/) — a great self-hosted music player for MPD/Mopidy.

---

## Two Playback Modes

RadioPlay can play audio in two ways, switchable at any time via the **🖥 Server / 🔊 Browser** toggle in the header.

### 🔊 Browser Mode (no server setup required)

Audio streams **directly in your browser** using the HTML5 `<audio>` element. The server acts only as a PHP backend for searching stations and fetching ICY metadata — it plays no audio itself.

- Works out of the box on any web host with PHP
- No VLC, no PipeWire, no sudo rules needed
- Volume is local to your browser tab (0–100%)
- Ideal for remote / guest listening from any device

### 🖥 Server Mode (VLC on the server)

Audio plays through **VLC on the server machine** — through its speakers or headphones. The browser is just a remote control.

- Requires VLC, PipeWire/WirePlumber, and sudo configuration (see Installation)
- Volume controls the server's system audio output (supports 0–150%)
- Ideal for home server / local listening setups

The selected mode is remembered across page reloads (`localStorage`).

---

## Real-world Use Cases

### ☕ Café / Bar background music

This is where Server Mode shines. Place a small Linux box (Raspberry Pi, old laptop, mini-PC) behind the counter connected to your sound system. Install RadioPlay and point a browser at it.

**Now anyone on the Wi-Fi can control the music from their phone:**

1. Connect to the venue's Wi-Fi
2. Open `http://192.168.x.x/radioplay` in a mobile browser
3. Search for a station — jazz, lounge, chill, whatever fits the mood
4. Tap **Play** — music starts playing through the venue's speakers instantly
5. Adjust volume, switch stations, or play a YouTube set — all without touching the server

No app to install. No accounts. No cable. The server keeps playing even after the phone's browser is closed — the stream runs on the machine itself via VLC.

> Staff can switch the music between lunch and evening hours with two taps. Guests can suggest a track via YouTube. The morning playlist and the late-night vibe are just a search away.

### 🏠 Home server

Same idea at home — run RadioPlay on a NAS, home server, or always-on Raspberry Pi connected to a hi-fi or Bluetooth speaker. Control it from your phone or any browser on the network without needing to walk to the machine.

---

## Screenshots

**Search results** — dark mode, station grid with bitrate, genre tags, country flags and live status indicators:

![Search results](docs/screenshot-search.png)

**Home screen** — Browse by Genre, Favorites, and History panels. Player bar shows live ICY metadata (now-playing song title from the stream):

![Home screen with player bar](docs/screenshot-home.png)

---

## Features

- Search radio stations by name, genre, country, bitrate
- **Browser mode** — HTML5 audio playback, zero server-side audio dependencies
- **Server mode** — VLC server-side playback with system volume control
- Live ICY metadata — song/artist titles from the stream (both modes)
- YouTube audio playback via yt-dlp (both modes)
- Favorites and history (browser localStorage — no database needed)
- Dark / light theme (light by default)
- Responsive mobile-friendly grid
- **🔧 Test button** — built-in diagnostics that check all required dependencies for the active playback mode

---

## Requirements

### Browser Mode (minimal)

| Dependency | Notes |
|---|---|
| PHP 8.1+ | With `curl` extension |
| Apache / nginx | With PHP-FPM or mod_php |
| yt-dlp | Optional — only for YouTube support |

### Server Mode (additional)

| Dependency | Notes |
|---|---|
| VLC (`cvlc`) | `sudo apt install vlc` |
| PipeWire + WirePlumber | Running as your audio user |
| sudo | For `www-data` to launch VLC as audio user |

---

## Installation

### 1. Clone the app

```bash
git clone https://github.com/acosonic/radioplay.git /var/www/html/radioplay
```

### 2. Configure the app

```bash
cp api/config.example.php api/config.php
nano api/config.php
```

For **Browser Mode** you only need to set the base paths (defaults are fine for most setups).

For **Server Mode** also set `RP_MEDIA_USER` to the Linux user that runs your audio session (PipeWire/PulseAudio).

### 3. Install yt-dlp (optional, for YouTube support)

```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
     -o /usr/local/bin/yt-dlp
sudo chmod 755 /usr/local/bin/yt-dlp
```

Update `RP_YTDLP_PATH` in `api/config.php` if you install it elsewhere.

**This is all you need for Browser Mode.** Skip to step 7 (web server config) if you only want browser-side playback.

---

### Server Mode — additional setup

#### 4. Create the wrapper scripts

RadioPlay's PHP backend (running as `www-data`) needs to launch VLC and control volume as your audio user. Two small wrapper scripts handle this.

```bash
# Find your audio user's UID
id youruser   # e.g. uid=1000

cp install/radioplay-vlc.sh /tmp/radioplay-vlc
sed -i 's/MEDIA_USER/youruser/g; s/MEDIA_UID/1000/g' /tmp/radioplay-vlc
sudo cp /tmp/radioplay-vlc /usr/local/bin/radioplay-vlc
sudo chmod 755 /usr/local/bin/radioplay-vlc

cp install/radioplay-volume.sh /tmp/radioplay-volume
sed -i 's/MEDIA_UID/1000/g' /tmp/radioplay-volume
sudo cp /tmp/radioplay-volume /usr/local/bin/radioplay-volume
sudo chmod 755 /usr/local/bin/radioplay-volume
```

#### 5. Configure sudo

```bash
sudo cp install/sudoers.example /etc/sudoers.d/radioplay
sudo chmod 440 /etc/sudoers.d/radioplay
sudo sed -i 's/MEDIA_USER/youruser/g' /etc/sudoers.d/radioplay
sudo visudo -c
```

This allows `www-data` to run the two wrappers and `pkill` as your audio user without a password.

#### 6. Verify Server Mode

```bash
sudo -u www-data sudo -u youruser /usr/local/bin/radioplay-vlc --version
```

---

### 7. Web server

**Apache:**

```apache
<VirtualHost *:80>
    ServerName radio.yourdomain.com
    DocumentRoot /var/www/html/radioplay
    <Directory /var/www/html/radioplay>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

**nginx + PHP-FPM:**

```nginx
server {
    listen 80;
    server_name radio.yourdomain.com;
    root /var/www/html/radioplay;
    index index.html;

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

---

## Architecture

```
radioplay/
├── index.html          # Single-page app shell
├── css/style.css       # Dark glassmorphism + light theme
├── js/app.js           # Vanilla JS: search, play, status polling, ICY metadata
├── api/
│   ├── config.php      # ← Your local config (git-ignored)
│   ├── config.example.php
│   ├── search.php      # Proxy to Radio Browser API
│   ├── play.php        # Kill old VLC, start new stream (server mode)
│   ├── stop.php        # Kill VLC (server mode)
│   ├── status.php      # Is VLC alive? What's playing? (server mode)
│   ├── metadata.php    # Fetch ICY StreamTitle from stream (both modes)
│   ├── volume.php      # wpctl volume control (server mode)
│   ├── youtube.php     # yt-dlp → VLC or → streamUrl (both modes)
│   ├── test.php        # Diagnostics endpoint (server mode checks)
│   └── _kill_vlc.php   # Process kill helpers (internal)
├── install/
│   ├── radioplay-vlc.sh      # VLC wrapper template (server mode)
│   ├── radioplay-volume.sh   # Volume wrapper template (server mode)
│   └── sudoers.example       # sudo rules template (server mode)
└── .gitignore
```

## How it works

### Browser Mode
1. **Search** — PHP proxies queries to Radio Browser API.
2. **Play** — JS sets `<audio>.src = streamUrl` and calls `.play()` directly in the browser.
3. **ICY Metadata** — `metadata.php?url=<stream>` opens a raw TCP socket to the stream server-side and parses `StreamTitle`, returning it as JSON. Polled every 25 seconds.
4. **YouTube** — `youtube.php` runs `yt-dlp -g` to extract the direct audio URL and returns it as `streamUrl`; the browser plays it via `<audio>`.
5. **Volume** — `audioEl.volume` (0–1), controlled by the slider (max 100%).

### Server Mode
1. **Search** — same as above.
2. **Play** — PHP kills any existing VLC process, writes `/tmp/vlcnow.json`, then runs `sudo -u MEDIA_USER radioplay-vlc --no-video --quiet <url>` in the background.
3. **Status** — polling checks that the PID is still alive via `posix_kill($pid, 0)`.
4. **ICY Metadata** — same TCP socket approach, but reads the URL from `/tmp/vlcnow.json`.
5. **Volume** — `wpctl set-volume` targets the VLC node by PID in the PipeWire graph.
6. **YouTube** — `yt-dlp -g` extracts the direct audio URL, passed to VLC.

---

## Troubleshooting

**No audio in Browser Mode**
- Check browser console for CORS or mixed-content errors
- Some streams require HTTPS — try a different station
- AAC/HLS streams play fine; some exotic codecs may not be supported by the browser

**No audio in Server Mode after clicking Play**
- Check PipeWire is running: `systemctl --user status pipewire` (as your audio user)
- Check VLC is launching: `cat /tmp/vlcplay.log`
- Verify sudo works: `sudo -u www-data sudo -u youruser /usr/local/bin/radioplay-vlc --version`

**YouTube error "Failed to extract stream URL"**
- Update yt-dlp: `sudo yt-dlp -U` or re-download the binary
- Test manually: `yt-dlp -g --format 'bestaudio/best' 'https://youtube.com/watch?v=...'`

**ICY metadata not showing**
- Many AAC/HLS streams don't support ICY metadata — this is expected
- Icecast and classic Shoutcast streams (MP3) support it

**stop.php returns 500 (Server Mode)**
- PHP needs the `posix` extension: `php -m | grep posix`

---

## License

MIT
