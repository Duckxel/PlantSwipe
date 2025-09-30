## Production deployment (build mode)

This app is a Vite + React SPA with an optional Express API served by `server.js`.

Two supported deployment modes:

- Static-only: Serve `dist/` via nginx (no Node.js required). Only use this if you don't need the `/api/*` endpoints.
- Node-backed: Run `server.js` (serves both the API and the built SPA). Fronted by nginx.

### 1) Prerequisites on the server

- Ubuntu/Debian with `sudo`
- SSH access
- `curl`, `git`, `ufw`, `nginx`
- Node.js LTS (20+ recommended)

### 2) One-time server provisioning (Node-backed mode)

1. Create user and basic firewall (optional):
```bash
sudo adduser deployer --disabled-password --gecos ""
sudo usermod -aG sudo deployer
sudo ufw allow OpenSSH; sudo ufw allow 'Nginx Full'; sudo ufw enable
```

2. Install Node.js and PM2:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
sudo npm i -g pm2
```

3. Configure nginx (reverse proxy to Node):
Put an nginx server block at `/etc/nginx/sites-available/plant-swipe` based on `nginx.plant-swipe.conf` in this folder, then enable it:
```bash
sudo ln -sf /etc/nginx/sites-available/plant-swipe /etc/nginx/sites-enabled/plant-swipe
sudo nginx -t && sudo systemctl reload nginx
```

### 3) Deploy

On your local machine run:
```bash
cd plant-swipe
npm ci
npm run build
```

Then sync the build and start/restart the service:
```bash
rsync -avz --delete ./dist/ <user>@<host>:/var/www/plant-swipe/dist/
rsync -avz --delete ./server.js package.json package-lock.json <user>@<host>:/var/www/plant-swipe/
ssh <user>@<host> 'cd /var/www/plant-swipe && npm ci --omit=dev && pm2 startOrReload ecosystem.config.cjs --update-env'
```

Alternatively, use the helper script `deploy.sh`.

### 4) Environment variables

See `.env.example` for required variables. Place `.env` at `/var/www/plant-swipe/.env`.

### Static-only mode

If you don't need the Express API:
```bash
npm run build
rsync -avz --delete ./dist/ <user>@<host>:/var/www/plant-swipe/
```
Use the nginx `root` to point to `/var/www/plant-swipe` and remove proxy settings.

