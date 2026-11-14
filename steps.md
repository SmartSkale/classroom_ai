# Deploy ClassroomAI on AWS EC2 — step by step

This guide puts the whole app on one Amazon EC2 server:

- **Nginx** serves the website and passes `/api` requests to the backend.
- **The backend** (FastAPI) runs as a background service that restarts itself.
- **Your API keys** stay in a `.env` file on the server only.

Time needed: about 1 to 2 hours the first time. You do not need prior server experience. Follow the steps in order.

> **Read first**
> - Only type commands where this guide says to. Lines starting with `#` are comments, not commands.
> - Replace anything in `<ANGLE_BRACKETS>` with your own value.
> - AWS charges by the hour while the server runs. See Step 22 to stop it when you are not using it.
> - Never paste your `.env` contents or API keys into chat, email, or GitHub.

---

## Part 1: Prepare on your Mac

### Step 1. Check that the project works on your Mac

Open **Terminal** (press `⌘ Space`, type `Terminal`, press Enter).

```bash
cd /Users/mac/Downloads/classroom_ai
cd frontend && npm run build && cd ..
```

You should see `built in ...` near the end. If it fails, stop here and fix it first.

### Step 2. Put the code on GitHub

The server downloads the code from GitHub, so the latest changes must be there.

```bash
cd /Users/mac/Downloads/classroom_ai
git status
```

You will see a list of changed files. Add them, commit, and push:

```bash
git add -A
git commit -m "Prepare app for AWS EC2 deployment"
git push origin main
```

If `git push` asks for a password, GitHub no longer accepts account passwords. Create a token at **GitHub → Settings → Developer settings → Personal access tokens** and paste it instead.

> **Check before you push:** run `git status`. `.env` must **not** appear in the list. It is excluded automatically. If it appears, stop and tell me.

### Step 3. Make a copy of your `.env` file

Your `.env` holds your secret keys and is not on GitHub. You will copy it to the server in Step 9. Keep this file safe on your Mac and do not share it.

> **Rotate the Pexels key.** Your Pexels key was previously written into `.env.example`, which means it has been exposed. Go to **pexels.com/api**, create a new key, and put it in `.env` as `PEXELS_API_KEY=...`. Then remove the old key from Pexels.

---

## Part 2: Create the AWS server

### Step 4. Sign in to AWS

1. Go to **https://console.aws.amazon.com** and sign in.
2. In the top-right corner, pick a region close to your users, for example **Asia Pacific (Mumbai) ap-south-1** or **US East (N. Virginia) us-east-1**. Keep this region for every step.

### Step 5. Create a key pair (your SSH login key)

1. Search for **EC2** in the top search bar and open it.
2. In the left menu, click **Key Pairs** (under *Network & Security*).
3. Click **Create key pair**.
   - Name: `classroomai-key`
   - Key pair type: **RSA**
   - Private key format: **.pem**
4. Click **Create key pair**. A file `classroomai-key.pem` downloads.
5. Move it to a safe folder and lock its permissions:

```bash
mkdir -p ~/.ssh
mv ~/Downloads/classroomai-key.pem ~/.ssh/
chmod 400 ~/.ssh/classroomai-key.pem
```

> If you lose this file, you cannot log in to the server. Keep a backup.

### Step 6. Create a security group (firewall)

1. In EC2, left menu → **Security Groups** → **Create security group**.
2. Name: `classroomai-sg`. Description: `ClassroomAI web and SSH`.
3. Keep the default VPC.
4. **Inbound rules** → **Add rule** three times:

| Type  | Port | Source              | Why                         |
|-------|------|---------------------|-----------------------------|
| SSH   | 22   | **My IP**           | Only you can log in         |
| HTTP  | 80   | Anywhere (0.0.0.0/0)| Visitors open the website   |
| HTTPS | 443  | Anywhere (0.0.0.0/0)| Secure visits (Step 18)     |

5. Click **Create security group**.

### Step 7. Launch the server

1. EC2 → **Instances** → **Launch instances**.
2. **Name:** `classroomai`
3. **Application and OS Images:** choose **Ubuntu**, then **Ubuntu Server 24.04 LTS**, 64-bit (x86).
4. **Instance type:** choose **t3.large** (2 vCPU, 8 GB memory). This is the smallest size we recommend, because video rendering and PDF OCR need memory. Use **t3.medium** only for light testing.
5. **Key pair:** select `classroomai-key`.
6. **Network settings** → **Edit**:
   - **Security group:** select existing → `classroomai-sg`.
   - **Auto-assign public IP:** Enable.
7. **Configure storage:** change the size to **30 GiB** (gp3).
8. Click **Launch instance**. Wait about 2 minutes.

### Step 8. Give the server a fixed address and connect to it

