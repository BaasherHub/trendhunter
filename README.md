# 🤖 TrendHunter — Automated Meme Coin Launcher

Automatically launches a meme coin every day based on Google Trends, earns 65% of all trading fees via ClawPump.

## How It Works

Every day at 10:00 AM UTC, the bot:
1. 📈 Fetches top trending topics from Google Trends (free, no API key)
2. 🤖 Uses Claude AI to generate a token name, symbol, and description
3. 🎨 Generates a banner image using Pollinations.ai (free, no API key)
4. 🚀 Launches the token on pump.fun via ClawPump API
5. 💰 Earns 65% of all trading fees automatically to your Solana wallet

---

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/trendhunter
cd trendhunter
npm install
```

### 2. Set Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required:
- `ANTHROPIC_API_KEY` — Get at [console.anthropic.com](https://console.anthropic.com)
- `SOLANA_WALLET_ADDRESS` — Your Solana wallet public address

### 3. Test Locally

Run once immediately to test everything works:

```bash
node src/index.js --now
```

Check launch history:

```bash
node src/index.js --history
```

---

## Deploy to Railway

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/trendhunter.git
git push -u origin main
```

### Step 2: Connect to Railway

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `trendhunter` repository
4. Railway will auto-detect Node.js and deploy

### Step 3: Add Environment Variables

In Railway dashboard → your project → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `SOLANA_WALLET_ADDRESS` | Your Solana wallet address |
| `CLAWPUMP_AGENT_ID` | `trendhunter-001` (or custom) |
| `CLAWPUMP_AGENT_NAME` | `TrendHunter` |

### Step 4: Deploy

Railway will automatically deploy. The bot will start and wait for 10:00 AM UTC daily.

---

## Monitoring

- **Railway logs** — See real-time logs in Railway dashboard
- **ClawPump dashboard** — `https://clawpump.tech/agent/trendhunter-001`
- **Earnings** — Check via ClawPump API: `GET /api/fees/earnings?agentId=trendhunter-001`

---

## Cost Breakdown

| Service | Cost |
|---------|------|
| Google Trends | Free |
| Pollinations.ai (images) | Free |
| ClawPump token launch | Free |
| Claude API (per launch) | ~$0.01 |
| Railway hosting | ~$5/month |

**Total monthly cost: ~$5.30**

---

## Revenue Potential

| Daily Trading Volume | Monthly Earnings |
|---------------------|-----------------|
| $1,000 | ~$195 |
| $10,000 | ~$1,950 |
| $50,000 | ~$9,750 |

---

## Rate Limits

ClawPump allows 1 launch per 24 hours per `agentId`. The bot handles rate limit errors gracefully and logs them.

---

## Disclaimer

Meme coins are highly speculative. Trading volume is not guaranteed. This bot automates the launch process — actual earnings depend entirely on community engagement and trading activity.
