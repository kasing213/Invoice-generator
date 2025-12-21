# Railway Deployment Guide

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. GitHub repository with this code
3. MongoDB Atlas account (or Railway PostgreSQL if migrating)
4. Telegram Bot Token from @BotFather
5. Claude API Key (if using AI features)

## Deployment Steps

### 1. Prepare Your Repository

```bash
# Initialize git repository (if not done)
git init
git add .
git commit -m "Initial commit with Railway deployment"

# Add remote and push
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Create New Railway Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your invoice-generator repository
4. Railway will automatically detect the Dockerfile

### 3. Configure Environment Variables

In Railway dashboard, add these environment variables:

```env
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/invoiceDB?retryWrites=true&w=majority
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
BOT_USERNAME=YourBotUsername
QR_IMAGE_PATH=./templates/QR-for-Payment.jpg
CLAUDE_API=your_claude_api_key
NODE_ENV=production
```

**Important**: Use your NEW credentials (rotate old ones from .env file)

### 4. Deploy

Railway will automatically:
- Build the Docker image
- Deploy the container
- Assign a public URL (if needed)
- Provide a PORT environment variable

### 5. Set Up Telegram Webhook (if using webhooks)

After deployment, set your Railway URL as the webhook:

```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-app.railway.app/webhook
```

## Railway Configuration

### Dockerfile Deployment

Railway automatically detects the Dockerfile and uses it for deployment.

### Resource Limits

Recommended settings:
- **Memory**: 512MB - 1GB (Puppeteer needs memory)
- **CPU**: Shared (upgrade if needed)

### Health Checks

Add a health check endpoint in your Express app:

```javascript
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});
```

Configure in Railway:
- Path: `/health`
- Interval: 30s
- Timeout: 10s

### Networking

- Railway provides automatic HTTPS
- Use Railway's internal networking for databases
- Enable private networking for better security

## MongoDB Setup

### Option 1: MongoDB Atlas (Recommended)

1. Create cluster at https://cloud.mongodb.com
2. Configure Network Access:
   - Add `0.0.0.0/0` (Railway has dynamic IPs)
   - Or use Railway's static IPs if available
3. Create database user with limited permissions
4. Get connection string and add to Railway env vars

### Option 2: Railway MongoDB Plugin

```bash
# In Railway dashboard
# Add "Add Plugin" > "MongoDB"
# Railway will automatically set MONGO_URL
```

## Monitoring & Logs

### View Logs

```bash
# In Railway dashboard or CLI
railway logs
```

### Metrics

Railway provides built-in metrics:
- CPU usage
- Memory usage
- Network traffic
- Response times

## Troubleshooting

### Puppeteer Issues

If Puppeteer fails to launch Chrome:

```dockerfile
# Already handled in Dockerfile
# Ensure all Chrome dependencies are installed
```

### Port Binding

Railway automatically sets `PORT` env variable. Update your code:

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Build Failures

Check:
- Dockerfile syntax
- All dependencies in package.json
- Build logs in Railway dashboard

### Memory Issues

If app crashes due to memory:
- Increase Railway plan limits
- Optimize Puppeteer (close pages after use)
- Implement caching strategies

## Security Checklist

- [ ] Rotated all credentials from .env
- [ ] Environment variables set in Railway (not in code)
- [ ] MongoDB IP whitelisting configured
- [ ] Telegram bot token is new/secure
- [ ] Claude API key has usage limits
- [ ] HTTPS enabled (automatic with Railway)
- [ ] Health checks configured
- [ ] Monitoring/alerting set up

## Cost Optimization

1. **Starter Plan**: Free tier available
2. **Sleep Mode**: App sleeps after inactivity (free tier)
3. **Resource Limits**: Set appropriate limits
4. **Caching**: Implement Redis for better performance

## Useful Railway CLI Commands

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Run command in Railway environment
railway run npm start

# Environment variables
railway variables
```

## Auto-Deploy on Git Push

Railway automatically deploys when you push to your main branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Railway automatically deploys
```

## Rollback

If deployment fails:
1. Go to Railway dashboard
2. Click "Deployments"
3. Select previous working deployment
4. Click "Redeploy"

## Custom Domain (Optional)

1. Go to Railway project settings
2. Click "Domains"
3. Add custom domain
4. Configure DNS records as shown

## Backup Strategy

1. **MongoDB**: Enable automated backups in Atlas
2. **Code**: Git repository (GitHub)
3. **Environment**: Export Railway variables regularly

## Support & Resources

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- GitHub Issues: Report problems in your repo

## Next Steps After Deployment

1. Test all bot commands
2. Verify invoice generation works
3. Check MongoDB connectivity
4. Monitor error logs
5. Set up alerts for failures
6. Document any custom configurations

---

**Deployment Status**: Ready for Railway ✅
**Estimated Deploy Time**: 5-10 minutes
**Difficulty**: Easy (automated with Docker)