A normal public address changes when the server restarts. A fixed one does not.

1. EC2 → left menu → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**.
2. Select the new address → **Actions → Associate Elastic IP address** → choose your `classroomai` instance → **Associate**.
3. Write down this address. It is your **SERVER_IP**, for example `13.233.10.25`.

Now log in from your Mac:

```bash
ssh -i ~/.ssh/classroomai-key.pem ubuntu@<SERVER_IP>
```

Type `yes` if asked about the fingerprint. You are now inside the server. The prompt changes to `ubuntu@ip-...`. **All commands from Step 10 onward run on the server**, not on your Mac.

> If `Permission denied` appears, check the key file name and that you used `ubuntu@` (not your own name).
> If it times out, check that port 22 in `classroomai-sg` allows **My IP**. If your home internet address changed, update that rule.

---

## Part 3: Set up the server

### Step 9. Copy your `.env` file to the server

Run this **on your Mac**, in a new Terminal window (keep the SSH window open):

```bash
scp -i ~/.ssh/classroomai-key.pem /Users/mac/Downloads/classroom_ai/.env ubuntu@<SERVER_IP>:/home/ubuntu/classroomai.env
```

It will be moved into the project folder in Step 11.

### Step 10. Update the server and install the software it needs

Run these **on the server**, one at a time:

```bash
sudo apt update && sudo apt upgrade -y
```

```bash
sudo apt install -y git python3 python3-venv python3-pip nginx tesseract-ocr fonts-dejavu-core ffmpeg curl
```

Install Node.js 22 (needed to build the website):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Check the versions:

```bash
git --version && python3 --version && node --version && npm --version
```

`node` should show `v22.x` or newer.

### Step 11. Download the code

Replace `<YOUR_GITHUB_USER>` with your GitHub username. If your repository is private, GitHub will ask for your username and a personal access token (the password field takes the token).

```bash
cd /home/ubuntu
git clone https://github.com/<YOUR_GITHUB_USER>/classroom_ai.git
cd classroom_ai
```

Move the `.env` file into place and make sure it is private:

```bash
mv /home/ubuntu/classroomai.env /home/ubuntu/classroom_ai/.env
chmod 600 /home/ubuntu/classroom_ai/.env
```

### Step 12. Install the Python packages

```bash
cd /home/ubuntu/classroom_ai
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

This takes a few minutes. When it finishes, type `deactivate`.

Test that the backend starts. Press `Ctrl+C` to stop it after you see `Application startup complete`:

```bash
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Step 13. Build the website

```bash
cd /home/ubuntu/classroom_ai/frontend
npm ci
npm run build
cd /home/ubuntu/classroom_ai
```

`npm ci` takes a few minutes. You should see `built in ...`. The website files are now in `frontend/dist`.

---

## Part 4: Run the app as a service

### Step 14. Start the backend automatically

Copy the service file into place and start it:

```bash
sudo cp /home/ubuntu/classroom_ai/deploy/classroomai.service /etc/systemd/system/classroomai.service
sudo systemctl daemon-reload
sudo systemctl enable classroomai
sudo systemctl start classroomai
```

Check that it is running:

```bash
sudo systemctl status classroomai --no-pager
curl http://127.0.0.1:8000/health
```

You should see `active (running)` and `{"status":"ok"}`.

> To watch the logs when something goes wrong: `sudo journalctl -u classroomai -f` (press `Ctrl+C` to stop).

### Step 15. Set up Nginx to serve the website

Copy the Nginx config and turn it on:

```bash
sudo cp /home/ubuntu/classroom_ai/deploy/nginx-classroomai.conf /etc/nginx/sites-available/classroomai
sudo ln -sf /etc/nginx/sites-available/classroomai /etc/nginx/sites-enabled/classroomai
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

`sudo nginx -t` must say `syntax is ok` and `test is successful`.

Now open the site. On your Mac, open a browser and go to:

```
http://<SERVER_IP>
```

You should see the ClassroomAI page. Check the API too: `http://<SERVER_IP>/health` should show `{"status":"ok"}`.

> If you see **502 Bad Gateway**, the backend is not running. Run `sudo systemctl status classroomai` and `sudo journalctl -u classroomai -n 50`.
> If you see **404** on `/api` routes, check the Nginx config was copied and `nginx -t` passed.

---

## Part 5: Make it usable

### Step 16. Choose your AI stack

The app defaults to **Open source (Ollama)**. Ollama is not installed on this server, so use **OpenAI** for the app to work:

- In the app, set **Model stack** to **OpenAI** in the top bar. Do this each time you open the app, or change the default in the code later.

The OpenAI key must be in `.env`. The file already has it if you copied it in Step 9. To check that the server can read your key without printing it:

