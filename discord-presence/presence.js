/**
 * ESO Housing — Discord Bot Presence Worker
 *
 * Maintains a persistent gateway connection so the bot appears online with
 * a rotating custom status. Pairs with the PHP-based interactions endpoint
 * (api/discord.php) — that handles slash commands, this handles presence.
 *
 * Status rotates every PRESENCE_ROTATE_MS (default 6 min) through a curated
 * list of voice-consistent activity lines. Discord auto-reconnects through
 * discord.js if the gateway drops; the worker also catches uncaught errors
 * and exits non-zero so the host (Fly.io/Railway/etc.) restarts it.
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN      — same token used by api/discord.php
 *
 * Optional env vars:
 *   PRESENCE_ROTATE_MS     — milliseconds between status changes (default 360000 = 6 min)
 *   PRESENCE_LANG          — 'en' or 'ru' for status text (default 'en')
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const ROTATE_MS = parseInt(process.env.PRESENCE_ROTATE_MS || '360000', 10);
const LANG = (process.env.PRESENCE_LANG || 'en').toLowerCase();

if (!TOKEN) {
  console.error('FATAL: DISCORD_BOT_TOKEN env var not set.');
  process.exit(1);
}

// ─── Curated status rotation ──────────────────────────────
// Activity types: Playing (0) · Listening (2) · Watching (3) · Custom (4) · Competing (5)
// Bots cannot use Streaming (1) without a Twitch URL. Custom (4) is currently
// rejected from regular bots — Discord limits it to user accounts. So we pick
// from Playing / Listening / Watching / Competing for variety.

const statusesEn = [
  { type: ActivityType.Watching,   name: 'the Aurbis · 6 800 furnishings' },
  { type: ActivityType.Listening,  name: 'to /furniture queries' },
  { type: ActivityType.Watching,   name: 'esohousing.com · new houses' },
  { type: ActivityType.Playing,    name: '/furniture · /announcements-setup' },
  { type: ActivityType.Watching,   name: 'the spotlight rotate · weekly' },
  { type: ActivityType.Watching,   name: 'every Crown Store drop · daily' },
  { type: ActivityType.Listening,  name: 'to the music boxes · soon™' },
];

const statusesRu = [
  { type: ActivityType.Watching,   name: 'за Аурбисом · 6 800 предметов' },
  { type: ActivityType.Listening,  name: 'команды /furniture' },
  { type: ActivityType.Watching,   name: 'esohousing.com · новые дома' },
  { type: ActivityType.Playing,    name: '/furniture · /announcements-setup' },
  { type: ActivityType.Watching,   name: 'еженедельный Spotlight' },
  { type: ActivityType.Watching,   name: 'обновления Crown Store · ежедневно' },
];

const statuses = LANG === 'ru' ? statusesRu : statusesEn;

// ─── Client ──────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],   // minimum intent — only needs to know what servers we're in
  presence: {
    status: 'online',
    activities: [statuses[0]],
  },
});

let cursor = 0;
let rotateInterval = null;

function setNextStatus() {
  cursor = (cursor + 1) % statuses.length;
  const next = statuses[cursor];
  client.user.setPresence({
    status: 'online',
    activities: [next],
  });
  const typeName = Object.keys(ActivityType).find(k => ActivityType[k] === next.type) || 'Activity';
  console.log(`[${new Date().toISOString()}] Status → ${typeName} ${next.name}`);
}

client.once('clientReady', () => {
  console.log(`[${new Date().toISOString()}] Logged in as ${client.user.tag}`);
  console.log(`[${new Date().toISOString()}] Rotating ${statuses.length} statuses every ${ROTATE_MS / 1000}s`);
  // Initial status is set via Client constructor; rotate from there
  rotateInterval = setInterval(setNextStatus, ROTATE_MS);
});

client.on('error', (err) => {
  console.error(`[${new Date().toISOString()}] Client error:`, err);
});

client.on('shardDisconnect', (event, shardId) => {
  console.warn(`[${new Date().toISOString()}] Shard ${shardId} disconnected (code ${event.code}). discord.js will auto-reconnect.`);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] SIGTERM received. Cleaning up.`);
  if (rotateInterval) clearInterval(rotateInterval);
  client.destroy().then(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught exception:`, err);
  process.exit(1);  // host will restart us
});

client.login(TOKEN);
