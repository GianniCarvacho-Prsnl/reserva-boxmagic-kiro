# CrossFit Reservation Bot

## Product Overview

Automated CrossFit class reservation bot for BoxMagic platform that executes reservations at precise timing to secure spots in high-demand classes.

## Core Problem

CrossFit class spots fill up within seconds (sometimes milliseconds) of opening. Manual reservation is nearly impossible due to the speed required.

## Solution

Automated bot that:
- Logs into BoxMagic platform
- Navigates to class selection 
- Waits for exact reservation opening time
- Executes reservation with millisecond precision
- Provides retry logic and comprehensive logging

## Key Requirements

- **Timing Precision**: Reservations must execute at exact millisecond timing
- **Preparation Buffer**: Complete login/navigation 30+ seconds before target time
- **Retry Logic**: Single immediate retry on failure
- **Multi-platform**: Supports both Vercel (cron) and Fly.io (server) deployment
- **Timezone Aware**: Operates in Santiago, Chile timezone (America/Santiago)

## User Context

- Single user initially (personal use)
- Runs 1-2 reservations per day maximum
- Critical execution window: 18:00-19:00 weekdays, 09:00-10:00 Saturday
- Future expansion planned for multi-user support

## Success Metrics

- Successful reservation within target timing window
- Preparation phase completion within buffer time
- Accurate timing execution (< 1000ms deviation)
- Proper error handling and notification delivery