# [ Website Name ] — Hospital Management System

A lightweight, LAN-only hospital management platform designed to run entirely on a **Raspberry Pi 3B+** inside a medical facility — no internet connection required.

---

## Features

| Module | Views |
|---|---|
| **[ Patient Intake & Records Module ]** | Patient Search, Registration Form, Clinical Notes Timeline |
| **[ Inventory & Pharmacy Module ]** | Stock Ledger, Low Inventory Alert Dashboard |
| **[ Clinical Queue & Scheduling Module ]** | Triage Priority Queue, Staff Duty Roster |
| **[ Offline Documentation & Resource Module ]** | Document Library Browser, Calculator Interface |

---

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite (via `sqlite3` npm package — works on Node 18+)
- **Frontend:** Plain HTML5 / Vanilla CSS3 / Vanilla JavaScript — no build step
- **Session:** `express-session` (in-process, no Redis needed)
- **Deployment target:** Raspberry Pi 3B+ on a local area network (LAN)

---

## Running on Raspberry Pi

### Step 1 — Flash and boot the Pi

Flash **Raspberry Pi OS Lite** (64-bit) to your SD card using Raspberry Pi Imager. Boot, connect to your local network via Ethernet or Wi-Fi.

### Step 2 — Set a static IP address

On the Pi, edit `/etc/dhcpcd.conf`:

```bash
sudo nano /etc/dhcpcd.conf
```

Add at the bottom (adjust to your network):

```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1
```

Reboot: `sudo reboot`

### Step 3 — Install Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v18.x.x
```

### Step 4 — Install build tools (required for sqlite3)

```bash
sudo apt-get install -y build-essential python3
```

### Step 5 — Clone the repository

```bash
cd ~
git clone https://github.com/sidtr09/hospital-pi-system.git
cd hospital-pi-system
```

### Step 6 — Install dependencies

```bash
npm install
```

### Step 7 — Start the server

```bash
npm start
```

You should see:

```
[DB] Schema applied successfully
[DB] Connected: .../database/hospital.db
[ Website Name ] running on http://0.0.0.0:3000
```

### Step 8 — Access from any device on the LAN

Open a browser on any phone, tablet, or computer connected to the same network and go to:

```
http://192.168.1.100:3000
```

Replace `192.168.1.100` with the static IP you set in Step 2.

---

## Demo Login Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Administrator |
| `doctor` | `doctor123` | Doctor |
| `nurse` | `nurse123` | Nurse |

> Replace these with a proper hashed user table before clinical use.

---

## Run on Boot (Auto-start)

To have the server start automatically when the Pi powers on:

```bash
sudo nano /etc/systemd/system/hospital.service
```

Paste:

```ini
[Unit]
Description=[ Website Name ] Hospital Management System
After=network.target

[Service]
ExecStart=/usr/bin/node /home/pi/hospital-pi-system/server.js
WorkingDirectory=/home/pi/hospital-pi-system
Restart=always
User=pi
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable hospital
sudo systemctl start hospital
sudo systemctl status hospital
```

---

## Updating the App

When a new version is pushed to GitHub, pull and restart on the Pi:

```bash
cd ~/hospital-pi-system
git pull
npm install
sudo systemctl restart hospital
```

---

## Daily Database Backup

Set up an automatic nightly backup to a USB drive:

```bash
crontab -e
```

Add:

```
0 2 * * * bash /home/pi/hospital-pi-system/backup/backup.sh >> /home/pi/hospital-pi-system/logs/backup.log 2>&1
```

Backups are stored in `backup/` and automatically pruned after 7 days.

---

## API Health Check

```
http://192.168.1.100:3000/api/health
```

Returns server uptime, RAM usage, and database connection status — useful for monitoring the Pi without SSH.

---

## Offline Operation

The system is designed for **100% offline use**. Once installed, no internet connection is needed. All assets, data, and logic are served from the Pi itself over the local network.