```bash
grep -c "^OPENAI_API_KEY=." /home/ubuntu/classroom_ai/.env
```

It should print `1`. If it prints `0`, edit the file with `nano /home/ubuntu/classroom_ai/.env`, add the key, save with `Ctrl+O`, `Enter`, and exit with `Ctrl+X`. Then restart: `sudo systemctl restart classroomai`.

### Step 17. Test every main feature

Open `http://<SERVER_IP>` and check, in this order:

1. **Lesson:** paste a short paragraph, set the stack to OpenAI, click **Create lesson**.
2. **Quiz:** generate 3 questions, select one, click **Download Excel**.
3. **Slides:** generate a deck (4 slides) and wait about a minute.
4. **Listen:** generate audio.
5. **Video:** try **Local animation**.

If one fails, run `sudo journalctl -u classroomai -n 80 --no-pager` and send me the last lines (without any keys).

---

## Part 6: Optional but recommended

### Step 18. Use your own domain with HTTPS

You need a domain name, for example `classroom.yourdomain.com`.

1. At your domain provider, add an **A record** pointing `classroom` (or `@`) to `<SERVER_IP>`. Wait 10 to 30 minutes.
2. On the server, edit the Nginx config and replace `server_name _;` with your domain:

```bash
sudo nano /etc/nginx/sites-available/classroomai
```

Change `server_name _;` to `server_name classroom.yourdomain.com;`. Save and exit.

3. Install a free HTTPS certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d classroom.yourdomain.com
```

Answer the questions (enter your email, agree to the terms, and choose to redirect HTTP to HTTPS).

4. Open `https://classroom.yourdomain.com`.

### Step 19. Allow the domain in the app settings

Edit `.env` and set the allowed origins to your new address:

```bash
nano /home/ubuntu/classroom_ai/.env
```

Set `CORS_ORIGINS=https://classroom.yourdomain.com`, save, then run `sudo systemctl restart classroomai`.

---

## Part 7: Keep it running

### Step 20. Update the app after you change code

On your Mac: commit and push the change (Step 2).

On the server:

```bash
cd /home/ubuntu/classroom_ai
git pull
source .venv/bin/activate && pip install -r requirements.txt && deactivate
cd frontend && npm ci && npm run build && cd ..
sudo systemctl restart classroomai
```

### Step 21. Useful commands

| What you want           | Command                                          |
|-------------------------|--------------------------------------------------|
| Backend status          | `sudo systemctl status classroomai --no-pager`   |
| Restart backend         | `sudo systemctl restart classroomai`             |
| Backend logs (live)     | `sudo journalctl -u classroomai -f`              |
| Restart website server  | `sudo systemctl restart nginx`                   |
| Check disk space        | `df -h`                                          |
| Check memory            | `free -h`                                        |

### Step 22. Stop the server to save money

When you are not using the app, stop the instance:

EC2 → **Instances** → select `classroomai` → **Instance state → Stop instance**.

The Elastic IP keeps its address. When you start the instance again, the app restarts by itself, because the service is enabled. Stopping the server does not delete it.

> **Costs:** the instance, its storage, and the Elastic IP (when the instance is stopped) are billed. Also watch your OpenAI and Pexels usage, since those are billed separately.
> **Delete everything:** terminate the instance, release the Elastic IP, and delete the security group. Only do this when you no longer need the app.

---

## Troubleshooting

| Problem | What to check |
|---|---|
| Website does not open at all | Security group allows port 80. Nginx is running: `sudo systemctl status nginx`. |
| 502 Bad Gateway | Backend is down: `sudo systemctl status classroomai`, then `sudo journalctl -u classroomai -n 50`. |
| "Not Found" on a feature | Nginx config is wrong, or the backend was not restarted after an update. Run `sudo nginx -t`, then restart both services. |
| "OPENAI_API_KEY is required" | `.env` is missing the key, or the service was not restarted after editing it. |
| Quiz or lesson fails with Ollama errors | Switch the Model stack to **OpenAI** in the app (Step 16). |
| Video or slides time out | Use a bigger instance (t3.xlarge). Watch memory with `free -h`. |
| PDF OCR does nothing | Check Tesseract: `tesseract --version`. Reinstall with `sudo apt install -y tesseract-ocr`. |
| Upload fails for large files | The limit is 60 MB in `deploy/nginx-classroomai.conf` (`client_max_body_size`). |
| `git pull` asks for a password | Use a GitHub personal access token as the password. |
| Out of disk space | `df -h`. Old generated files live in temporary folders. Restart the backend to clear memory. Increase storage in EC2 if needed. |

---

## Security checklist

