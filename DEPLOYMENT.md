# Deployment Guide

This guide covers deploying the CrossFit Reservation Bot to both Vercel and Fly.io platforms.

## Prerequisites

1. **Environment Variables**: Set up the following environment variables:
   ```bash
   BOXMAGIC_EMAIL=your-email@example.com
   BOXMAGIC_PASSWORD=your-password
   TIMEZONE=America/Santiago
   WEBHOOK_URL=https://your-webhook-url.com  # Optional
   BROWSER_HEADLESS=true
   NOTIFICATIONS_ENABLED=true  # Set to false if no webhook
   ```

2. **Configuration File**: Create a `config.json` file with your reservation schedules:
   ```json
   {
     "schedules": [
       {
         "id": "metcon-viernes-18",
         "dayToSelect": "tomorrow",
         "className": "METCON",
         "reservationTime": "2024-09-19T17:00:00-03:00",
         "bufferSeconds": 30,
         "enabled": true,
         "cronExpression": "0 17 * * 4",
         "description": "Reservar METCON del viernes 18:00"
       }
     ]
   }
   ```

## Option 1: Vercel Deployment (Recommended)

### Setup

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Login to Vercel**:
   ```bash
   vercel login
   ```

### Configuration

1. **Set environment variables** in Vercel dashboard or via CLI:
   ```bash
   vercel env add BOXMAGIC_EMAIL
   vercel env add BOXMAGIC_PASSWORD
   vercel env add WEBHOOK_URL
   ```

2. **Deploy**:
   ```bash
   npm run vercel:deploy
   ```

### Cron Jobs

The `vercel.json` file includes pre-configured cron jobs for common schedules:

- **METCON Friday 18:00**: Runs Thursday at 17:00 (25h before)
- **CrossFit Monday 18:00**: Runs Sunday at 17:00
- **CrossFit Tuesday 19:00**: Runs Monday at 18:00
- **CrossFit Wednesday 18:00**: Runs Tuesday at 17:00
- **CrossFit Thursday 19:00**: Runs Wednesday at 18:00
- **CrossFit Saturday 10:00**: Runs Friday at 09:00

### Testing

1. **Test the deployment**:
   ```bash
   curl "https://your-app.vercel.app/api/reserve?status=true"
   ```

2. **Test a reservation** (use a test schedule):
   ```bash
   curl "https://your-app.vercel.app/api/reserve?scheduleId=test-schedule"
   ```

3. **Validate configuration**:
   ```bash
   curl "https://your-app.vercel.app/api/reserve?validate=true"
   ```

## Option 2: Fly.io Deployment

### Setup

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io**:
   ```bash
   fly auth login
   ```

3. **Create app** (if not already created):
   ```bash
   fly apps create crossfit-reservation-bot --region scl
   ```

### Configuration

1. **Set secrets**:
   ```bash
   fly secrets set BOXMAGIC_EMAIL=your-email@example.com
   fly secrets set BOXMAGIC_PASSWORD=your-password
   fly secrets set WEBHOOK_URL=https://your-webhook-url.com
   ```

2. **Deploy**:
   ```bash
   npm run fly:deploy
   ```

### External Cron Jobs

Since Fly.io doesn't have built-in cron jobs, use external services:

#### Option A: GitHub Actions

Create `.github/workflows/reservations.yml`:

```yaml
name: CrossFit Reservations
on:
  schedule:
    - cron: '0 17 * * 0'  # Sunday 17:00 for Monday class
    - cron: '0 18 * * 1'  # Monday 18:00 for Tuesday class
    # Add more schedules as needed

jobs:
  reserve:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Reservation
        run: |
          curl -X POST "https://crossfit-reservation-bot.fly.dev/reserve" \
            -H "Content-Type: application/json" \
            -d '{"scheduleId": "${{ github.event.schedule }}"}'
```

#### Option B: External Cron Service

Use services like cron-job.org or EasyCron:

- **URL**: `https://crossfit-reservation-bot.fly.dev/reserve`
- **Method**: POST
- **Body**: `{"scheduleId": "your-schedule-id"}`
- **Schedule**: Set according to your needs

### Testing

1. **Check health**:
   ```bash
   curl "https://crossfit-reservation-bot.fly.dev/health"
   ```

2. **Test reservation**:
   ```bash
   curl -X POST "https://crossfit-reservation-bot.fly.dev/reserve" \
     -H "Content-Type: application/json" \
     -d '{"scheduleId": "test-schedule"}'
   ```

3. **View logs**:
   ```bash
   npm run fly:logs
   ```

## API Endpoints

Both platforms support the same API endpoints:

### Vercel URLs
- **Reserve**: `https://your-app.vercel.app/api/reserve`
- **Status**: `https://your-app.vercel.app/api/reserve?status=true`
- **Validate**: `https://your-app.vercel.app/api/reserve?validate=true`
- **Test Webhook**: `https://your-app.vercel.app/api/reserve?testWebhook=true`

### Fly.io URLs
- **Reserve**: `https://your-app.fly.dev/reserve`
- **Status**: `https://your-app.fly.dev/status`
- **Health**: `https://your-app.fly.dev/health`
- **Validate**: `https://your-app.fly.dev/validate`
- **Test Webhook**: `https://your-app.fly.dev/webhook/test`

## Monitoring and Debugging

### Logs

**Vercel**:
```bash
vercel logs --follow
```

**Fly.io**:
```bash
fly logs --follow
```

### Webhook Notifications

If configured, the bot will send detailed notifications to your webhook URL including:
- Execution results
- Timing metrics
- Error details
- System status

### Manual Testing

You can manually trigger reservations for testing:

```bash
# Single reservation
curl -X POST "https://your-app/reserve" \
  -H "Content-Type: application/json" \
  -d '{"scheduleId": "test-schedule"}'

# Multiple reservations
curl -X POST "https://your-app/reserve" \
  -H "Content-Type: application/json" \
  -d '{"scheduleIds": ["schedule1", "schedule2"]}'

# With overrides
curl -X POST "https://your-app/reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleId": "test-schedule",
    "className": "Custom Class Name",
    "targetTime": "2024-12-09T17:00:00-03:00"
  }'
```

## Troubleshooting

### Common Issues

1. **Browser timeout**: Increase `BROWSER_TIMEOUT` environment variable
2. **Memory issues**: Increase memory allocation in platform settings
3. **Timing accuracy**: Check server region (use `scl` for Chile)
4. **Configuration errors**: Use the validate endpoint to check config

### Performance Optimization

1. **Vercel**: Use `scl1` region for optimal latency from Chile
2. **Fly.io**: Use `scl` region (Santiago)
3. **Browser**: Keep `BROWSER_HEADLESS=true` for production
4. **Memory**: Monitor memory usage and adjust if needed

### Security

1. **Environment Variables**: Never commit credentials to code
2. **Webhook URLs**: Use HTTPS endpoints only
3. **API Access**: Consider adding authentication for production use
4. **Secrets**: Use platform-specific secret management

## Migration Between Platforms

To migrate from Vercel to Fly.io or vice versa:

1. **Export configuration**: Use the validate endpoint to verify config
2. **Set up new platform**: Follow the setup steps above
3. **Test thoroughly**: Verify all endpoints work correctly
4. **Update cron jobs**: Adjust scheduling mechanism as needed
5. **Monitor**: Watch logs during the transition period