- [ ] `.env` is only on the server, with permissions `600`.
- [ ] Old Pexels key was revoked and replaced.
- [ ] SSH (port 22) is limited to **My IP**.
- [ ] No keys were pasted into chat, GitHub, or screenshots.
- [ ] You know how to stop the instance (Step 22).

---

## Part 8: Get the address `purnank.smartskale.tech`

This makes the app open at **https://purnank.smartskale.tech**. The steps are the same as Step 18, using the domain `smartskale.tech` and the name `purnank`. You need access to the DNS settings of `smartskale.tech`, which is wherever the domain was bought (for example GoDaddy, Namecheap, Hostinger, Google Domains, or AWS Route 53).

### Step 23. Find your server address

You need the **SERVER_IP** from Step 8, the Elastic IP. Keep it open.

### Step 24. Add the DNS record

This tells the internet that `purnank.smartskale.tech` points to your server.

1. Sign in to the website where you manage `smartskale.tech`.
2. Open its **DNS settings** (sometimes called *DNS Management*, *Advanced DNS*, or *Zone file*).
3. Add a new record with these values:

| Field        | Value                                  |
|--------------|----------------------------------------|
| Type         | **A**                                  |
| Name / Host  | **purnank** (only this word, not the full domain) |
| Value / Points to | **`<SERVER_IP>`**                 |
| TTL          | 300 (or the default)                   |

4. Save the record.

> **Route 53 (AWS):** open **Route 53 → Hosted zones → smartskale.tech → Create record**. Record name `purnank`, record type **A**, value `<SERVER_IP>`, TTL 300.
> **Cloudflare:** if the cloud icon is orange, click it so it turns grey (**DNS only**). Otherwise the certificate in Step 26 will fail.

### Step 25. Check that the address points to your server

DNS changes can take 5 to 30 minutes. On your **Mac**, run:

```bash
dig +short purnank.smartskale.tech
```

It should print your SERVER_IP. If it prints nothing, wait 10 minutes and try again. (If `dig` is not found, use `nslookup purnank.smartskale.tech` instead.)

Do not continue until the address shows your SERVER_IP.

### Step 26. Tell Nginx the new name

On the **server** (SSH window):

```bash
sudo nano /etc/nginx/sites-available/classroomai
```

Find the line `server_name _;` and change it to:

```
    server_name purnank.smartskale.tech;
```

Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`. Then check and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` must say `syntax is ok` and `test is successful`.

Open **http://purnank.smartskale.tech** on your Mac. You should see ClassroomAI. If not, wait a few more minutes for DNS and try again.

### Step 27. Install the HTTPS certificate

Without this step, the browser shows "Not secure". Run on the server:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d purnank.smartskale.tech
```

Answer the prompts:
1. Enter your email address (for expiry warnings).
2. Agree to the terms with `Y`.
3. Optional email news: `N` is fine.
4. When asked whether to redirect HTTP to HTTPS, choose **2 (Redirect)**.

Certbot changes the Nginx config for you and renews the certificate automatically.

> **If certbot says the challenge failed:** the DNS record from Step 24 is not live yet (Step 25), or port 80 is blocked (Step 6). Fix that and run the same command again.

### Step 28. Allow the new address in the app

```bash
nano /home/ubuntu/classroom_ai/.env
```

Set this line (replace any old value):

```
CORS_ORIGINS=https://purnank.smartskale.tech
```

Save and exit, then restart the backend:

```bash
sudo systemctl restart classroomai
```

### Step 29. Test the new address

On your Mac, open these in a browser:

- `https://purnank.smartskale.tech` → the ClassroomAI page, with a padlock icon.
- `https://purnank.smartskale.tech/health` → `{"status":"ok"}`.

Then run one feature from Step 17 (for example Lesson) to confirm everything works on the new address.

### Step 30. Troubleshooting the address

| Problem | Fix |
|---|---|
| `dig` shows nothing | DNS still updating. Wait and retry, or check the record name is exactly `purnank`. |
| Opens the old server or a "Welcome to nginx" page | The `server_name` in Step 26 is still `_`. Fix it and reload Nginx. |
| "Not secure" warning | Step 27 did not finish. Run the certbot command again. |
| certbot "Timeout" or "Connection refused" | Port 80 is closed in `classroomai-sg`, or the DNS record is wrong. |
| Browser says "This site can't be reached" | DNS is not updated yet, or Cloudflare proxy is on (turn it off). |
| Features fail only on the new address | Check `CORS_ORIGINS` in `.env` (Step 28), then restart the backend. |

> **More people later:** you can add more addresses the same way, for example `second.smartskale.tech`. Add another A record in Step 24, add the name to `server_name` separated by spaces (`server_name purnank.smartskale.tech second.smartskale.tech;`), and run certbot with `-d` for each name.
