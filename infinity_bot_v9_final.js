/* ============================================
   ✦ INFINITY BOT — WhatsApp Edition V8
   All features from V15 + XR engine
   ✦ V8 UPGRADES:
     • Telegram Panel — pair & control via Telegram
     • Each user gets their own private WA session
     • Commands work from Telegram directly
     • Sessions auto-restore on restart
     • Crash protection + 50ms stable speed
   ============================================ */

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { getAudioUrl } from "google-tts-api";
import yts from "yt-search";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");

// Telegram Panel — optional, only loads if TELEGRAM_BOT_TOKEN is set
let TelegramBot = null;
try { TelegramBot = require("node-telegram-bot-api"); } catch {}

/* ============ CRASH PROTECTION — STABILITY ENGINE ============ */
// Prevent ANY unhandled error from killing the process
process.on("uncaughtException", err => {
  console.error(`[${new Date().toLocaleTimeString()}] ⚠️ uncaughtException (caught, bot stays alive):`, err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.error(`[${new Date().toLocaleTimeString()}] ⚠️ unhandledRejection (caught, bot stays alive):`, reason?.message || reason);
});

/* ============ CONFIG ============ */
let PREFIX = "/";
let GLOBAL_DELAY = 0.8;

const DOMAIN_EXPANSION_IMAGE = "https://i.imgur.com/6Gq9V1P.jpeg";
const MENU_IMAGE = "./menu.jpg"; // ← apni image is naam se same folder mein rakh do

/* ── TELEGRAM PANEL CONFIG ──
   Set your bot token from @BotFather below.
   Leave empty ("") to disable the Telegram panel. */
const TELEGRAM_BOT_TOKEN   = "8759282028:AAG7-dlQk0KIyBOlYSl-tTcTrJwi3K2HT7s";
const TELEGRAM_ADMIN_TOKEN = "8799677080:AAFdyVJFB79KU6bLnbr97XTdl9yD45HwOhs";
const TELEGRAM_ADMIN_IDS   = new Set([8494250384]);
//   Example: const TELEGRAM_ADMIN_IDS = new Set([123456789, 987654321]);

/* ============ TEXT POOLS ============ */
const RAID_TEXTS = [
  "Infinity PAPA KA LUN CHUS ⃟♥️","Infinity PAPA KA LUN CHUS ⃟💔",
  "Infinity PAPA KA LUN CHUS ⃟❣️","Infinity PAPA KA LUN CHUS ⃟💕",
  "Infinity PAPA KA LUN CHUS ⃟💞","Infinity PAPA KA LUN CHUS ⃟💓",
  "Infinity PAPA KA LUN CHUS ⃟💗","Infinity PAPA KA LUN CHUS ⃟💖",
  "Infinity PAPA KA LUN CHUS ⃟💘","Infinity PAPA KA LUN CHUS ⃟💌",
  "Infinity PAPA KA LUN CHUS ⃟🩶","Infinity PAPA KA LUN CHUS ⃟🩷",
  "Infinity PAPA KA LUN CHUS ⃟🩵","Infinity PAPA KA LUN CHUS ⃟❤️‍🔥",
  "Infinity PAPA KA LUN CHUS ⃟❤️‍🩹","Infinity BAAP H TERA RNDYKE❤️‍🔥"
];

const INFINITY_TEXTS = [
  "🎀","💝","🔱","💘","💞","💢","❤️‍🔥","🌈","🪐","☄️",
  "⚡","🦚","🦈","🕸️","🍬","🧃","🗽","🪅","🎏","🎸",
  "📿","🏳️‍🌈","🌸","🎶","🎵","☃️","❄️","🕊️","🍷","🥂"
];

const NCEMO_EMOJIS = [
  "💘","🪷","🎐","🫧","💥","💢","❤️‍🔥","☘️","🪐","☄️",
  "🪽","🦚","🦈","🕸️","🍬","🧃","🗽","🪅","🎏","🎸",
  "📿","🏳️‍🌈","🌸","🎶","🎵","☃️","❄️","🕊️","🍷","🥂"
];

/* ============ DATA ============ */
const DATA_DIR      = "./data";
const SUDO_FILE     = `${DATA_DIR}/sudo.json`;
const SETTINGS_FILE = `${DATA_DIR}/settings.json`;
const OWNER_FILE    = `${DATA_DIR}/owner.json`;
const PAIRS_FILE    = `${DATA_DIR}/pairs.json`;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function loadJSON(file, def) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,"utf-8")) : def; }
  catch { return def; }
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
}

const CONFIG_FILE   = `${DATA_DIR}/config.json`;   // ← V6: saves bot count
const BACKUP_DIR    = `${DATA_DIR}/backups`;
const TG_USERS_FILE = `${DATA_DIR}/tg_users.json`; // ← Telegram panel sessions
const TG_TOKENS_FILE= `${DATA_DIR}/tg_tokens.json`;// ← Admin-generated access tokens

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

/* ── Bot-count helpers ── */
function loadConfig()       { return loadJSON(CONFIG_FILE, {}); }
function saveBotCount(n)    { const c = loadConfig(); c.botCount = n; saveJSON(CONFIG_FILE, c); }
function getSavedBotCount() { return loadConfig().botCount || null; }

const INFINITESUDO_FILE = `${DATA_DIR}/infinitesudo.json`;
let INFINITESUDO_USERS = new Set(loadJSON(INFINITESUDO_FILE, []));
function saveInfiniteSudo() { saveJSON(INFINITESUDO_FILE, [...INFINITESUDO_USERS]); }

const isInfiniteSudo = jid => {
  const b = bare(jid);
  return isOwner(jid) || INFINITESUDO_USERS.has(b) || INFINITESUDO_USERS.has(jid);
};

let SUDO_USERS = new Set(loadJSON(SUDO_FILE, []));
let settings   = loadJSON(SETTINGS_FILE, { prefix: "/", delay: 0.8 });
PREFIX       = settings.prefix || "/";
GLOBAL_DELAY = settings.delay  || 0.8;

// OWNER: first person to DM /owner claims permanent ownership
let OWNER_JID = loadJSON(OWNER_FILE, null);
function saveOwner() { saveJSON(OWNER_FILE, OWNER_JID); }

function saveSudo()     { saveJSON(SUDO_FILE, [...SUDO_USERS]); }
function saveSettings() { saveJSON(SETTINGS_FILE, { prefix: PREFIX, delay: GLOBAL_DELAY }); }

/* ============ PAIRED NUMBERS PERSISTENCE ============ */
// pairs.json: { "1": "919876543210", "2": "911234567890", ... }
let PAIRED_NUMBERS = loadJSON(PAIRS_FILE, {});
function savePairs() { saveJSON(PAIRS_FILE, PAIRED_NUMBERS); }
function recordPair(slot, phone) { PAIRED_NUMBERS[String(slot)] = phone; savePairs(); }
function removePair(slot)        { delete PAIRED_NUMBERS[String(slot)]; savePairs(); }
function getPairedNumbers()      { return Object.entries(PAIRED_NUMBERS).map(([s, p]) => `Slot ${s}: ${p}`); }

/* ============ ♾️ INFINITY ECONOMY SYSTEM ============ */
const ECONOMY_FILE   = `${DATA_DIR}/economy.json`;
const ECO_DAILY_FILE = `${DATA_DIR}/eco_daily.json`;
const ECO_PROT_FILE  = `${DATA_DIR}/eco_protect.json`;

let economy    = loadJSON(ECONOMY_FILE,   {});
let dailyLog   = loadJSON(ECO_DAILY_FILE, {});
let protection = loadJSON(ECO_PROT_FILE,  {});

function saveEco()   { saveJSON(ECONOMY_FILE,   economy); }
function saveDaily() { saveJSON(ECO_DAILY_FILE, dailyLog); }
function saveProt()  { saveJSON(ECO_PROT_FILE,  protection); }

// ── FILE PATHS declared early for BACKUP_FILES ──
const DRAGON_FILE    = `${DATA_DIR}/dragons.json`;
const DRAGON_CD_FILE = `${DATA_DIR}/dragon_cd.json`;
const ANTIWORD_FILE  = `${DATA_DIR}/antiwords.json`;

/* ============ 💾 V6 BACKUP SYSTEM ============ */
// Files to include in every backup
const BACKUP_FILES = [
  ECONOMY_FILE, ECO_DAILY_FILE, ECO_PROT_FILE,
  DRAGON_FILE, DRAGON_CD_FILE,
  SUDO_FILE, INFINITESUDO_FILE, SETTINGS_FILE, OWNER_FILE, PAIRS_FILE,
  ANTIWORD_FILE, CONFIG_FILE
];

function doBackup(tag = "auto") {
  try {
    const ts  = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.join(BACKUP_DIR, `${tag}_${ts}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of BACKUP_FILES) {
      if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dir, path.basename(f)));
    }
    // Keep only the 10 most recent auto-backups to save disk space
    if (tag === "auto") {
      const all = fs.readdirSync(BACKUP_DIR)
        .filter(d => d.startsWith("auto_"))
        .sort()
        .reverse();
      for (const old of all.slice(10)) {
        fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true, force: true });
      }
    }
    return dir;
  } catch (e) { return null; }
}

function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR).sort().reverse().slice(0, 20);
  } catch { return []; }
}

function restoreLatestBackup() {
  try {
    const all = fs.readdirSync(BACKUP_DIR).sort().reverse();
    if (!all.length) return null;
    const dir = path.join(BACKUP_DIR, all[0]);
    for (const f of BACKUP_FILES) {
      const src = path.join(dir, path.basename(f));
      if (fs.existsSync(src)) fs.copyFileSync(src, f);
    }
    // Reload all in-memory data from restored files
    economy    = loadJSON(ECONOMY_FILE,   {});
    dailyLog   = loadJSON(ECO_DAILY_FILE, {});
    protection = loadJSON(ECO_PROT_FILE,  {});
    dragons    = loadJSON(DRAGON_FILE,    {});
    dragonCD   = loadJSON(DRAGON_CD_FILE, {});
    SUDO_USERS = new Set(loadJSON(SUDO_FILE, []));
    INFINITESUDO_USERS = new Set(loadJSON(INFINITESUDO_FILE, []));
    antiwords  = loadJSON(ANTIWORD_FILE,  {});
    return all[0];
  } catch { return null; }
}

// Auto-backup every 30 minutes
setInterval(() => {
  doBackup("auto");
  console.log(`[${new Date().toLocaleTimeString()}] 💾 Auto-backup saved.`);
}, 30 * 60 * 1000);

// ── DRAGON SYSTEM ──
// dragons[jid] = { type: "charged"|"flame", evoStones: 0 }
let dragons   = loadJSON(DRAGON_FILE,    {});
let dragonCD  = loadJSON(DRAGON_CD_FILE, {}); // jid → last used timestamp
function saveDragons()  { saveJSON(DRAGON_FILE,    dragons); }
function saveDragonCD() { saveJSON(DRAGON_CD_FILE, dragonCD); }

const DRAGON_CHARGED_COST = 3000;
const DRAGON_CD_MS        = 8 * 3600000; // 8 hours
const EVO_STONE_REQ       = 1; // stones needed to evolve

function getDragon(jid) {
  const b = bare(jid);
  if (!dragons[b]) dragons[b] = { type: null, evoStones: 0 };
  return dragons[b];
}
function getDragonCooldownLeft(jid) {
  const b = bare(jid);
  const last = dragonCD[b] || 0;
  const diff = Date.now() - last;
  return diff < DRAGON_CD_MS ? DRAGON_CD_MS - diff : 0;
}

function getEco(jid) {
  const b = bare(jid);
  if (!economy[b]) economy[b] = { bal: 0, kills: 0, dead: false };
  return economy[b];
}
function isProtected(jid) {
  const b = bare(jid);
  return protection[b] && protection[b] > Date.now();
}
function fmt$(n) { return `$${Number(n).toLocaleString()}`; }

const ECO_DAILY_BASE = 250;
const ECO_ROB_MAX    = 10000;
const ECO_ROB_TAX    = 0.10;
const ECO_GIVE_TAX   = 0.10;
const ECO_KILL_MIN   = 100;
const ECO_KILL_MAX   = 200;
const ECO_PROT_MS    = 86400000;

// ── PROTECTION PRICES ──
const ECO_PROT_PRICES = { 1: 1000, 2: 1700, 3: 3300 };

// ── RANKING LEVELS (by balance) ──
// Protection costs: 1d=$1,000 | 2d=$1,700 | 3d=$3,300
// Daily is intentionally slow — even max rank needs ~33 days to afford 3d protection
const RANKS = [
  { name: "🪨 Broke",       min: 0,      bonus: 50   },
  { name: "🥉 Starter",     min: 1000,   bonus: 75   },
  { name: "🥈 Hustler",     min: 5000,   bonus: 100  },
  { name: "🥇 Earner",      min: 15000,  bonus: 130  },
  { name: "💎 Rich",        min: 50000,  bonus: 160  },
  { name: "💠 Elite",       min: 100000, bonus: 190  },
  { name: "🔱 Legend",      min: 250000, bonus: 220  },
  { name: "♾️ Infinity",    min: 500000, bonus: 250  },
];

function getRank(bal) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (bal >= RANKS[i].min) return RANKS[i];
  }
  return RANKS[0];
}

// ── ANTIWORD SYSTEM ──
let antiwords = loadJSON(ANTIWORD_FILE, {}); // { chatId: [word, word, ...] }
function saveAntiwords() { saveJSON(ANTIWORD_FILE, antiwords); }

/* ─── MINI GAME STATE ─── */
const ecoGames = new Map(); // key → game session

/* ============ SESSION STATE ============ */
const group_tasks       = new Map();
const infinity_tasks    = new Map();
const spam_tasks        = new Map();
const react_tasks       = new Map(); // chatId -> emoji string (legacy emojispam)
const domain_tasks      = new Map();
const slide_targets     = new Set();
const slidespam_targets = new Set();

// ── V7: RAID ACTIVATION — per-chat unlock for raid/spam commands ──
// sudo/owner must type /activateinfinity in a chat to unlock these
const raidActivated     = new Set(); // Set<chatId>
const YTS_CACHE         = new Map();
const VIDEO_REQUESTS    = new Map();
const TTS_LANG          = new Map();
const START_TIME        = Date.now();
const allSocks          = [];

// ── NEW REACT / WELCOME STATE ──
const autoreact_chats  = new Set(); // chatId → random react on every msg
const heartreact_chats = new Set(); // chatId → ❤️ react on every msg
const reactlock_map    = new Map(); // chatId → Map<bareJid, emoji>
const welcome_chats    = new Set(); // chatId → send welcome on join

const RANDOM_REACTS = [
  "❤️","🔥","😂","😮","😢","👍","🎉","🥰","😍","💯",
  "✨","🙌","👏","💀","😭","🤣","😱","🤩","😎","💪",
  "🫶","🥳","😝","🤯","💫","⚡","🌟","🎀","💘","🦋"
];

/* ============ UI BUILDER (WhatsApp formatting) ============ */
const _ui = {
  build: (...parts) => parts.filter(Boolean).join("\n"),
  head:  (emoji, title) => `${emoji} *${title}*\n━━━━━━━━━━━━━━━━━━━━━━━`,
  div:   ()             => `━━━━━━━━━━━━━━━━━━━━━━━`,
  row:   (label, value) => `> ${label}: ${value}`,
  line:  (text)         => `> ${text}`,
  err:   (text)         => `❌ ${text}`,
  warn:  (text)         => `⚠️ ${text}`,
};
const log  = (...a) => console.log(`[${new Date().toLocaleTimeString()}]`, ...a);
const bare = jid => jid?.split(":")[0];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const formatUptime = ms => {
  const s = Math.floor(ms/1000);
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${s%60}s`;
};

const isOwner = jid => {
  if (!OWNER_JID) return false;
  const b = bare(jid);
  return b === bare(OWNER_JID) || jid === OWNER_JID;
};

const isSudo = jid => {
  const b = bare(jid);
  return isOwner(jid) || isInfiniteSudo(jid) || SUDO_USERS.has(b) || SUDO_USERS.has(jid);
};

const isCmd = (text, cmd) =>
  text === `${PREFIX}${cmd}` || text.startsWith(`${PREFIX}${cmd} `);

const getArg = text =>
  text.slice(PREFIX.length).trim().split(" ").slice(1).join(" ");

/* ================================================================
   SPEED ENGINE — Telegram-style parallel burst execution
   
   Root cause of NC not working:
   1. setTimeout-based loops are SEQUENTIAL — each bot waits for
      the previous one. Telegram used asyncio.gather() which runs
      ALL bots SIMULTANEOUSLY.
   2. Fixed: each bot gets its own independent async loop that
      never waits for other bots — true parallel like Telegram.
   3. Burst mode: fires 30 requests at once per bot (like Telegram's
      batch of 30-50), then immediately fires the next burst.
   ================================================================ */

// Independent async worker — never stops until cancelled
// Each bot gets ONE of these, they ALL run at the same time
// Error backoff: if fn() throws 3x in a row, sleep 500ms to avoid CPU spike
function makeWorker(fn) {
  let alive = true;
  let errStreak = 0;
  (async () => {
    while (alive) {
      try {
        await fn();
        errStreak = 0;
      } catch {
        errStreak++;
        if (errStreak >= 3) {
          await new Promise(r => setTimeout(r, 500)); // cool down on repeated errors
          errStreak = 0;
        }
      }
    }
  })();
  return { cancel: () => { alive = false; } };
}

function stopTasks(map, chatId) {
  if (!map.has(chatId)) return false;
  const workers = map.get(chatId);
  if (Array.isArray(workers)) workers.forEach(w => w?.cancel?.());
  else workers?.cancel?.();
  map.delete(chatId);
  return true;
}

/* ── NC: each sock runs its own loop independently (parallel) ── */

// GCNC — RAID style
// Each bot fires continuously, all in parallel like asyncio.gather
function startGCNC(socks, chatId, base) {
  stopTasks(group_tasks, chatId);
  let i = 0;
  const workers = socks.map(sock => makeWorker(async () => {
    const title = `${base} ${RAID_TEXTS[i++ % RAID_TEXTS.length]}`;
    await sock.groupUpdateSubject(chatId, title).catch(() => {});
    await sleep(50); // 50ms — stable speed, no crash
  }));
  group_tasks.set(chatId, workers);
}

// NCEMO — emoji style
function startNCEMO(socks, chatId, base) {
  stopTasks(group_tasks, chatId);
  let i = 0;
  const workers = socks.map(sock => makeWorker(async () => {
    const title = `${base} ${NCEMO_EMOJIS[i++ % NCEMO_EMOJIS.length]}`;
    await sock.groupUpdateSubject(chatId, title).catch(() => {});
    await sleep(50);
  }));
  group_tasks.set(chatId, workers);
}

// NCBAAP — GOD LEVEL: each bot fires a BURST of 30 simultaneously
function startNCBAAP(socks, chatId, base) {
  stopTasks(group_tasks, chatId);
  const workers = socks.map(sock => {
    let i = 0;
    return makeWorker(async () => {
      const burst = [];
      for (let j = 0; j < 30; j++) {
        const title = `${base} ${RAID_TEXTS[(i + j) % RAID_TEXTS.length]}`;
        burst.push(sock.groupUpdateSubject(chatId, title).catch(() => {}));
      }
      i = (i + 30) % RAID_TEXTS.length;
      await Promise.all(burst);
      await sleep(50);
    });
  });
  group_tasks.set(chatId, workers);
}

// INFINITY — cycling emojis, full parallel
function startInfinity(socks, chatId, base) {
  stopTasks(infinity_tasks, chatId);
  let i = 0;
  const workers = socks.map(sock => makeWorker(async () => {
    const title = `${base} ${INFINITY_TEXTS[i++ % INFINITY_TEXTS.length]}`;
    await sock.groupUpdateSubject(chatId, title).catch(() => {});
    await sleep(50);
  }));
  infinity_tasks.set(chatId, workers);
}

// INFINITYFAST — faster burst, 50ms between waves
function startInfinityFast(socks, chatId, base) {
  stopTasks(infinity_tasks, chatId);
  let i = 0;
  const workers = socks.map(sock => makeWorker(async () => {
    const title = `${base} ${INFINITY_TEXTS[i++ % INFINITY_TEXTS.length]}`;
    await sock.groupUpdateSubject(chatId, title).catch(() => {});
    await sleep(50);
  }));
  infinity_tasks.set(chatId, workers);
}

// INFINITYGODSPEED — DEMONIC EDITION 😈
// Each bot fires 3 overlapping waves of 200 simultaneously
// 50ms pause between cycles keeps connection alive
function startInfinityGodspeed(socks, chatId, base) {
  stopTasks(infinity_tasks, chatId);
  const workers = socks.map(sock => {
    let i = 0;
    return makeWorker(async () => {
      const wave1 = [];
      for (let j = 0; j < 200; j++) {
        const title = `${base} ${INFINITY_TEXTS[(i + j) % INFINITY_TEXTS.length]}`;
        wave1.push(sock.groupUpdateSubject(chatId, title).catch(() => {}));
      }
      i = (i + 200) % INFINITY_TEXTS.length;

      const wave2 = [];
      for (let j = 0; j < 200; j++) {
        const title = `${base} ${INFINITY_TEXTS[(i + j) % INFINITY_TEXTS.length]}`;
        wave2.push(sock.groupUpdateSubject(chatId, title).catch(() => {}));
      }
      i = (i + 200) % INFINITY_TEXTS.length;

      const wave3 = [];
      for (let j = 0; j < 200; j++) {
        const title = `${base} ${INFINITY_TEXTS[(i + j) % INFINITY_TEXTS.length]}`;
        wave3.push(sock.groupUpdateSubject(chatId, title).catch(() => {}));
      }
      i = (i + 200) % INFINITY_TEXTS.length;

      await Promise.all([...wave1, ...wave2, ...wave3]);
      await sleep(50); // 50ms breath between godspeed cycles
    });
  });
  infinity_tasks.set(chatId, workers);
}

// SPAM — all bots fire simultaneously
function startSpam(socks, chatId, spamText) {
  stopTasks(spam_tasks, chatId);
  const workers = socks.map(sock => makeWorker(async () => {
    await sock.sendMessage(chatId, { text: spamText }).catch(() => {});
    await sleep(50);
  }));
  spam_tasks.set(chatId, workers);
}

// DOMAIN EXPANSION — XR EDITION 😈♾️
// Each bot fires 3 overlapping waves of 200 simultaneously — NONSTOP.
// Watcher is 250ms — catches reverts fast, stays stable.
function startDomainExpansion(socks, chatId, base, mode) {
  stopTasks(domain_tasks, chatId);
  const pool = mode === "ncemo" ? NCEMO_EMOJIS
             : mode === "infinity" ? INFINITY_TEXTS
             : RAID_TEXTS;

  const ncWorkers = socks.map(sock => {
    let i = 0;
    return makeWorker(async () => {
      const wave1 = [];
      for (let j = 0; j < 200; j++) {
        wave1.push(sock.groupUpdateSubject(chatId, `${base} ${pool[(i + j) % pool.length]}`).catch(() => {}));
      }
      i = (i + 200) % pool.length;

      const wave2 = [];
      for (let j = 0; j < 200; j++) {
        wave2.push(sock.groupUpdateSubject(chatId, `${base} ${pool[(i + j) % pool.length]}`).catch(() => {}));
      }
      i = (i + 200) % pool.length;

      const wave3 = [];
      for (let j = 0; j < 200; j++) {
        wave3.push(sock.groupUpdateSubject(chatId, `${base} ${pool[(i + j) % pool.length]}`).catch(() => {}));
      }
      i = (i + 200) % pool.length;

      await Promise.all([...wave1, ...wave2, ...wave3]);
      await sleep(50); // 50ms breath — keeps event loop alive
    });
  });

  // Watcher: 250ms — fast revert detection, stable
  let watching = true;
  (async () => {
    while (watching) {
      try {
        await sleep(250);
        if (!watching) break;
        const meta = await socks[0]?.groupMetadata(chatId).catch(() => null);
        if (meta?.subject && !meta.subject.toLowerCase().includes(base.toLowerCase())) {
          const revertBurst = [];
          for (const s of socks) {
            for (let r = 0; r < 10; r++) {
              revertBurst.push(s.groupUpdateSubject(chatId, `${base} 😈♾️`).catch(() => {}));
            }
          }
          await Promise.all(revertBurst);
        }
      } catch {}
    }
  })();

  domain_tasks.set(chatId, [
    ...ncWorkers,
    { cancel: () => { watching = false; } }
  ]);
}


/* ============ HELP ============ */
function getHelp(raidUnlocked = false) {
  const base =
`♾️ *INFINITY BOT V9*
━━━━━━━━━━━━━━━━━━━━━━━

🎵 *MUSIC* _(GC members can use)_
> ${PREFIX}yts <song>  →  Search YouTube
> ${PREFIX}song        →  Download MP3
> ${PREFIX}video       →  Download Video
> ${PREFIX}tts <text>  →  Text to Speech
> ${PREFIX}setlang <code>  →  Set TTS language

━━━━━━━━━━━━━━━━━━━━━━━
🎮 *GAMES & ECONOMY* _(GC members can use)_
> ${PREFIX}claim        →  Join economy
> ${PREFIX}daily        →  Claim daily coins
> ${PREFIX}bal          →  Check balance
> ${PREFIX}rank         →  Your rank info
> ${PREFIX}profile      →  Your profile card
> ${PREFIX}rob (reply) <code>  →  Rob someone
> ${PREFIX}kill (reply)        →  Kill someone
> ${PREFIX}revive (reply)      →  Revive player
> ${PREFIX}protect <1/2/3>     →  Buy protection
> ${PREFIX}give (reply) <amt>  →  Send money
> ${PREFIX}toprich / ${PREFIX}topkill   →  Leaderboards
> ${PREFIX}coinflip <bet> <h/t>
> ${PREFIX}dice <bet> <1-6>
> ${PREFIX}slots <bet>
> ${PREFIX}rps <bet> <r/p/s>
> ${PREFIX}ecohelp  →  Full economy guide

━━━━━━━━━━━━━━━━━━━━━━━
🐉 *DRAGON SYSTEM* _(GC members can use)_
> ${PREFIX}dragons           →  Shop & info
> ${PREFIX}buydragon charged →  Buy Dragon ($3,000)
> ${PREFIX}evolvedragon      →  Evolve to Flame Dragon
> ${PREFIX}usedragon (reply) →  Break protection

━━━━━━━━━━━━━━━━━━━━━━━
🏘️ *GC MANAGEMENT* _(Sudo only)_
> ${PREFIX}gcinfo / ${PREFIX}gclink / ${PREFIX}revokelink
> ${PREFIX}gcdesc <text>  →  Change description
> ${PREFIX}gclock / ${PREFIX}gcunlock
> ${PREFIX}gcmute / ${PREFIX}gcunmute
> ${PREFIX}add <number> / ${PREFIX}kick (reply)
> ${PREFIX}promote / ${PREFIX}demote (reply)
> ${PREFIX}kickall / ${PREFIX}tagall / ${PREFIX}adminlist
> ${PREFIX}welcome on/off
> ${PREFIX}addword / ${PREFIX}delword / ${PREFIX}wordlist

━━━━━━━━━━━━━━━━━━━━━━━
🤖 *BOT* _(Sudo only)_
> ${PREFIX}ping / ${PREFIX}status / ${PREFIX}delay <sec>
> ${PREFIX}prefix <new>
> ${PREFIX}addsudo / ${PREFIX}delsudo / ${PREFIX}listsudo (reply)
> ${PREFIX}pair <number> / ${PREFIX}listpairs / ${PREFIX}removepair <n>

━━━━━━━━━━━━━━━━━━━━━━━
💾 *V6 DATA SAVE* _(Owner only)_
> ${PREFIX}setbots <n>       →  Save bot count (remembered on restart)
> ${PREFIX}backup            →  Manual backup all player data NOW
> ${PREFIX}restorebackup     →  Restore from most recent backup
> ${PREFIX}listbackups       →  Show all saved backups

━━━━━━━━━━━━━━━━━━━━━━━
🔐 *RAID MODE* _(Sudo only)_
> ${PREFIX}activateinfinity    →  Unlock raid & spam commands
> ${PREFIX}deactivateinfinity  →  Lock them back`;

  const raidSection = `

━━━━━━━━━━━━━━━━━━━━━━━
💥 *SPAM & REACT* 🔓 _(Unlocked)_
> ${PREFIX}spam <text> / ${PREFIX}unspam
> ${PREFIX}emojispam <emoji> / ${PREFIX}stopemojispam
> ${PREFIX}autoreact / ${PREFIX}stopautoreact
> ${PREFIX}heartreact on/off
> ${PREFIX}reactlock <emoji> (reply)
> ${PREFIX}stopreactlock

━━━━━━━━━━━━━━━━━━━━━━━
💀 *RAID CMDS* 🔓 _(Unlocked)_
> ${PREFIX}gcnc / ${PREFIX}ncemo / ${PREFIX}ncbaap <text>
> ${PREFIX}infinity / ${PREFIX}infinityfast / ${PREFIX}infinitygodspeed <text>
> ${PREFIX}domainexpansiongcnc/ncemo/ncbaap/infinity <text>
> ${PREFIX}targetslide / ${PREFIX}slidespam (reply)
> ${PREFIX}stopall  →  Stop everything`;

  const lockedNotice = `

━━━━━━━━━━━━━━━━━━━━━━━
🔒 *RAID & SPAM COMMANDS — LOCKED*
Type *${PREFIX}activateinfinity* to unlock them in this chat.`;

  return base + (raidUnlocked ? raidSection : lockedNotice) + `\n\n♾️ _Infinity V7 — Stealth Mode_`;
}

/* ============ BOT START ============ */
async function startBot(botId) {
  const authDir = `./auth_bot_${botId}`;
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: ["Infinity Bot", "Chrome", "1.0"],
  });
  sock.ev.on("creds.update", saveCreds);
  allSocks[botId - 1] = sock;

  // ── WELCOME on new member join ──
  sock.ev.on("group-participants.update", async ({ id: chatId, participants, action }) => {
    if (action !== "add") return;
    if (!welcome_chats.has(chatId)) return;
    try {
      const meta = await sock.groupMetadata(chatId);
      for (const jid of participants) {
        const num = jid.split("@")[0];
        const welcomeText =
          `✦ *Welcome to ${meta.subject}* ✦\n\n` +
          `👤 @${num}\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🌟 Glad to have you here!\n` +
          `📌 Read the group rules.\n` +
          `🤝 Respect everyone.\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `🎉 *You're member #${meta.participants.length}*`;
        await sock.sendMessage(chatId, {
          text: welcomeText,
          mentions: [jid]
        });
      }
    } catch {}
  });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") log(`✅ BOT ${botId} — INFINITY ONLINE`);
    if (connection === "close" &&
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      log(`🔄 BOT ${botId} reconnecting in 3s...`);
      setTimeout(() => startBot(botId), 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        const chatId = msg.key.remoteJid;
        if (!chatId) continue;
        const isGroup = chatId.endsWith("@g.us");
        const sender  = isGroup ? (msg.key.participant || msg.participant) : msg.key.remoteJid;
        if (!sender) continue;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const activeSocks = allSocks.filter(Boolean);

        // ── ANTIWORD ENFORCEMENT — silent delete only ──
        if (isGroup && text && !msg.key.fromMe && antiwords[chatId]?.length) {
          const lowerText = text.toLowerCase();
          const hit = antiwords[chatId].find(w => lowerText.includes(w.toLowerCase()));
          if (hit) {
            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch {}
            continue;
          }
        }

        // ── AUTO REACT ENGINE (runs on ALL bots) ──
        if (!msg.key.fromMe && msg.key.id && isGroup) {
          const senderBare = bare(sender);

          // 1. heartreact — ❤️ on everyone
          if (heartreact_chats.has(chatId)) {
            try { await sock.sendMessage(chatId, { react: { text: "❤️", key: msg.key } }); } catch {}
          }
          // 2. autoreact — random emoji on everyone (skip if heartreact already fired)
          else if (autoreact_chats.has(chatId)) {
            const r = RANDOM_REACTS[Math.floor(Math.random() * RANDOM_REACTS.length)];
            try { await sock.sendMessage(chatId, { react: { text: r, key: msg.key } }); } catch {}
          }

          // 3. reactlock — emoji locked to specific users (runs independently)
          if (reactlock_map.has(chatId)) {
            const lockMap = reactlock_map.get(chatId);
            if (lockMap.has(senderBare)) {
              const emoji = lockMap.get(senderBare);
              try { await sock.sendMessage(chatId, { react: { text: emoji, key: msg.key } }); } catch {}
            }
          }

          // 4. legacy emojispam react
          if (react_tasks.has(chatId)) {
            try { await sock.sendMessage(chatId, { react: { text: react_tasks.get(chatId), key: msg.key } }); } catch {}
          }
        }

        // SLIDE auto-reply (runs on ALL bots)
        if (slide_targets.has(bare(sender))) {
          for (let k = 0; k < 3; k++) {
            try { await sock.sendMessage(chatId, { text: RAID_TEXTS[k] }, { quoted: msg }); } catch {}
            await sleep(100);
          }
        }
        if (slidespam_targets.has(bare(sender))) {
          for (const t of RAID_TEXTS) {
            try { await sock.sendMessage(chatId, { text: t }, { quoted: msg }); } catch {}
            await sleep(50);
          }
        }

        // ── Only Bot #1 sends command replies ──
        if (botId !== 1) continue;

        // ── /owner CLAIM (DM only, before any auth check) ──
        if (text.trim() === "/owner" && !isGroup) {
          if (OWNER_JID) {
            await sock.sendMessage(chatId, {
              text: "👑 *Owner already claimed.*\nThis bot already has an owner."
            }, { quoted: msg });
          } else {
            OWNER_JID = bare(sender);
            saveOwner();
            SUDO_USERS.add(bare(sender));
            saveSudo();
            await sock.sendMessage(chatId, {
              text:
                "╔══════════════════════╗\n" +
                "║  👑  O W N E R        ║\n" +
                "║     C L A I M E D  ✅  ║\n" +
                "╚══════════════════════╝\n\n" +
                "You are now the permanent owner of\n" +
                "*INFINITY BOT V5* ♾️\n\n" +
                "You have full access to all commands.\n" +
                `Send ${PREFIX}help to see all commands.`
            }, { quoted: msg });
            log(`👑 Owner claimed by: ${sender}`);
          }
          continue;
        }

        if (!text.startsWith(PREFIX)) continue;

        // Commands GC members (non-sudo) are allowed to use — song, entertainment, games
        const GC_MEMBER_CMDS = new Set([
          "yts","song","video","tts","setlang",
          "claim","daily","bal","rank","profile","rob","kill","revive",
          "protect","give","toprich","topkill","ecohelp",
          "coinflip","dice","slots","rps",
          "dragons","buydragon","evolvedragon","usedragon",
          "help","start","menu"
        ]);
        const cmdName = text.slice(PREFIX.length).trim().split(/\s+/)[0].toLowerCase();
        const isGCMemberCmd = isGroup && GC_MEMBER_CMDS.has(cmdName);

        if (!isSudo(sender) && !isGCMemberCmd) {
          // If no owner yet, tell them how to claim
          if (!OWNER_JID && !isGroup) {
            await sock.sendMessage(chatId, {
              text: "⚠️ No owner set yet.\nSend */owner* in DM to claim ownership."
            }, { quoted: msg });
          } else {
            await sock.sendMessage(chatId, { text: "Hat Garib 🤡🤬" }, { quoted: msg });
          }
          continue;
        }

        // ── HELP ──
        if (isCmd(text,"help") || isCmd(text,"start") || isCmd(text,"menu")) {
          const helpText = getHelp(raidActivated.has(chatId));
          try {
            if (fs.existsSync(MENU_IMAGE)) {
              await sock.sendMessage(chatId, {
                image: fs.readFileSync(MENU_IMAGE),
                caption: helpText
              }, { quoted: msg });
            } else {
              await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
            }
          } catch {
            await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
          }
          continue;
        }

        // ── MY OWNER ──
        if (isCmd(text,"myowner")) {
          await sock.sendMessage(chatId, {
            text: OWNER_JID
              ? `👑 *Owner:* @${OWNER_JID.split("@")[0]}`
              : "⚠️ No owner claimed yet. DM the bot and send */owner*"
          }, { quoted: msg, mentions: OWNER_JID ? [OWNER_JID + "@s.whatsapp.net"] : [] });
          continue;
        }

        // ── PING ──
        if (isCmd(text,"ping")) {
          const t = Date.now();
          const s = await sock.sendMessage(chatId, { text: "🏓 Pinging..." }, { quoted: msg });
          await sock.sendMessage(chatId, { text: `🏓 Pong! *${Date.now()-t}ms*` }, { quoted: s });
          continue;
        }

        // ── STATUS ──
        if (isCmd(text,"status")) {
          const tot=os.totalmem(), fr=os.freemem();
          await sock.sendMessage(chatId, { text:
            `📊 *INFINITY BOT V9 STATUS*\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> 🎀 NC: ${group_tasks.size} active\n` +
            `> ♾️ Infinity: ${infinity_tasks.size} active\n` +
            `> 😹 Spam: ${spam_tasks.size} active\n` +
            `> ✨ Auto React: ${autoreact_chats.size} chats\n` +
            `> ❤️ Heart React: ${heartreact_chats.size} chats\n` +
            `> 🔒 React Lock: ${reactlock_map.size} chats\n` +
            `> 🎉 Welcome: ${welcome_chats.size} chats\n` +
            `> 🥷 Slide Targets: ${slide_targets.size}\n` +
            `> 💥 Slide Spam: ${slidespam_targets.size}\n` +
            `> 😈 Domain Expansion: ${domain_tasks.size}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `> ⏱ Delay: ${GLOBAL_DELAY}s\n` +
            `> 🤖 Bots: ${activeSocks.length}\n` +
            `> 👑 SUDO: ${SUDO_USERS.size}\n` +
            `> 💾 RAM: ${((tot-fr)/1024/1024).toFixed(0)}MB/${(tot/1024/1024).toFixed(0)}MB\n` +
            `> ⏳ Uptime: ${formatUptime(Date.now()-START_TIME)}`
          }, { quoted: msg });
          continue;
        }

        // ── DELAY ──
        if (isCmd(text,"delay")) {
          const v = parseFloat(getArg(text));
          if (isNaN(v)||v<0.1) { await sock.sendMessage(chatId,{text:`⏱ Delay: *${GLOBAL_DELAY}s*\nUsage:
> ${PREFIX}delay 0.5`},{quoted:msg}); continue; }
          GLOBAL_DELAY=v; saveSettings();
          await sock.sendMessage(chatId,{text:`✅ Delay: *${v}s*`},{quoted:msg}); continue;
        }

        // ── PREFIX ──
        if (isCmd(text,"prefix")) {
          const np=getArg(text);
          if (!np||np.length>3) { await sock.sendMessage(chatId,{text:`❌ Usage:
> ${PREFIX}prefix !`},{quoted:msg}); continue; }
          const old=PREFIX; PREFIX=np; saveSettings();
          await sock.sendMessage(chatId,{text:`✅ Prefix: ${old} → ${PREFIX}`},{quoted:msg}); continue;
        }

        // ── V7: ACTIVATE / DEACTIVATE INFINITY (raid mode toggle) ──
        if (isCmd(text,"activateinfinity")) {
          if (!isSudo(sender)) { await sock.sendMessage(chatId,{text:"❌ Only Sudo/Owner can activate raid mode."},{quoted:msg}); continue; }
          raidActivated.add(chatId);
          await sock.sendMessage(chatId,{
            text:
              `♾️ *INFINITY ACTIVATED* 🔓\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `> 💀 Raid & Spam commands are now *UNLOCKED* in this chat.\n` +
              `> Use *${PREFIX}help* to see all available commands.\n` +
              `> Use *${PREFIX}deactivateinfinity* to lock them again.`
          },{quoted:msg}); continue;
        }

        if (isCmd(text,"deactivateinfinity")) {
          if (!isSudo(sender)) { await sock.sendMessage(chatId,{text:"❌ Only Sudo/Owner."},{quoted:msg}); continue; }
          // Also stop all active raid tasks in this chat when deactivating
          stopTasks(group_tasks, chatId);
          stopTasks(infinity_tasks, chatId);
          stopTasks(spam_tasks, chatId);
          stopTasks(domain_tasks, chatId);
          react_tasks.delete(chatId);
          raidActivated.delete(chatId);
          await sock.sendMessage(chatId,{
            text:
              `🔒 *Infinity Mode DEACTIVATED*\n` +
              `> All raid & spam commands are locked.\n` +
              `> Any active tasks have been stopped.`
          },{quoted:msg}); continue;
        }

        // ── RAID GATE — all commands below require /activateinfinity ──
        // Only blocks raid/spam commands, not regular ones
        const RAID_CMDS = new Set([
          "gcnc","ncemo","ncbaap","stopgcnc","stopncemo","stopncbaap",
          "infinity","infinityfast","infinitygodspeed","stopinfinity",
          "domainexpansion","domainexpansiongcnc","domainexpansionncemo",
          "domainexpansionncbaap","domainexpansioninfinity","stopdomainexpansion",
          "spam","unspam","emojispam","stopemojispam",
          "autoreact","stopautoreact","heartreact",
          "reactlock","stopreactlock",
          "targetslide","stopslide","slidespam","stopslidespam","stopall"
        ]);

        if (RAID_CMDS.has(cmdName) && !raidActivated.has(chatId)) {
          await sock.sendMessage(chatId,{
            text:
              `🔒 *Raid Mode is LOCKED*\n` +
              `> Type *${PREFIX}activateinfinity* first to unlock raid & spam commands.\n` +
              `> _(Sudo/Owner only)_`
          },{quoted:msg}); continue;
        }

        // ── GCNC ──
        if (isCmd(text,"gcnc")) {
          const base=getArg(text);
          if (!base) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}gcnc <text>`},{quoted:msg}); continue; }
          startGCNC(activeSocks,chatId,base);
          await sock.sendMessage(chatId,{text:"🔄 *GC NAME CHANGER STARTED!*\n> RAID style 💀"},{quoted:msg}); continue;
        }

        // ── NCEMO ──
        if (isCmd(text,"ncemo")) {
          const base=getArg(text);
          if (!base) { await sock.sendMessage(chatId,{text:`⚠️ Usage:\n> ${PREFIX}ncemo <text>`},{quoted:msg}); continue; }
          startNCEMO(activeSocks,chatId,base);
          await sock.sendMessage(chatId,{text:"🎭 *EMOJI NAME CHANGER STARTED!*"},{quoted:msg}); continue;
        }

        // ── NCBAAP ──
        if (isCmd(text,"ncbaap")) {
          const base=getArg(text);
          if (!base) { await sock.sendMessage(chatId,{text:`⚠️ Usage:\n> ${PREFIX}ncbaap <text>`},{quoted:msg}); continue; }
          startNCBAAP(activeSocks,chatId,base);
          await sock.sendMessage(chatId,{text:"👑 *GOD LEVEL NCBAAP ACTIVATED!*\n> 5 NC in 0.1s 🚀"},{quoted:msg}); continue;
        }

        if (isCmd(text,"stopgcnc")||isCmd(text,"stopncemo")||isCmd(text,"stopncbaap")) {
          const ok=stopTasks(group_tasks,chatId);
          await sock.sendMessage(chatId,{text:ok?"⏹ *Name Changer Stopped!*":"❌ No active NC"},{quoted:msg}); continue;
        }

        // ── INFINITY ──
        if (isCmd(text,"infinity")) {
          const base=getArg(text);
          if (!base) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}infinity <text>`},{quoted:msg}); continue; }
          startInfinity(activeSocks,chatId,base);
          await sock.sendMessage(chatId,{text:"💀 *Infinity Mode Activated!*"},{quoted:msg}); continue;
        }

        if (isCmd(text,"infinityfast")) {
          const base=getArg(text);
          if (!base) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}infinityfast <text>`},{quoted:msg}); continue; }
          startInfinityFast(activeSocks,chatId,base);
          await sock.sendMessage(chatId,{text:"⚡ *FAST Infinity Activated!*"},{quoted:msg}); continue;
        }

        if (isCmd(text,"infinitygodspeed")) {
          const base=getArg(text);
          if (!base) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}infinitygodspeed <text>`},{quoted:msg}); continue; }
          startInfinityGodspeed(activeSocks,chatId,base);
          await sock.sendMessage(chatId,{text:"😈🔥 *DEMONIC GODSPEED ACTIVATED!*\n> 600 NC per bot per cycle — faster than a blink 👁️⚡"},{quoted:msg}); continue;
        }

        if (isCmd(text,"stopinfinity")) {
          const ok=stopTasks(infinity_tasks,chatId);
          await sock.sendMessage(chatId,{text:ok?"🛑 *Infinity Stopped!*":"❌ No active Infinity"},{quoted:msg}); continue;
        }

        // ── DOMAIN EXPANSION ──
        const domainCmds = [
          ["domainexpansiongcnc","gcnc"],
          ["domainexpansionncemo","ncemo"],
          ["domainexpansionncbaap","ncbaap"],
          ["domainexpansioninfinity","infinity"],
          ["domainexpansion","gcnc"],
        ];
        let domainHandled = false;
        for (const [cmd,mode] of domainCmds) {
          if (isCmd(text,cmd)) {
            const base=getArg(text);
            if (!base) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}${cmd} <text>`},{quoted:msg}); domainHandled=true; break; }
            startDomainExpansion(activeSocks,chatId,base,mode);
            const modeLabels={gcnc:"💀 GCNC",ncemo:"🎭 NCEMO",ncbaap:"👑 NCBAAP",infinity:"♾️ INFINITY"};
            const cap =
              `╔══════════════════════════════╗\n` +
              `║   😈  D O M A I N           ║\n` +
              `║      E X P A N S I O N  ♾️  ║\n` +
              `╚══════════════════════════════╝\n\n` +
              `  📛  Base : ${base}\n` +
              `  ⚙️  Mode : ${modeLabels[mode]||mode}\n` +
              `  ⚡  Bots : ${activeSocks.length}\n\n` +
              `  ◈ Name cycling — ENGAGED\n` +
              `  ◈ Watcher — ONLINE\n\n` +
              `  ➡ ${PREFIX}stopdomainexpansion to lift`;
            try { await sock.sendMessage(chatId,{image:{url:DOMAIN_EXPANSION_IMAGE},caption:cap},{quoted:msg}); }
            catch { await sock.sendMessage(chatId,{text:cap},{quoted:msg}); }
            domainHandled=true; break;
          }
        }
        if (domainHandled) continue;

        if (isCmd(text,"stopdomainexpansion")) {
          const ok=stopTasks(domain_tasks,chatId);
          await sock.sendMessage(chatId,{text:ok?"✅ *Domain Expansion LIFTED.*\n♾️ The barrier is gone.":"❌ No active Domain Expansion"},{quoted:msg}); continue;
        }

        // ── SPAM ──
        if (isCmd(text,"spam")) {
          const st=getArg(text);
          if (!st) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}spam <text>`},{quoted:msg}); continue; }
          startSpam(activeSocks,chatId,st);
          await sock.sendMessage(chatId,{text:"💥 *SPAM STARTED!*"},{quoted:msg}); continue;
        }
        if (isCmd(text,"unspam")) {
          const ok=stopTasks(spam_tasks,chatId);
          await sock.sendMessage(chatId,{text:ok?"🛑 *Spam Stopped!*":"❌ No active spam"},{quoted:msg}); continue;
        }

        // ── EMOJI SPAM (legacy) ──
        if (isCmd(text,"emojispam")) {
          const emoji=getArg(text)?.trim();
          if (!emoji) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}emojispam 😈`},{quoted:msg}); continue; }
          react_tasks.set(chatId,emoji);
          await sock.sendMessage(chatId,{text:`🎭 *Auto-react ON:* ${emoji}\n> Stop: ${PREFIX}stopemojispam`},{quoted:msg}); continue;
        }
        if (isCmd(text,"stopemojispam")) {
          react_tasks.delete(chatId);
          await sock.sendMessage(chatId,{text:"🛑 *Reactions Stopped!*"},{quoted:msg}); continue;
        }

        // ── AUTOREACT (random emoji on everyone's messages) ──
        if (isCmd(text,"autoreact")) {
          if (autoreact_chats.has(chatId)) {
            autoreact_chats.delete(chatId);
            await sock.sendMessage(chatId,{text:"🛑 *Auto React OFF*"},{quoted:msg});
          } else {
            autoreact_chats.add(chatId);
            heartreact_chats.delete(chatId); // disable heart if active
            await sock.sendMessage(chatId,{text:`✨ *Auto React ON*\n> Reacting every message with random emojis!\n> Stop: ${PREFIX}stopautoreact`},{quoted:msg});
          }
          continue;
        }
        if (isCmd(text,"stopautoreact")) {
          autoreact_chats.delete(chatId);
          heartreact_chats.delete(chatId);
          await sock.sendMessage(chatId,{text:"🛑 *Auto React OFF*"},{quoted:msg}); continue;
        }

        // ── HEARTREACT (❤️ on everyone's messages) ──
        if (isCmd(text,"heartreact")) {
          const arg = getArg(text).trim().toLowerCase();
          if (arg === "on") {
            heartreact_chats.add(chatId);
            autoreact_chats.delete(chatId); // disable random if active
            await sock.sendMessage(chatId,{text:`❤️ *Heart React ON*\n> Reacting every message with ❤️\n> Turn off: ${PREFIX}heartreact off`},{quoted:msg});
          } else {
            heartreact_chats.delete(chatId);
            await sock.sendMessage(chatId,{text:"🛑 *Heart React OFF*"},{quoted:msg});
          }
          continue;
        }

        // ── REACTLOCK (lock emoji reaction on specific user/s) ──
        // Usage: /reactlock 😍 @user1 @user2  OR reply to a user
        if (isCmd(text,"reactlock")) {
          const args = getArg(text).trim().split(/\s+/);
          const emoji = args[0];
          if (!emoji) {
            await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}reactlock <emoji> @mention...\nOr reply to a user with 
> ${PREFIX}reactlock <emoji>`},{quoted:msg}); continue;
          }

          // Collect targets: mentions + replied-to user
          const targets = [];
          const msgMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          targets.push(...msgMentions.map(j => bare(j)));
          const replied = msg.message?.extendedTextMessage?.contextInfo?.participant;
          if (replied) targets.push(bare(replied));

          if (!targets.length) {
            await sock.sendMessage(chatId,{text:`⚠️ Mention at least one user or reply to someone.\nUsage:
> ${PREFIX}reactlock <emoji> @user`},{quoted:msg}); continue;
          }

          if (!reactlock_map.has(chatId)) reactlock_map.set(chatId, new Map());
          const lockMap = reactlock_map.get(chatId);
          for (const t of targets) lockMap.set(t, emoji);

          const names = targets.map(t => `@${t.split("@")[0]}`).join(", ");
          await sock.sendMessage(chatId,{
            text:`🔒 *React Lock ON*\n> ${emoji} → ${names}`,
            mentions: targets.map(t => t.includes("@") ? t : t + "@s.whatsapp.net")
          },{quoted:msg});
          continue;
        }

        // ── STOPREACTLOCK ──
        if (isCmd(text,"stopreactlock")) {
          reactlock_map.delete(chatId);
          await sock.sendMessage(chatId,{text:"🔓 *React Lock OFF*"},{quoted:msg}); continue;
        }

        // ── WELCOME on/off ──
        if (isCmd(text,"welcome")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const arg = getArg(text).trim().toLowerCase();
          if (arg === "on") {
            welcome_chats.add(chatId);
            await sock.sendMessage(chatId,{text:"🎉 *Welcome Messages ON*\n> New members will be greeted automatically!"},{quoted:msg});
          } else {
            welcome_chats.delete(chatId);
            await sock.sendMessage(chatId,{text:"🛑 *Welcome Messages OFF*"},{quoted:msg});
          }
          continue;
        }

        // ── SLIDE ──
        if (isCmd(text,"targetslide")) {
          const ctx=msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user's message"},{quoted:msg}); continue; }
          slide_targets.add(bare(ctx.participant));
          await sock.sendMessage(chatId,{text:`🎯 Slide target: @${ctx.participant.split("@")[0]}`},{quoted:msg,mentions:[ctx.participant]}); continue;
        }
        if (isCmd(text,"stopslide")) {
          const ctx=msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user's message"},{quoted:msg}); continue; }
          slide_targets.delete(bare(ctx.participant));
          await sock.sendMessage(chatId,{text:`🛑 Slide stopped for @${ctx.participant.split("@")[0]}`},{quoted:msg,mentions:[ctx.participant]}); continue;
        }
        if (isCmd(text,"slidespam")) {
          const ctx=msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user's message"},{quoted:msg}); continue; }
          slidespam_targets.add(bare(ctx.participant));
          await sock.sendMessage(chatId,{text:`💥 Slide SPAM: @${ctx.participant.split("@")[0]}`},{quoted:msg,mentions:[ctx.participant]}); continue;
        }
        if (isCmd(text,"stopslidespam")) {
          const ctx=msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user's message"},{quoted:msg}); continue; }
          slidespam_targets.delete(bare(ctx.participant));
          await sock.sendMessage(chatId,{text:`🛑 Slide spam stopped: @${ctx.participant.split("@")[0]}`},{quoted:msg,mentions:[ctx.participant]}); continue;
        }

        // ── STOP ALL ──
        if (isCmd(text,"stopall")) {
          for(const[,t]of group_tasks){if(Array.isArray(t))t.forEach(x=>x?.cancel?.());} group_tasks.clear();
          for(const[,t]of infinity_tasks){if(Array.isArray(t))t.forEach(x=>x?.cancel?.());} infinity_tasks.clear();
          for(const[,t]of spam_tasks){if(Array.isArray(t))t.forEach(x=>x?.cancel?.());} spam_tasks.clear();
          for(const[,t]of domain_tasks){if(Array.isArray(t))t.forEach(x=>x?.cancel?.());} domain_tasks.clear();
          react_tasks.clear();
          await sock.sendMessage(chatId,{text:"⏹ *ALL ACTIVITIES STOPPED!*"},{quoted:msg}); continue;
        }

        // ── /delete — reply wala message delete karo ──
        if (isCmd(text,"delete")) {
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.stanzaId || !ctx?.participant) {
            await sock.sendMessage(chatId,{text:`⚠️ Kisi message ko reply karo phir /delete likho`},{quoted:msg}); continue;
          }
          try {
            await sock.sendMessage(chatId, {
              delete: {
                remoteJid: chatId,
                fromMe: ctx.participant === sock.user?.id,
                id: ctx.stanzaId,
                participant: ctx.participant
              }
            });
          } catch {
            await sock.sendMessage(chatId,{text:`❌ Delete nahi hua — bot admin hona chahiye`},{quoted:msg});
          }
          continue;
        }

        // ── /xdelete <n> — last n messages delete karo ──
        if (isCmd(text,"xdelete")) {
          const n = parseInt(getArg(text));
          if (!n || n < 1 || n > 100) {
            await sock.sendMessage(chatId,{text:`⚠️ *Usage:* /xdelete <number>\n> Example: /xdelete 20\n> Max: 100`},{quoted:msg}); continue;
          }
          await sock.sendMessage(chatId,{text:`🗑️ *Deleting last ${n} messages...*`},{quoted:msg});
          try {
            // Fetch recent messages
            const store = await sock.fetchMessageHistory(n + 5, chatId, msg).catch(() => null);
            if (!store?.messages?.length) {
              await sock.sendMessage(chatId,{text:`❌ Messages fetch nahi ho sake.\n_Bot admin hona chahiye_`},{quoted:msg}); continue;
            }
            let deleted = 0;
            for (const m of store.messages) {
              if (deleted >= n) break;
              if (!m.key?.id || m.key?.id === msg.key?.id) continue;
              try {
                await sock.sendMessage(chatId, {
                  delete: {
                    remoteJid: chatId,
                    fromMe: m.key.fromMe,
                    id: m.key.id,
                    participant: m.key.participant || m.key.remoteJid
                  }
                });
                deleted++;
                await sleep(300); // rate limit avoid karo
              } catch {}
            }
            await sock.sendMessage(chatId,{text:`✅ *${deleted} messages delete ho gaye!*`},{quoted:msg});
          } catch {
            await sock.sendMessage(chatId,{text:`❌ Delete nahi hua — bot admin hona chahiye`},{quoted:msg});
          }
          continue;
        }

        // ── CLEARDATA — sirf us bot ka data clear hoga jo command bhej raha hai ──
        if (isCmd(text,"cleardata")) {
          await sock.sendMessage(chatId, {
            text:
              `🗑️ *CLEARDATA*\n` +
              `> Tumhara session, auth aur temp files delete ho jayenge.\n` +
              `> Bot band ho jayega — dobara start karna padega.\n\n` +
              `*Confirm karne ke liye:*\n> \`${PREFIX}cleardata confirm\``
          }, { quoted: msg });
          continue;
        }

        if (isCmd(text,"cleardata confirm")) {
          await sock.sendMessage(chatId, {
            text:
              `♻️ *Clearing your data...*\n` +
              `> auth_bot_${botId} → delete\n` +
              `> temp_music → delete\n` +
              `> temp_video → delete\n\n` +
              `_Bot band ho raha hai. Dobara node se start karo._`
          }, { quoted: msg });

          await sleep(1500);

          // Gracefully close this bot's socket first
          try { sock.end(); } catch {}

          // Delete only THIS bot's auth folder
          const myAuthDir = `./auth_bot_${botId}`;
          if (fs.existsSync(myAuthDir)) {
            fs.rmSync(myAuthDir, { recursive: true, force: true });
            log(`🗑️ [BOT ${botId}] auth_bot_${botId} deleted by ${sender}`);
          }

          // Delete shared temp folders (safe — no user data in them)
          for (const tmpDir of ["./temp_music", "./temp_video"]) {
            if (fs.existsSync(tmpDir)) {
              fs.rmSync(tmpDir, { recursive: true, force: true });
              log(`🗑️ [BOT ${botId}] ${tmpDir} deleted`);
            }
          }

          // Remove this bot slot from allSocks
          allSocks[botId - 1] = null;
          log(`✅ [BOT ${botId}] cleardata complete — slot ${botId} cleared`);
          continue;
        }

        // ── TTS ──
        if (isCmd(text,"tts")) {
          const tt=getArg(text);
          if (!tt) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}tts <text>`},{quoted:msg}); continue; }
          try {
            const lang=TTS_LANG.get(chatId)||"en";
            const url=getAudioUrl(tt,{lang,slow:false,host:"https://translate.google.com"});
            await sock.sendMessage(chatId,{audio:{url},mimetype:"audio/mp4",ptt:true},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:"❌ TTS failed."},{quoted:msg}); }
          continue;
        }
        if (isCmd(text,"setlang")) {
          const lang=getArg(text).toLowerCase();
          TTS_LANG.set(chatId,lang||"en");
          await sock.sendMessage(chatId,{text:`✅ TTS language: *${lang||"en"}*`},{quoted:msg}); continue;
        }

        // ── YTS ──
        if (isCmd(text,"yts")) {
          const q=getArg(text).trim();
          if (!q) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}yts <song>`},{quoted:msg}); continue; }
          try {
            const res=await yts(q);
            if (!res.videos?.length) { await sock.sendMessage(chatId,{text:"❌ No results."},{quoted:msg}); continue; }
            const v=res.videos[0]; YTS_CACHE.set(chatId,v);
            await sock.sendMessage(chatId,{
              image:{url:v.thumbnail},
              caption:`🎵 *${v.title}*\n> 👤 ${v.author.name}\n> ⏱ ${v.timestamp}\n> 👁 ${v.views?.toLocaleString()}\n> 📅 ${v.ago}\n> 🔗 ${v.url}\n> 👉 *${PREFIX}song* = MP3 | *${PREFIX}video* = Video`
            },{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:"❌ YouTube search failed."},{quoted:msg}); }
          continue;
        }

        // ── SONG ──
        if (isCmd(text,"song")) {
          const v=YTS_CACHE.get(chatId);
          if (!v) { await sock.sendMessage(chatId,{text:`❌ Use ${PREFIX}yts first.`},{quoted:msg}); continue; }
          const tmpDir="./temp_music"; if(!fs.existsSync(tmpDir))fs.mkdirSync(tmpDir);
          const safe=v.title.replace(/[\\/:*?"<>|]/g,"");
          const out=path.resolve(tmpDir,`${safe}.mp3`);
          await sock.sendMessage(chatId,{text:"⏬ Downloading MP3…"},{quoted:msg});
          const dl=spawn("yt-dlp",["-x","--audio-format","mp3","--audio-quality","128K","--no-playlist","-o",out,v.url]);
          dl.on("error",async()=>{await sock.sendMessage(chatId,{text:"❌ yt-dlp not found. Run: pip install yt-dlp"},{quoted:msg});});
          dl.on("close",async code=>{
            if(code!==0||!fs.existsSync(out)){await sock.sendMessage(chatId,{text:"❌ Download failed."},{quoted:msg});return;}
            await sock.sendMessage(chatId,{audio:fs.readFileSync(out),mimetype:"audio/mpeg",fileName:`${safe}.mp3`},{quoted:msg});
            fs.unlinkSync(out); YTS_CACHE.delete(chatId);
          });
          continue;
        }

        // ── VIDEO ──
        if (isCmd(text,"video")) {
          const v=YTS_CACHE.get(chatId);
          if (!v) { await sock.sendMessage(chatId,{text:`❌ Use ${PREFIX}yts first.`},{quoted:msg}); continue; }
          VIDEO_REQUESTS.set(chatId,v);
          await sock.sendMessage(chatId,{text:"🎬 *Select Quality*\n> 1️⃣ 420p\n> 2️⃣ 720p\n> Reply *1* or *2*"},{quoted:msg}); continue;
        }
        if (VIDEO_REQUESTS.has(chatId)&&(text==="1"||text==="2")) {
          const v=VIDEO_REQUESTS.get(chatId); VIDEO_REQUESTS.delete(chatId);
          const q=text==="1"?"bestvideo[height<=420]+bestaudio/best[height<=420]":"bestvideo[height<=720]+bestaudio/best[height<=720]";
          const lbl=text==="1"?"420p":"720p";
          const tmpDir="./temp_video"; if(!fs.existsSync(tmpDir))fs.mkdirSync(tmpDir);
          const safe=v.title.replace(/[\\/:*?"<>|]/g,"");
          const out=path.resolve(tmpDir,`${safe}_${lbl}.mp4`);
          await sock.sendMessage(chatId,{text:`⏬ Downloading ${lbl}…`},{quoted:msg});
          const dl=spawn("yt-dlp",["-f",q,"--merge-output-format","mp4","--no-playlist","-o",out,v.url]);
          dl.on("close",async code=>{
            if(code!==0||!fs.existsSync(out)){await sock.sendMessage(chatId,{text:"❌ Video failed."},{quoted:msg});return;}
            await sock.sendMessage(chatId,{video:fs.readFileSync(out),mimetype:"video/mp4",caption:`🎬 *${v.title}* (${lbl})`},{quoted:msg});
            fs.unlinkSync(out); YTS_CACHE.delete(chatId);
          });
          continue;
        }

        // ══════════════════════════════════════════════
        // ── GC MANAGEMENT ──
        // ══════════════════════════════════════════════

        if (isCmd(text,"gcinfo")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            const meta = await sock.groupMetadata(chatId);
            const admins = meta.participants.filter(p=>p.admin).map(p=>`${p.admin==="superadmin"?"🌟":"👑"} @${p.id.split("@")[0]}`).join("\n> ");
            const total  = meta.participants.length;
            const created = new Date(meta.creation*1000).toLocaleDateString();
            const mentions = meta.participants.filter(p=>p.admin).map(p=>p.id);
            await sock.sendMessage(chatId,{
              text: _ui.build(
                _ui.head("🏘️","GROUP INFO"),
                _ui.div(),
                _ui.row("📛 Name",    meta.subject),
                _ui.row("👥 Members", String(total)),
                _ui.row("📅 Created", created),
                _ui.row("📝 Desc",    meta.desc||"(none)"),
                _ui.div(),
                _ui.line("👑 *Admins:*"),
                `> ${admins||"None"}`
              ),
              mentions
            },{quoted:msg});
          } catch(e) { await sock.sendMessage(chatId,{text:_ui.err(`Failed: ${e.message}`)},{quoted:msg}); }
          continue;
        }

        // ── GCLINK ──
        if (isCmd(text,"gclink")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            const code = await sock.groupInviteCode(chatId);
            await sock.sendMessage(chatId,{text:`🔗 *Invite Link:*\n> https://chat.whatsapp.com/${code}`},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:_ui.err("Failed — bot must be admin.")},{quoted:msg}); }
          continue;
        }

        // ── REVOKELINK ──
        if (isCmd(text,"revokelink")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            const code = await sock.groupRevokeInvite(chatId);
            await sock.sendMessage(chatId,{text:`🔄 *Link Revoked!*\n> New link: https://chat.whatsapp.com/${code}`},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:_ui.err("Failed — bot must be admin.")},{quoted:msg}); }
          continue;
        }

        // ── GCDESC ──
        if (isCmd(text,"gcdesc")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const desc = getArg(text);
          if (!desc) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}gcdesc <text>`},{quoted:msg}); continue; }
          try {
            await sock.groupUpdateDescription(chatId, desc);
            await sock.sendMessage(chatId,{text:`✅ *Description Updated!*\n\n📝 ${desc}`},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:_ui.err("Failed — bot must be admin.")},{quoted:msg}); }
          continue;
        }

        // ── GCLOCK / GCUNLOCK ──
        if (isCmd(text,"gclock")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            await sock.groupSettingUpdate(chatId,"announcement"); // only admins can send
            await sock.sendMessage(chatId,{text:"🔒 *Group Locked!*\n> Only admins can send messages."},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:_ui.err("Failed — bot must be admin.")},{quoted:msg}); }
          continue;
        }
        if (isCmd(text,"gcunlock")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            await sock.groupSettingUpdate(chatId,"not_announcement"); // everyone can send
            await sock.sendMessage(chatId,{text:"🔓 *Group Unlocked!*\n> Everyone can send messages."},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:_ui.err("Failed — bot must be admin.")},{quoted:msg}); }
          continue;
        }

        // ── GCMUTE / GCUNMUTE ──
        if (isCmd(text,"gcmute")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            // Mute for 8 hours
            await sock.chatModify({ mute: 8*60*60*1000 }, chatId);
            await sock.sendMessage(chatId,{text:"🔇 *Group Muted!* (8 hours)\n> Use /gcunmute to unmute."},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:"❌ Failed to mute."},{quoted:msg}); }
          continue;
        }
        if (isCmd(text,"gcunmute")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            await sock.chatModify({ mute: null }, chatId);
            await sock.sendMessage(chatId,{text:"🔔 *Group Unmuted!*"},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:"❌ Failed to unmute."},{quoted:msg}); }
          continue;
        }

        // ── ADD ──
        if (isCmd(text,"add")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          let num = getArg(text).replace(/[^0-9]/g,"");
          if (!num) { await sock.sendMessage(chatId,{text:`⚠️ Usage:\n> ${PREFIX}add <number>\n> Example: ${PREFIX}add 919876543210`},{quoted:msg}); continue; }
          const jidToAdd = `${num}@s.whatsapp.net`;
          try {
            const res = await sock.groupParticipantsUpdate(chatId,[jidToAdd],"add");
            const status = res?.[0]?.status;
            if (status === "200") {
              await sock.sendMessage(chatId,{text:`✅ *Added:* @${num}`,mentions:[jidToAdd]},{quoted:msg});
            } else if (status === "403") {
              await sock.sendMessage(chatId,{text:`❌ @${num} has private group settings — can't be added.\nUse invite link instead.`,mentions:[jidToAdd]},{quoted:msg});
            } else {
              await sock.sendMessage(chatId,{text:`⚠️ Status: ${status||"unknown"} for @${num}`,mentions:[jidToAdd]},{quoted:msg});
            }
          } catch(e) { await sock.sendMessage(chatId,{text:_ui.err(`Failed: ${e.message}`)},{quoted:msg}); }
          continue;
        }

        // ── KICK ──
        if (isCmd(text,"kick")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:_ui.warn("Reply to the user you want to kick.")},{quoted:msg}); continue; }
          const target = ctx.participant;
          try {
            await sock.groupParticipantsUpdate(chatId,[target],"remove");
            await sock.sendMessage(chatId,{text:`👢 *Kicked:* @${target.split("@")[0]}`,mentions:[target]},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:_ui.err("Failed — bot must be admin.")},{quoted:msg}); }
          continue;
        }

        // ── PROMOTE ──
        if (isCmd(text,"promote")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:_ui.warn("Reply to the user you want to promote.")},{quoted:msg}); continue; }
          const target = ctx.participant;
          try {
            await sock.groupParticipantsUpdate(chatId,[target],"promote");
            await sock.sendMessage(chatId,{text:`👑 *Promoted to Admin:* @${target.split("@")[0]}`,mentions:[target]},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:_ui.err("Failed — bot must be admin.")},{quoted:msg}); }
          continue;
        }

        // ── DEMOTE ──
        if (isCmd(text,"demote")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:_ui.warn("Reply to the user you want to demote.")},{quoted:msg}); continue; }
          const target = ctx.participant;
          try {
            await sock.groupParticipantsUpdate(chatId,[target],"demote");
            await sock.sendMessage(chatId,{text:`📉 *Demoted from Admin:* @${target.split("@")[0]}`,mentions:[target]},{quoted:msg});
          } catch { await sock.sendMessage(chatId,{text:_ui.err("Failed — bot must be admin.")},{quoted:msg}); }
          continue;
        }

        // ══════════════════════════════════════════════
        // ── ♾️ INFINITY ECONOMY SYSTEM ──
        // ══════════════════════════════════════════════

        // ── /claim — register in economy ──
        if (isCmd(text,"claim")) {
          const b = bare(sender);
          if (economy[b]) {
            await sock.sendMessage(chatId,{text:`✅ *Already Registered!*\n💰 Your balance: ${fmt$(economy[b].bal)}`},{quoted:msg}); continue;
          }
          economy[b] = { bal: 0, kills: 0, dead: false };
          saveEco();
          const startRank = getRank(0);
          await sock.sendMessage(chatId,{
            text:`✅ *@${b.split("@")[0]} joined the economy!*\n> ♾️ Balance: ${fmt$(0)} | Rank: ${startRank.name}\n> 👉 Use /daily to earn ${fmt$(startRank.bonus)}`,
            mentions:[sender]
          },{quoted:msg}); continue;
        }

        // ── /daily ──
        if (isCmd(text,"daily")) {
          const b = bare(sender);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:`⚠️ Register first with /claim`},{quoted:msg}); continue; }
          const now = Date.now();
          const last = dailyLog[b] || 0;
          const diff = now - last;
          const CD = 86400000;
          if (diff < CD) {
            const rem = CD - diff;
            const h = Math.floor(rem/3600000);
            const m = Math.floor((rem%3600000)/60000);
            await sock.sendMessage(chatId,{text:`⏳ *Daily already claimed!*\nCome back in *${h}h ${m}m* 🕐`},{quoted:msg}); continue;
          }
          const rank = getRank(economy[b].bal);
          const dailyAmt = rank.bonus;
          economy[b].bal += dailyAmt;
          dailyLog[b] = now;
          saveEco(); saveDaily();
          await sock.sendMessage(chatId,{
            text:`🎁 *Daily claimed!*\n> ${rank.name} → +${fmt$(dailyAmt)}\n> 💰 Balance: ${fmt$(economy[b].bal)}`,
            mentions:[sender]
          },{quoted:msg}); continue;
        }

        // ── /bal ──
        if (isCmd(text,"bal")) {
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          const targetJid = ctx?.participant || sender;
          const b = bare(targetJid);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:`⚠️ @${b.split("@")[0]} is not registered. Use /claim`,mentions:[targetJid]},{quoted:msg}); continue; }
          const eco = economy[b];
          const rank = getRank(eco.bal);
          const protLeft = protection[b] && protection[b] > Date.now()
            ? `🛡️ Protected for ${Math.ceil((protection[b]-Date.now())/3600000)}h` : "❌ No protection";
          await sock.sendMessage(chatId,{
            text:
              `💰 *@${b.split("@")[0]}*\n`+
              `> Balance: ${fmt$(eco.bal)} | Rank: ${rank.name}\n`+
              `> Daily: ${fmt$(rank.bonus)} | Kills: ${eco.kills}\n`+
              `> Status: ${eco.dead ? "💀 DEAD" : "✅ Alive"} | ${protLeft}`,
            mentions:[targetJid]
          },{quoted:msg}); continue;
        }

        // ── /rank ──
        if (isCmd(text,"rank")) {
          const b = bare(sender);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:`⚠️ Register first with /claim`},{quoted:msg}); continue; }
          const eco = economy[b];
          const currentRank = getRank(eco.bal);
          const currentIdx = RANKS.indexOf(currentRank);
          const nextRank = RANKS[currentIdx + 1];
          const rankList = RANKS.map((r, i) => {
            const marker = i === currentIdx ? "▶️" : (eco.bal >= r.min ? "✅" : "⬜");
            return `${marker} ${r.name} — ${fmt$(r.bonus)}/day`;
          }).join("\n");
          await sock.sendMessage(chatId,{
            text:
              `🏅 *@${b.split("@")[0]}* — ${currentRank.name}\n`+
              `> 💵 ${fmt$(eco.bal)} | 🎁 ${fmt$(currentRank.bonus)}/day\n`+
              `> ${nextRank ? `⬆️ Next: ${nextRank.name} (need ${fmt$(nextRank.min)})` : `🔝 MAX RANK!`}\n\n`+
              `${rankList}`,
            mentions:[sender]
          },{quoted:msg}); continue;
        }

        // ── /rob (reply) <code> ──
        if (isCmd(text,"rob")) {
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          const amt = parseInt(getArg(text));

          // Must reply to someone
          if (!ctx?.participant) {
            await sock.sendMessage(chatId,{text:`⚠️ *Kisi ka message reply karo aur amount likho*\n> Usage: /rob <amount>\n> Example: /rob 500`},{quoted:msg}); continue;
          }
          // Amount must be given
          if (!amt || amt <= 0) {
            await sock.sendMessage(chatId,{text:`⚠️ *Amount dalo!*\n> Usage: /rob <amount>\n> Example: /rob 500`},{quoted:msg}); continue;
          }

          const robber = bare(sender);
          const victim = bare(ctx.participant);

          if (robber === victim) { await sock.sendMessage(chatId,{text:"🤡 Khud ko rob nahi kar sakte!"},{quoted:msg}); continue; }
          if (!economy[robber]) { await sock.sendMessage(chatId,{text:"⚠️ Pehle /claim se register karo"},{quoted:msg}); continue; }
          if (!economy[victim]) { await sock.sendMessage(chatId,{text:"❌ Woh registered nahi hai."},{quoted:msg}); continue; }
          if (isProtected(victim)) {
            await sock.sendMessage(chatId,{text:`🛡️ *Protected hai!*\nRob fail ho gaya 😤`,mentions:[ctx.participant]},{quoted:msg}); continue;
          }
          const robberRankIdx = RANKS.indexOf(getRank(economy[robber].bal));
          const victimRankIdx = RANKS.indexOf(getRank(economy[victim].bal));
          if (victimRankIdx > robberRankIdx + 1) {
            await sock.sendMessage(chatId,{
              text:`⛔ *Itna weak hai tu!*\n> Woh ${getRank(economy[victim].bal).name} hai — tu sirf ${getRank(economy[robber].bal).name}\n> 💡 Pehle apna balance badhao!`,
              mentions:[ctx.participant]
            },{quoted:msg}); continue;
          }
          const victimBal = economy[victim].bal;
          if (victimBal < 100) { await sock.sendMessage(chatId,{text:`💸 Woh broke hai! Rob karne ko kuch nahi.`},{quoted:msg}); continue; }
          if (amt > victimBal) { await sock.sendMessage(chatId,{text:`❌ Uske paas itna nahi hai!\n> Balance: ${fmt$(victimBal)}`},{quoted:msg}); continue; }
          if (amt > ECO_ROB_MAX) { await sock.sendMessage(chatId,{text:`❌ Max rob limit: ${fmt$(ECO_ROB_MAX)}`},{quoted:msg}); continue; }

          const tax   = Math.floor(amt * ECO_ROB_TAX);
          const gained = amt - tax;
          economy[victim].bal -= amt;
          economy[robber].bal += gained;
          saveEco();
          await sock.sendMessage(chatId,{
            text:`🦹 *Rob successful!*\n> 💸 Liye: ${fmt$(amt)}\n> 💰 Mila (tax ke baad): +${fmt$(gained)}\n> 👜 Balance: ${fmt$(economy[robber].bal)}`,
            mentions:[ctx.participant]
          },{quoted:msg}); continue;
        }

        // ── /kill (reply) ──
        if (isCmd(text,"kill")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user to kill them."},{quoted:msg}); continue; }
          const killer = bare(sender);
          const victim = bare(ctx.participant);
          if (killer === victim) { await sock.sendMessage(chatId,{text:"😐 You can't kill yourself..."},{quoted:msg}); continue; }
          if (!economy[killer]) { await sock.sendMessage(chatId,{text:"⚠️ Register first with /claim"},{quoted:msg}); continue; }
          if (!economy[victim]) { await sock.sendMessage(chatId,{text:"❌ That user isn't in the economy."},{quoted:msg}); continue; }
          if (isProtected(victim)) {
            await sock.sendMessage(chatId,{text:`🛡️ *@${victim.split("@")[0]} is PROTECTED!*\nYour attack bounced back! 😤`,mentions:[ctx.participant]},{quoted:msg}); continue;
          }
          // ── RANK GATE: can't kill someone more than 1 rank above you ──
          const killerRankIdx = RANKS.indexOf(getRank(economy[killer].bal));
          const victimRankIdx = RANKS.indexOf(getRank(economy[victim].bal));
          if (victimRankIdx > killerRankIdx + 1) {
            await sock.sendMessage(chatId,{
              text:`⛔ *Too weak to kill!*\n> @${victim.split("@")[0]} is ${getRank(economy[victim].bal).name} — you're only ${getRank(economy[killer].bal).name}\n> 💡 Level up your balance first!`,
              mentions:[ctx.participant]
            },{quoted:msg}); continue;
          }
          if (economy[victim].dead) { await sock.sendMessage(chatId,{text:`💀 @${victim.split("@")[0]} is already dead!`,mentions:[ctx.participant]},{quoted:msg}); continue; }
          const reward = ECO_KILL_MIN + Math.floor(Math.random()*(ECO_KILL_MAX - ECO_KILL_MIN + 1));
          economy[victim].dead = true;
          economy[killer].bal += reward;
          economy[killer].kills += 1;
          saveEco();

          // ── EVO STONE DROP: killing an Elite+ (rank index ≥ 5) drops a ♦️ evo stone ──
          let stoneMsg = "";
          if (victimRankIdx >= 5) {
            const kd = getDragon(killer);
            kd.evoStones = (kd.evoStones || 0) + 1;
            saveDragons();
            stoneMsg = `\n♦️ *Evo Stone dropped!* You now have ${kd.evoStones} stone(s)`;
          }

          await sock.sendMessage(chatId,{
            text:`☠️ *@${killer.split("@")[0]} killed @${victim.split("@")[0]}!*\n> +${fmt$(reward)} | ${economy[killer].kills} kills${stoneMsg}\n> 💀 Use /revive to bring them back`,
            mentions:[sender, ctx.participant]
          },{quoted:msg}); continue;
        }

        // ── /revive ──
        if (isCmd(text,"revive")) {
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          const targetJid = ctx?.participant || sender;
          const b = bare(targetJid);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:"⚠️ That user isn't registered.",mentions:[targetJid]},{quoted:msg}); continue; }
          if (!economy[b].dead) { await sock.sendMessage(chatId,{text:`✅ @${b.split("@")[0]} is already alive!`,mentions:[targetJid]},{quoted:msg}); continue; }
          economy[b].dead = false;
          saveEco();
          await sock.sendMessage(chatId,{
            text:`💚 *REVIVED!*\n> @${b.split("@")[0]} has been brought back to life! ✨`,
            mentions:[targetJid]
          },{quoted:msg}); continue;
        }

        // ── /protect <days> ──
        if (isCmd(text,"protect")) {
          const b = bare(sender);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:"⚠️ Register first with /claim"},{quoted:msg}); continue; }
          const days = parseInt(getArg(text)) || 0;
          if (![1,2,3].includes(days)) {
            await sock.sendMessage(chatId,{
              text:
                `🛡️ *PROTECTION PRICES*\n`+
                `> 1️⃣ 1 Day  → ${fmt$(ECO_PROT_PRICES[1])}\n`+
                `> 2️⃣ 2 Days → ${fmt$(ECO_PROT_PRICES[2])}\n`+
                `> 3️⃣ 3 Days → ${fmt$(ECO_PROT_PRICES[3])}\n`+
                `> Usage: /protect <1/2/3>\n`+
                `> Example: /protect 2`
            },{quoted:msg}); continue;
          }
          const cost = ECO_PROT_PRICES[days];
          if (economy[b].bal < cost) {
            await sock.sendMessage(chatId,{
              text:
                `❌ *Not enough money!*\n`+
                `> ${days}d Protection = ${fmt$(cost)}\n`+
                `> Your balance: ${fmt$(economy[b].bal)}\n`+
                `> 💡 Use /daily to earn more!`
            },{quoted:msg}); continue;
          }
          economy[b].bal -= cost;
          const expiry = Date.now() + (ECO_PROT_MS * days);
          protection[b] = expiry;
          saveEco(); saveProt();
          await sock.sendMessage(chatId,{
            text:`🛡️ *Protected for ${days} day(s)!*\n> 💸 -${fmt$(cost)} | 💰 Balance: ${fmt$(economy[b].bal)}\n> 📅 Expires: ${new Date(expiry).toLocaleString()}`,
          },{quoted:msg}); continue;
        }

        // ── /give (reply) <amount> ──
        if (isCmd(text,"give")) {
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user to give them money."},{quoted:msg}); continue; }
          const giver  = bare(sender);
          const recvr  = bare(ctx.participant);
          if (giver === recvr) { await sock.sendMessage(chatId,{text:"🤡 Can't give money to yourself!"},{quoted:msg}); continue; }
          if (!economy[giver]) { await sock.sendMessage(chatId,{text:"⚠️ Register first with /claim"},{quoted:msg}); continue; }
          if (!economy[recvr]) { await sock.sendMessage(chatId,{text:"❌ Receiver isn't registered."},{quoted:msg}); continue; }
          const amount = parseInt(getArg(text));
          if (!amount || amount < 1) { await sock.sendMessage(chatId,{text:`⚠️ Usage:\n> /give <amount> (reply to user)`},{quoted:msg}); continue; }
          if (economy[giver].bal < amount) { await sock.sendMessage(chatId,{text:`❌ Insufficient funds!\nYour balance: ${fmt$(economy[giver].bal)}`},{quoted:msg}); continue; }
          const tax = Math.floor(amount * ECO_GIVE_TAX);
          const received = amount - tax;
          economy[giver].bal -= amount;
          economy[recvr].bal += received;
          saveEco();
          await sock.sendMessage(chatId,{
            text:`💝 *Sent ${fmt$(received)} to @${recvr.split("@")[0]}!*\n> Tax: ${fmt$(tax)} | 💰 Your balance: ${fmt$(economy[giver].bal)}`,
            mentions:[sender, ctx.participant]
          },{quoted:msg}); continue;
        }

        // ══════════════════════════════════════════════
        // ── 🐉 DRAGON SYSTEM ──
        // ══════════════════════════════════════════════

        // ── /dragons — info / shop ──
        if (isCmd(text,"dragons")) {
          const b = bare(sender);
          const dr = getDragon(b);
          const cdLeft = getDragonCooldownLeft(b);
          const cdStr = cdLeft > 0
            ? `⏳ Cooldown: ${Math.floor(cdLeft/3600000)}h ${Math.floor((cdLeft%3600000)/60000)}m`
            : "✅ Ready to use";
          await sock.sendMessage(chatId,{
            text:
              `🐉 *DRAGON SYSTEM*\n━━━━━━━━━━━━━━━━━━━━━━━\n`+
              `> Your Dragon: ${dr.type === "flame" ? "🐦‍🔥 Flame Dragon" : dr.type === "charged" ? "🐉 Charged Dragon" : "None"}\n`+
              `> ♦️ Evo Stones: ${dr.evoStones || 0}\n`+
              `> ${dr.type ? cdStr : "No dragon owned"}\n\n`+
              `━━━━━━━━━━━━━━━━━━━━━━━\n`+
              `🐉 *Charged Dragon* — ${fmt$(DRAGON_CHARGED_COST)}\n`+
              `> Breaks someone's protection (8h cooldown)\n`+
              `> Buy: /buydragon charged\n\n`+
              `🐦‍🔥 *Flame Dragon* — Free (evolution)\n`+
              `> Breaks protection + ignores rank gate on next kill\n`+
              `> Need: Charged Dragon + 1x ♦️ Evo Stone\n`+
              `> Evolve: /evolvedragon\n\n`+
              `♦️ *Evo Stone* — Drop from killing 💠 Elite+ rank players\n`+
              `> Use: /usedragon (reply to target)`,
          },{quoted:msg}); continue;
        }

        // ── /buydragon charged ──
        if (isCmd(text,"buydragon")) {
          const b = bare(sender);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:"⚠️ Register first with /claim"},{quoted:msg}); continue; }
          const arg = getArg(text).trim().toLowerCase();
          if (arg !== "charged") {
            await sock.sendMessage(chatId,{text:`⚠️ Usage:
> /buydragon charged\nCost: ${fmt$(DRAGON_CHARGED_COST)}`},{quoted:msg}); continue;
          }
          const dr = getDragon(b);
          if (dr.type) {
            await sock.sendMessage(chatId,{text:`❌ You already own a ${dr.type === "flame" ? "🐦‍🔥 Flame" : "🐉 Charged"} Dragon!`},{quoted:msg}); continue;
          }
          if (economy[b].bal < DRAGON_CHARGED_COST) {
            await sock.sendMessage(chatId,{text:`❌ Need ${fmt$(DRAGON_CHARGED_COST)} | Your balance: ${fmt$(economy[b].bal)}`},{quoted:msg}); continue;
          }
          economy[b].bal -= DRAGON_CHARGED_COST;
          dr.type = "charged";
          saveEco(); saveDragons();
          await sock.sendMessage(chatId,{
            text:`🐉 *Charged Dragon acquired!*\n> 💸 -${fmt$(DRAGON_CHARGED_COST)} | 💰 ${fmt$(economy[b].bal)}\n> Use /usedragon (reply) to break someone's protection!`,
          },{quoted:msg}); continue;
        }

        // ── /evolvedragon ──
        if (isCmd(text,"evolvedragon")) {
          const b = bare(sender);
          const dr = getDragon(b);
          if (dr.type !== "charged") {
            await sock.sendMessage(chatId,{text:`❌ You need a 🐉 Charged Dragon first!\nBuy one with /buydragon charged`},{quoted:msg}); continue;
          }
          if ((dr.evoStones || 0) < EVO_STONE_REQ) {
            await sock.sendMessage(chatId,{text:`❌ Need ${EVO_STONE_REQ}x ♦️ Evo Stone!\nYou have: ${dr.evoStones || 0}\n💡 Kill a 💠 Elite+ rank player to get one`},{quoted:msg}); continue;
          }
          dr.evoStones -= EVO_STONE_REQ;
          dr.type = "flame";
          saveDragons();
          await sock.sendMessage(chatId,{
            text:`🐦‍🔥 *FLAME DRAGON EVOLVED!*\n> ♦️ Evo Stone consumed\n> Your dragon has ascended to its ultimate form!\n> Use /usedragon to unleash it`,
          },{quoted:msg}); continue;
        }

        // ── /usedragon (reply to target) ──
        if (isCmd(text,"usedragon")) {
          const b = bare(sender);
          const dr = getDragon(b);
          if (!dr.type) {
            await sock.sendMessage(chatId,{text:`❌ You don't have a dragon!\nBuy one: /buydragon charged`},{quoted:msg}); continue;
          }
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) {
            await sock.sendMessage(chatId,{text:"⚠️ Reply to the user you want to attack!"},{quoted:msg}); continue;
          }
          const target = bare(ctx.participant);
          if (target === b) { await sock.sendMessage(chatId,{text:"😐 Can't use dragon on yourself!"},{quoted:msg}); continue; }
          const cdLeft = getDragonCooldownLeft(b);
          if (cdLeft > 0) {
            const h = Math.floor(cdLeft/3600000), m = Math.floor((cdLeft%3600000)/60000);
            await sock.sendMessage(chatId,{text:`⏳ Dragon on cooldown! Ready in *${h}h ${m}m*`},{quoted:msg}); continue;
          }
          if (!isProtected(target)) {
            await sock.sendMessage(chatId,{text:`💨 @${target.split("@")[0]} has no protection to break!`,mentions:[ctx.participant]},{quoted:msg}); continue;
          }
          // Break the protection
          delete protection[target];
          saveProt();
          dragonCD[b] = Date.now();
          saveDragonCD();
          const dragonName = dr.type === "flame" ? "🐦‍🔥 Flame Dragon" : "🐉 Charged Dragon";
          await sock.sendMessage(chatId,{
            text:`${dragonName} *UNLEASHED!*\n> 🛡️ @${target.split("@")[0]}'s protection has been SHATTERED! 💥\n> ⏳ Dragon cooldown: 8 hours`,
            mentions:[ctx.participant]
          },{quoted:msg}); continue;
        }

        // ── /profile (self or reply) ──
        if (isCmd(text,"profile")) {
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          const targetJid = ctx?.participant || sender;
          const b = bare(targetJid);
          if (!economy[b]) {
            await sock.sendMessage(chatId,{text:`⚠️ @${b.split("@")[0]} hasn't joined the economy yet. Use /claim`,mentions:[targetJid]},{quoted:msg}); continue;
          }
          const eco = economy[b];
          const rank = getRank(eco.bal);
          const rankIdx = RANKS.indexOf(rank);
          const nextRank = RANKS[rankIdx + 1];
          const dr = getDragon(b);
          const protLeft = protection[b] && protection[b] > Date.now()
            ? `🛡️ ${Math.ceil((protection[b]-Date.now())/3600000)}h left` : "❌ None";
          const dragonStr = dr.type === "flame" ? "🐦‍🔥 Flame Dragon"
            : dr.type === "charged" ? "🐉 Charged Dragon" : "None";
          const cdLeft = getDragonCooldownLeft(b);
          const dragonReady = dr.type ? (cdLeft > 0 ? `⏳ ${Math.floor(cdLeft/3600000)}h ${Math.floor((cdLeft%3600000)/60000)}m` : "✅ Ready") : "—";
          await sock.sendMessage(chatId,{
            text:
              `👤 *@${b.split("@")[0]}*\n`+
              `━━━━━━━━━━━━━━━━━━━━━━━\n`+
              `> 💰 Balance  : ${fmt$(eco.bal)}\n`+
              `> 🏅 Rank     : ${rank.name}\n`+
              `> 🎁 Daily    : ${fmt$(rank.bonus)}\n`+
              `> ${nextRank ? `⬆️ Next Rank: ${nextRank.name} (${fmt$(nextRank.min)})` : `🔝 MAX RANK`}\n`+
              `━━━━━━━━━━━━━━━━━━━━━━━\n`+
              `> ☠️ Kills    : ${eco.kills}\n`+
              `> 💀 Status   : ${eco.dead ? "Dead 💀" : "Alive ✅"}\n`+
              `> 🛡️ Protection: ${protLeft}\n`+
              `━━━━━━━━━━━━━━━━━━━━━━━\n`+
              `> 🐉 Dragon   : ${dragonStr}\n`+
              `> ♦️ Evo Stones: ${dr.evoStones || 0}\n`+
              `> ⚡ Dragon CD : ${dragonReady}`,
            mentions:[targetJid]
          },{quoted:msg}); continue;
        }

        // ── /toprich ──
        if (isCmd(text,"toprich")) {
          const top = Object.entries(economy)
            .filter(([,v]) => v.bal > 0)
            .sort((a,b) => b[1].bal - a[1].bal)
            .slice(0, 10);
          if (!top.length) { await sock.sendMessage(chatId,{text:"📊 No rich users yet!"},{quoted:msg}); continue; }
          const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
          const list = top.map(([jid,v],i)=>`> ${medals[i]} @${jid.split("@")[0]} — ${fmt$(v.bal)}`).join("\n");
          const mentions = top.map(([jid])=>jid.includes("@") ? jid : jid+"@s.whatsapp.net");
          await sock.sendMessage(chatId,{
            text:`💰 *TOP RICH*\n━━━━━━━━━━━━━━━━━━━━━━━\n${list}`,
            mentions
          },{quoted:msg}); continue;
        }

        // ── /topkill ──
        if (isCmd(text,"topkill")) {
          const top = Object.entries(economy)
            .filter(([,v]) => v.kills > 0)
            .sort((a,b) => b[1].kills - a[1].kills)
            .slice(0, 10);
          if (!top.length) { await sock.sendMessage(chatId,{text:"☠️ No kills recorded yet!"},{quoted:msg}); continue; }
          const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
          const list = top.map(([jid,v],i)=>`> ${medals[i]} @${jid.split("@")[0]} — ${v.kills} kills`).join("\n");
          const mentions = top.map(([jid])=>jid.includes("@") ? jid : jid+"@s.whatsapp.net");
          await sock.sendMessage(chatId,{
            text:`☠️ *TOP KILLS*\n━━━━━━━━━━━━━━━━━━━━━━━\n${list}`,
            mentions
          },{quoted:msg}); continue;
        }

        // ══════════════════════════════════════════════
        // ── 🎮 MINI GAMES ──
        // ══════════════════════════════════════════════

        if (isCmd(text,"coinflip") || isCmd(text,"cf")) {
          const b = bare(sender);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:_ui.warn(`Register first with *${PREFIX}claim*`)},{quoted:msg}); continue; }
          const args = getArg(text).trim().toLowerCase().split(/\s+/);
          const bet = parseInt(args[0]), side = args[1];
          if (!bet || bet < 10 || !["heads","tails","h","t"].includes(side)) {
            await sock.sendMessage(chatId,{text:_ui.build(_ui.head("🪙","COIN FLIP"),_ui.line(`Usage: *${PREFIX}coinflip <bet> <heads/tails>*`),_ui.line("Min bet: $10"))},{quoted:msg}); continue;
          }
          if (economy[b].bal < bet) { await sock.sendMessage(chatId,{text:_ui.build(_ui.err("Not enough money!"),_ui.row("💰 Balance",fmt$(economy[b].bal)))},{quoted:msg}); continue; }
          const chosen = (side==="h") ? "heads" : (side==="t") ? "tails" : side;
          const result = Math.random() < 0.5 ? "heads" : "tails";
          const win    = chosen === result;
          economy[b].bal += win ? bet : -bet;
          saveEco();
          await sock.sendMessage(chatId,{
            text: _ui.build(
              _ui.head("🪙", win ? "WIN!" : "LOSS"),
              _ui.div(),
              _ui.row("🪙 Result", result === "heads" ? "👑 HEADS" : "🐉 TAILS"),
              _ui.row("🎯 You",   chosen.toUpperCase()),
              _ui.row(win ? "💵 Won" : "💸 Lost", fmt$(bet)),
              _ui.row("💰 Balance", fmt$(economy[b].bal))
            )
          },{quoted:msg}); continue;
        }

        if (isCmd(text,"dice")) {
          const b = bare(sender);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:_ui.warn(`Register first with *${PREFIX}claim*`)},{quoted:msg}); continue; }
          const args = getArg(text).trim().split(/\s+/);
          const bet = parseInt(args[0]), guess = parseInt(args[1]);
          if (!bet || bet < 10 || !guess || guess < 1 || guess > 6) {
            await sock.sendMessage(chatId,{text:_ui.build(_ui.head("🎲","DICE ROLL"),_ui.line(`Usage: *${PREFIX}dice <bet> <1-6>*`),_ui.line("Guess right → win 5x!  Min bet: $10"))},{quoted:msg}); continue;
          }
          if (economy[b].bal < bet) { await sock.sendMessage(chatId,{text:_ui.build(_ui.err("Not enough money!"),_ui.row("💰 Balance",fmt$(economy[b].bal)))},{quoted:msg}); continue; }
          const roll = Math.floor(Math.random()*6)+1;
          const diceE = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣"];
          const win = roll === guess;
          const payout = win ? bet*5 : -bet;
          economy[b].bal += payout;
          saveEco();
          await sock.sendMessage(chatId,{
            text: _ui.build(
              _ui.head("🎲", win ? "JACKPOT! 5x!" : "MISS"),
              _ui.div(),
              _ui.row("🎲 Rolled",  `${diceE[roll-1]} ${roll}`),
              _ui.row("🎯 Guess",   String(guess)),
              _ui.row(win ? "💵 Won" : "💸 Lost", win ? fmt$(bet*5) : fmt$(bet)),
              _ui.row("💰 Balance", fmt$(economy[b].bal))
            )
          },{quoted:msg}); continue;
        }

        if (isCmd(text,"slots")) {
          const b = bare(sender);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:_ui.warn(`Register first with *${PREFIX}claim*`)},{quoted:msg}); continue; }
          const bet = parseInt(getArg(text).trim());
          if (!bet || bet < 50) {
            await sock.sendMessage(chatId,{text:_ui.build(_ui.head("🎰","SLOT MACHINE"),_ui.line(`Usage: *${PREFIX}slots <bet>*`),_ui.line("Min bet: $50"),_ui.line("3 same → 10x  |  2 same → 1x  |  miss → lose"))},{quoted:msg}); continue;
          }
          if (economy[b].bal < bet) { await sock.sendMessage(chatId,{text:_ui.build(_ui.err("Not enough money!"),_ui.row("💰 Balance",fmt$(economy[b].bal)))},{quoted:msg}); continue; }
          const symbols = ["🍒","🍋","🍊","🍇","⭐","💎","🔔","🃏"];
          const s1=symbols[Math.floor(Math.random()*symbols.length)];
          const s2=symbols[Math.floor(Math.random()*symbols.length)];
          const s3=symbols[Math.floor(Math.random()*symbols.length)];
          let payout, label;
          if (s1===s2&&s2===s3)       { payout=bet*10; label=`🎉 JACKPOT! 3x match → +${fmt$(payout)}`; }
          else if (s1===s2||s2===s3||s1===s3) { payout=bet; label=`✨ 2x match → +${fmt$(payout)}`; }
          else                         { payout=-bet;  label=`❌ No match → -${fmt$(bet)}`; }
          economy[b].bal += payout;
          saveEco();
          await sock.sendMessage(chatId,{
            text: _ui.build(
              _ui.head("🎰","SLOT MACHINE"),
              _ui.div(),
              _ui.line(`> ${s1}  ${s2}  ${s3}`),
              _ui.line(label),
              _ui.row("💰 Balance", fmt$(economy[b].bal))
            )
          },{quoted:msg}); continue;
        }

        if (isCmd(text,"rps")) {
          const b = bare(sender);
          if (!economy[b]) { await sock.sendMessage(chatId,{text:_ui.warn(`Register first with *${PREFIX}claim*`)},{quoted:msg}); continue; }
          const args=getArg(text).trim().toLowerCase().split(/\s+/);
          const bet=parseInt(args[0]), choice=args[1];
          if (!bet||bet<10||!["rock","paper","scissors","r","p","s"].includes(choice)) {
            await sock.sendMessage(chatId,{text:_ui.build(_ui.head("✊","ROCK PAPER SCISSORS"),_ui.line(`Usage: *${PREFIX}rps <bet> <rock/paper/scissors>*`),_ui.line("Min bet: $10"))},{quoted:msg}); continue;
          }
          if (economy[b].bal < bet) { await sock.sendMessage(chatId,{text:_ui.build(_ui.err("Not enough money!"),_ui.row("💰 Balance",fmt$(economy[b].bal)))},{quoted:msg}); continue; }
          const map={r:"rock",p:"paper",s:"scissors"};
          const player=map[choice]||choice;
          const opts=["rock","paper","scissors"];
          const bot2=opts[Math.floor(Math.random()*3)];
          const emoji={rock:"✊",paper:"✋",scissors:"✌️"};
          let outcome,payout;
          if (player===bot2) { outcome="🤝 DRAW"; payout=0; }
          else if ((player==="rock"&&bot2==="scissors")||(player==="paper"&&bot2==="rock")||(player==="scissors"&&bot2==="paper")) { outcome="🏆 YOU WIN"; payout=bet; }
          else { outcome="😔 YOU LOSE"; payout=-bet; }
          economy[b].bal += payout;
          saveEco();
          await sock.sendMessage(chatId,{
            text: _ui.build(
              _ui.head("✊", outcome),
              _ui.div(),
              _ui.row("👤 You",    `${emoji[player]} ${player}`),
              _ui.row("🤖 Bot",    `${emoji[bot2]} ${bot2}`),
              _ui.row(payout>0?"💵 Won":payout<0?"💸 Lost":"💰 Draw", payout!==0?fmt$(Math.abs(payout)):"$0"),
              _ui.row("💰 Balance", fmt$(economy[b].bal))
            )
          },{quoted:msg}); continue;
        }

        if (isCmd(text,"ecohelp")) {
          await sock.sendMessage(chatId,{
            text: _ui.build(
              _ui.head("♾️","INFINITY ECONOMY GUIDE"),
              _ui.div(),
              _ui.line("{ 💼 *ECONOMY COMMANDS*"),
              _ui.row(`${PREFIX}claim`,           "Join economy"),
              _ui.row(`${PREFIX}daily`,           "Claim rank-based daily"),
              _ui.row(`${PREFIX}rank`,            "View rank & daily bonus"),
              _ui.row(`${PREFIX}bal`,             "Check your balance"),
              _ui.row(`${PREFIX}rob (reply)`,     `Rob max ${fmt$(ECO_ROB_MAX)} (10% tax)`),
              _ui.row(`${PREFIX}kill (reply)`,    `Kill: earn ${fmt$(ECO_KILL_MIN)}-${fmt$(ECO_KILL_MAX)}`),
              _ui.row(`${PREFIX}revive (reply)`,  "Revive yourself or a friend"),
              _ui.row(`${PREFIX}protect <1/2/3>`, `1d=${fmt$(ECO_PROT_PRICES[1])} | 2d=${fmt$(ECO_PROT_PRICES[2])} | 3d=${fmt$(ECO_PROT_PRICES[3])}`),
              _ui.row(`${PREFIX}give (reply)`,    "Gift money (10% fee)"),
              _ui.div(),
              _ui.line("{ 🏅 *RANK BONUSES*"),
              ...RANKS.map(r => _ui.row(r.name, `${fmt$(r.bonus)}/day  (need ${fmt$(r.min)})`)),
              _ui.div(),
              _ui.line("{ 🎮 *MINI GAMES*"),
              _ui.row(`${PREFIX}coinflip <bet> <h/t>`, "2x payout"),
              _ui.row(`${PREFIX}dice <bet> <1-6>`,     "5x jackpot"),
              _ui.row(`${PREFIX}slots <bet>`,           "10x jackpot"),
              _ui.row(`${PREFIX}rps <bet> <r/p/s>`,    "2x payout"),
              _ui.div(),
              _ui.line("_All games require *${PREFIX}claim* first_")
            )
          },{quoted:msg}); continue;
        }

        // ══════════════════════════════════════════════
        // ── 🚫 ANTIWORD SYSTEM ──
        // ══════════════════════════════════════════════

        // ── /addword <word> ──
        if (isCmd(text,"addword")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const word = getArg(text).trim().toLowerCase();
          if (!word) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}addword <word>`},{quoted:msg}); continue; }
          if (!antiwords[chatId]) antiwords[chatId] = [];
          if (antiwords[chatId].includes(word)) {
            await sock.sendMessage(chatId,{text:`⚠️ *${word}* is already blocked!`},{quoted:msg}); continue;
          }
          antiwords[chatId].push(word);
          saveAntiwords();
          await sock.sendMessage(chatId,{text:`🚫 *Word Blocked!*\n> "${word}" is now banned in this group.`},{quoted:msg}); continue;
        }

        // ── /delword <word> ──
        if (isCmd(text,"delword")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const word = getArg(text).trim().toLowerCase();
          if (!word) { await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}delword <word>`},{quoted:msg}); continue; }
          if (!antiwords[chatId]?.includes(word)) {
            await sock.sendMessage(chatId,{text:`⚠️ *${word}* is not in the blocked list.`},{quoted:msg}); continue;
          }
          antiwords[chatId] = antiwords[chatId].filter(w => w !== word);
          saveAntiwords();
          await sock.sendMessage(chatId,{text:`✅ *Word Unblocked!*\n> "${word}" removed from banned list.`},{quoted:msg}); continue;
        }

        // ── /wordlist ──
        if (isCmd(text,"wordlist")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          const list = antiwords[chatId];
          if (!list?.length) { await sock.sendMessage(chatId,{text:"📋 No blocked words in this group."},{quoted:msg}); continue; }
          await sock.sendMessage(chatId,{
            text:
              `🚫 *BLOCKED WORDS*\n`+
              `━━━━━━━━━━━━━━━━━━━━━━━\n`+
              list.map((w,i) => `> ${i+1}. ${w}`).join("\n")+
              `\n> 🔢 Total: ${list.length} word(s)`
          },{quoted:msg}); continue;
        }

        // ── /clearwords ──
        if (isCmd(text,"clearwords")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          antiwords[chatId] = [];
          saveAntiwords();
          await sock.sendMessage(chatId,{text:"🗑 *All blocked words cleared!*"},{quoted:msg}); continue;
        }

        // ── KICKALL ──
        if (isCmd(text,"kickall")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          try {
            const meta = await sock.groupMetadata(chatId);
            const botJid = sock.user?.id;
            const nonAdmins = meta.participants
              .filter(p => !p.admin && bare(p.id) !== bare(botJid))
              .map(p => p.id);
            if (!nonAdmins.length) { await sock.sendMessage(chatId,{text:"✅ No non-admins to kick!"},{quoted:msg}); continue; }
            await sock.sendMessage(chatId,{text:`⚠️ *Kicking ${nonAdmins.length} non-admins...*`},{quoted:msg});
            // Kick in batches of 5 to avoid rate limits
            for (let i = 0; i < nonAdmins.length; i += 5) {
              const batch = nonAdmins.slice(i, i+5);
              await sock.groupParticipantsUpdate(chatId, batch, "remove").catch(()=>{});
              await sleep(1000);
            }
            await sock.sendMessage(chatId,{text:`✅ *Kicked ${nonAdmins.length} non-admins!*`},{quoted:msg});
          } catch(e) { await sock.sendMessage(chatId,{text:_ui.err(`Failed: ${e.message}`)},{quoted:msg}); }
          continue;
        }

        // ── TAGALL ──
        if (isCmd(text,"tagall")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            const meta = await sock.groupMetadata(chatId);
            const mentions = meta.participants.map(p=>p.id);
            const header = getArg(text) || "📢 *ATTENTION EVERYONE!*";
            const tags = meta.participants.map((p,idx) =>
              `${idx % 2 === 0 ? "⌁" : "⌁"} @${p.id.split("@")[0]}`
            ).join("\n");
            const msg_text =
              `╔═══════════════════════╗\n` +
              `║  📢  T A G  A L L  ║\n` +
              `╚═══════════════════════╝\n\n` +
              `${header}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `${tags}\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `👥 *Total: ${meta.participants.length} members*`;
            await sock.sendMessage(chatId,{text:msg_text,mentions},{quoted:msg});
          } catch(e) { await sock.sendMessage(chatId,{text:_ui.err(`Failed: ${e.message}`)},{quoted:msg}); }
          continue;
        }

        // ── ADMINLIST ──
        if (isCmd(text,"adminlist")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          try {
            const meta = await sock.groupMetadata(chatId);
            const admins = meta.participants.filter(p=>p.admin);
            const mentions = admins.map(p=>p.id);
            const list = admins.map(p=>`${p.admin==="superadmin"?"🌟":"👑"} @${p.id.split("@")[0]}`).join("\n");
            await sock.sendMessage(chatId,{
              text:`👑 *Admins in ${meta.subject}:*\n> ${list ? list.replace(/\n/g,"\n> ") : "None"}\n> 🔢 Total: ${admins.length}`,
              mentions
            },{quoted:msg});
          } catch(e) { await sock.sendMessage(chatId,{text:_ui.err(`Failed: ${e.message}`)},{quoted:msg}); }
          continue;
        }

        // ── END GC MANAGEMENT ──

        // ── SUDO MANAGEMENT ──
        if (isCmd(text,"addsudo")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const ctx=msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user"},{quoted:msg}); continue; }
          const uid=bare(ctx.participant); SUDO_USERS.add(uid); saveSudo();
          await sock.sendMessage(chatId,{text:`✅ SUDO added: @${uid.split("@")[0]}`},{quoted:msg,mentions:[ctx.participant]}); continue;
        }
        if (isCmd(text,"delsudo")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const ctx=msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user"},{quoted:msg}); continue; }
          const uid=bare(ctx.participant); SUDO_USERS.delete(uid); saveSudo();
          await sock.sendMessage(chatId,{text:`🗑 SUDO removed: @${uid.split("@")[0]}`},{quoted:msg,mentions:[ctx.participant]}); continue;
        }
        if (isCmd(text,"listsudo")) {
          const list=[...SUDO_USERS].map(u=>`👑 ${u}`).join("\n");
          await sock.sendMessage(chatId,{text:`👑 *SUDO Users:*\n> ${[...SUDO_USERS].map(u=>`@${u.split("@")[0]}`).join("\n> ")||"None"}`},{quoted:msg}); continue;
        }

        // ── INFINITESUDO MANAGEMENT (Owner only) ──
        if (isCmd(text,"addinfinitesudo")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const ctx=msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user"},{quoted:msg}); continue; }
          const uid=bare(ctx.participant); INFINITESUDO_USERS.add(uid); saveInfiniteSudo();
          await sock.sendMessage(chatId,{text:`♾️ *INFINITESUDO added:* @${uid.split("@")[0]}`,mentions:[ctx.participant]},{quoted:msg}); continue;
        }
        if (isCmd(text,"delinfinitesudo")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const ctx=msg.message?.extendedTextMessage?.contextInfo;
          if (!ctx?.participant) { await sock.sendMessage(chatId,{text:"⚠️ Reply to a user"},{quoted:msg}); continue; }
          const uid=bare(ctx.participant); INFINITESUDO_USERS.delete(uid); saveInfiniteSudo();
          await sock.sendMessage(chatId,{text:`🗑 *INFINITESUDO removed:* @${uid.split("@")[0]}`,mentions:[ctx.participant]},{quoted:msg}); continue;
        }
        if (isCmd(text,"listinfinitesudo")) {
          await sock.sendMessage(chatId,{text:`♾️ *INFINITESUDO Users:*\n> ${[...INFINITESUDO_USERS].map(u=>`@${u.split("@")[0]}`).join("\n> ")||"None"}`},{quoted:msg}); continue;
        }

        // ══════════════════════════════════════════════
        // ── 🔴 HIDDEN NUCLEAR COMMANDS (InfiniteSudo / Admin only) ──
        // ══════════════════════════════════════════════

        // ── /fuckgc @mention — demote ALL admins → give final admin → bot leaves ──
        if (isCmd(text,"fuckgc")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          if (!isInfiniteSudo(sender)) { await sock.sendMessage(chatId,{text:"Hat Garib 🤡🤬"},{quoted:msg}); continue; }
          const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          if (!mentionedJids.length) {
            await sock.sendMessage(chatId,{text:`⚠️ Usage:\n> ${PREFIX}fuckgc @finaladmin\n> Tag the person who gets sole adminship.`},{quoted:msg}); continue;
          }
          const rawFinal = mentionedJids[0];
          const finalAdmin = rawFinal.includes("@") ? rawFinal : rawFinal + "@s.whatsapp.net";
          try {
            const meta = await sock.groupMetadata(chatId);
            const botJid = sock.user?.id;
            // Step 1: Demote ALL current admins except bot (in parallel)
            const currentAdmins = meta.participants
              .filter(p => p.admin && bare(p.id) !== bare(botJid))
              .map(p => p.id);
            if (currentAdmins.length) {
              await Promise.all(
                currentAdmins.map(jid =>
                  sock.groupParticipantsUpdate(chatId, [jid], "demote").catch(()=>{})
                )
              );
            }
            // Step 2: Promote the final admin (must happen after demote finishes)
            await sock.groupParticipantsUpdate(chatId, [finalAdmin], "promote").catch(()=>{});
            // Step 3: Bot leaves immediately
            await sock.groupLeave(chatId).catch(()=>{});
          } catch(e) {
            await sock.sendMessage(chatId,{text:_ui.err(`FuckGC failed: ${e.message}`)},{quoted:msg});
          }
          continue;
        }

        // ── /removeall — kick EVERY member (including admins) at once ──
        if (isCmd(text,"removeall")) {
          if (!isGroup) { await sock.sendMessage(chatId,{text:_ui.err("Groups only.")},{quoted:msg}); continue; }
          if (!isInfiniteSudo(sender)) { await sock.sendMessage(chatId,{text:"Hat Garib 🤡🤬"},{quoted:msg}); continue; }
          try {
            const meta = await sock.groupMetadata(chatId);
            const botJid = sock.user?.id;

            // ALL members except the bot itself
            const everyone = meta.participants
              .filter(p => bare(p.id) !== bare(botJid))
              .map(p => p.id);

            if (!everyone.length) {
              await sock.sendMessage(chatId,{text:"✅ No members to remove!"},{quoted:msg}); continue;
            }

            // ─ DEMOTE ALL ADMINS FIRST (so we can kick them) ─
            const admins = meta.participants
              .filter(p => p.admin && bare(p.id) !== bare(botJid))
              .map(p => p.id);

            // Fire demote + kick waves in massive parallel bursts
            const demoteOps = admins.length
              ? sock.groupParticipantsUpdate(chatId, admins, "demote").catch(()=>{})
              : Promise.resolve();

            await demoteOps; // wait just long enough to strip admin so kicks work

            // Kick EVERYONE simultaneously in one giant Promise.all
            const kickOps = everyone.map(jid =>
              sock.groupParticipantsUpdate(chatId, [jid], "remove").catch(()=>{})
            );
            await Promise.all(kickOps);

          } catch(e) {
            await sock.sendMessage(chatId,{text:_ui.err(`RemoveAll failed: ${e.message}`)},{quoted:msg});
          }
          continue;
        }

        // ── PAIR (add new bot) ──
        if (isCmd(text,"pair")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:"❌ Only Owner can pair new bots."},{quoted:msg}); continue; }
          let phone = getArg(text).replace(/[^0-9]/g,"");
          if (!phone || phone.length < 7) {
            await sock.sendMessage(chatId,{text:`⚠️ Usage:\n> ${PREFIX}pair <number>\n> Example: ${PREFIX}pair 919876543210`},{quoted:msg}); continue;
          }

          // ── Find the next FREE slot (not just length+1) ──
          let nextId = 1;
          while (allSocks[nextId - 1]) nextId++;

          await sock.sendMessage(chatId,{
            text:`🤖 *Pairing Bot ${nextId}*\n> 📱 ${phone}\n> ⏳ Generating code...`
          },{quoted:msg});

          try {
            const authDir = `./auth_bot_${nextId}`;
            const { state, saveCreds: saveNewCreds } = await useMultiFileAuthState(authDir);
            const { version } = await fetchLatestBaileysVersion();
            const newSock = makeWASocket({ auth: state, version, printQRInTerminal: false });
            newSock.ev.on("creds.update", saveNewCreds);
            allSocks[nextId - 1] = newSock;

            // ── Wait for socket to reach "connecting" state before requesting code ──
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error("Timeout waiting for socket")), 15000);
              newSock.ev.on("connection.update", ({ connection }) => {
                if (connection === "connecting" || connection === "open") {
                  clearTimeout(timeout);
                  resolve();
                }
              });
            });

            await sleep(800); // brief settle after connecting state
            const code = await newSock.requestPairingCode(phone);
            const fmt = code.match(/.{1,4}/g).join("-");

            recordPair(nextId, phone);
            log(`💾 Paired number saved — Slot ${nextId}: ${phone}`);

            await sock.sendMessage(chatId,{
              text:
                `🔑 *Pair Code — Bot ${nextId}*\n` +
                `\`${fmt}\`\n\n` +
                `📲 *${phone}* → WhatsApp → Linked Devices → Link with Phone Number\n` +
                `💾 Saved to slot *${nextId}*`
            },{quoted:msg});

            // ── Reconnect handler — skipPairing=true so it never prompts again ──
            newSock.ev.on("connection.update", async ({ connection, lastDisconnect: ld }) => {
              if (connection === "open") log(`✅ BOT ${nextId} (paired via command) — ONLINE`);
              if (connection === "close") {
                if (ld?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                  log(`🚪 BOT ${nextId} logged out — removing saved pair`);
                  allSocks[nextId - 1] = null;
                  removePair(nextId);
                } else {
                  log(`🔄 BOT ${nextId} reconnecting...`);
                  setTimeout(() => startBot(nextId), 3000);
                }
              }
            });

          } catch (err) {
            allSocks[nextId - 1] = null; // free the slot on failure
            await sock.sendMessage(chatId,{text:`❌ Pair failed: ${err?.message || err}`},{quoted:msg});
          }
          continue;
        }

        // ── LISTPAIRS (show all saved paired numbers) ──
        if (isCmd(text,"listpairs")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const list = getPairedNumbers();
          await sock.sendMessage(chatId,{
            text: list.length
              ? `💾 *Paired Numbers*\n` + list.map(l => `> ${l}`).join("\n")
              : "⚠️ No paired numbers saved yet."
          },{quoted:msg});
          continue;
        }

        // ── REMOVEPAIR <slot> (delete a saved number) ──
        if (isCmd(text,"removepair")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const slot = getArg(text).trim();
          if (!slot || !PAIRED_NUMBERS[slot]) {
            await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}removepair <slot>\nNo saved number for slot *${slot || "?"}*`},{quoted:msg}); continue;
          }
          const old = PAIRED_NUMBERS[slot];
          removePair(slot);
          await sock.sendMessage(chatId,{text:`🗑 Removed paired number *${old}* from slot *${slot}*`},{quoted:msg});
          continue;
        }

        // ── V6: SETBOTS <n> — change saved bot count ──
        if (isCmd(text,"setbots")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const n = parseInt(getArg(text));
          if (!n || n < 1 || n > 20) {
            await sock.sendMessage(chatId,{text:`⚠️ Usage:
> ${PREFIX}setbots <1-20>\nThis saves the bot count so it's remembered on next restart.`},{quoted:msg}); continue;
          }
          saveBotCount(n);
          await sock.sendMessage(chatId,{
            text:
              `💾 *Bot count saved: ${n}*\n` +
              `> ✅ Next restart will auto-start *${n} bot(s)* without asking.\n` +
              `> 📝 No player data was affected.`
          },{quoted:msg});
          continue;
        }

        // ── V6: BACKUP — manual backup now ──
        if (isCmd(text,"backup")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const dir = doBackup("manual");
          if (dir) {
            const backups = listBackups();
            await sock.sendMessage(chatId,{
              text:
                `💾 *Manual Backup Created!*\n` +
                `> 📁 Saved: \`${path.basename(dir)}\`\n` +
                `> 🗂 Total backups stored: *${backups.length}*\n` +
                `> Economy, dragons, sudo, pairs, settings — all saved! ✅`
            },{quoted:msg});
          } else {
            await sock.sendMessage(chatId,{text:"❌ Backup failed! Check server logs."},{quoted:msg});
          }
          continue;
        }

        // ── V6: RESTOREBACKUP — restore most recent backup ──
        if (isCmd(text,"restorebackup")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const backups = listBackups();
          if (!backups.length) {
            await sock.sendMessage(chatId,{text:"❌ No backups found! Use /backup first."},{quoted:msg}); continue;
          }
          // First confirm, then restore (check for 'confirm' arg)
          if (getArg(text).toLowerCase() !== "confirm") {
            await sock.sendMessage(chatId,{
              text:
                `⚠️ *Restore Backup?*\n` +
                `> This will reload all player data from:\n` +
                `> 📁 \`${backups[0]}\`\n` +
                `> To confirm, type: *${PREFIX}restorebackup confirm*`
            },{quoted:msg}); continue;
          }
          const restored = restoreLatestBackup();
          if (restored) {
            await sock.sendMessage(chatId,{
              text:
                `✅ *Backup Restored!*\n` +
                `> 📁 From: \`${restored}\`\n` +
                `> All player data reloaded from backup. ♾️`
            },{quoted:msg});
          } else {
            await sock.sendMessage(chatId,{text:"❌ Restore failed! Check server logs."},{quoted:msg});
          }
          continue;
        }

        // ── V6: LISTBACKUPS — show all saved backups ──
        if (isCmd(text,"listbackups")) {
          if (!isOwner(sender)) { await sock.sendMessage(chatId,{text:_ui.err("Only Owner.")},{quoted:msg}); continue; }
          const backups = listBackups();
          if (!backups.length) {
            await sock.sendMessage(chatId,{text:"📂 No backups found yet. Use /backup to create one."},{quoted:msg}); continue;
          }
          const list = backups.map((b, i) => `> ${i === 0 ? "🟢" : "⚪"} ${b}`).join("\n");
          await sock.sendMessage(chatId,{
            text:`🗂 *Saved Backups (${backups.length}):*\n${list}\n> 🟢 = most recent`
          },{quoted:msg});
          continue;
        }

      } catch (err) {
        log(`❌ Error:`, err?.message || err);
      }
    }
  });
}


/* ================================================================
   ✦ TELEGRAM PANEL — Token-Gated Pair System
   ================================================================
   USER BOT  (TELEGRAM_BOT_TOKEN):
     - /start  → Welcome + token maango
     - /token <TOKEN> → Token validate + unlock karo
     - /pair <number> → Pair code lo (token required)
     - /cancel → Pairing cancel
     - /cleardata → Apna data delete karo

   ADMIN BOT (TELEGRAM_ADMIN_TOKEN):
     - /gentoken [days] → Naya token banao
     - /gentokens <n> [days] → Multiple tokens ek saath
     - /tokens → Sare tokens list karo
     - /revoketoken <TOKEN> → Token delete karo
     - /cleartokens → Sare expired tokens hatao
     - /stats → Panel stats

   Token structure (tg_tokens.json):
   {
     "ABC123XYZ": {
       createdAt: timestamp,
       expiresAt: timestamp | null,
       usedBy: telegramUserId | null,
       usedAt: timestamp | null
     }
   }
   ================================================================ */

// ── TOKEN HELPERS ──
function loadTokens()  { return loadJSON(TG_TOKENS_FILE, {}); }
function saveTokens(t) { saveJSON(TG_TOKENS_FILE, t); }

function generateTokenCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code; // e.g. ABCD-EFGH-JKLM
}

function isTokenValid(token) {
  const tokens = loadTokens();
  const t = tokens[token];
  if (!t) return { ok: false, reason: "Token exist nahi karta" };
  if (t.usedBy) return { ok: false, reason: "Token already use ho chuka hai" };
  if (t.expiresAt && Date.now() > t.expiresAt) return { ok: false, reason: "Token expire ho gaya" };
  return { ok: true };
}

function useToken(token, tgUserId) {
  const tokens = loadTokens();
  if (!tokens[token]) return false;
  tokens[token].usedBy = String(tgUserId);
  tokens[token].usedAt = Date.now();
  saveTokens(tokens);
  return true;
}

// tgVerified: Set of tgUserIds that have used a valid token
const tgVerified = new Set(
  Object.entries(loadTokens())
    .filter(([, t]) => t.usedBy)
    .map(([, t]) => String(t.usedBy))
);

function formatExpiry(ts) {
  if (!ts) return "♾️ No expiry";
  const diff = ts - Date.now();
  if (diff < 0) return "❌ Expired";
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hrs}h baki` : `${hrs}h baki`;
}

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "—";
}

// ── USER PANEL BOT ──
async function startTelegramPanel() {
  if (!TELEGRAM_BOT_TOKEN || !TelegramBot) {
    if (!TelegramBot && TELEGRAM_BOT_TOKEN) {
      log("⚠️  node-telegram-bot-api install nahi — chalaao: npm install node-telegram-bot-api");
    }
    return;
  }

  const tg = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  log("🤖 Telegram User Panel: ONLINE");

  const send = (chatId, text) =>
    tg.sendMessage(chatId, text, { parse_mode: "Markdown" }).catch(() => {});

  // Track pairing sessions: Map<chatId, { sock, phone }>
  const pairingSessions = new Map();

  // ── /start — Welcome + token gate ──
  tg.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name   = msg.from?.first_name || "User";
    const verified = tgVerified.has(String(chatId));

    if (verified) {
      return send(chatId,
        `╔══════════════════════════════╗\n` +
        `║  ♾️  *INFINITY BOT PANEL*  ♾️ ║\n` +
        `╚══════════════════════════════╝\n\n` +
        `Wapis aa gaye *${name}*! 👋\n\n` +
        `📱 \`/pair <number>\` — WhatsApp pair karo\n` +
        `🛑 \`/cancel\` — Pairing cancel karo\n` +
        `🗑️ \`/cleardata\` — Apna data delete karo\n\n` +
        `_Mazaa karo ♾️_`
      );
    }

    // Not verified — welcome + ask for token
    send(chatId,
      `╔══════════════════════════════╗\n` +
      `║  ♾️  *INFINITY BOT PANEL*  ♾️ ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `Salam *${name}*! 👋 Infinity Bot mein khush aamdeed!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔐 *Access Token Required*\n\n` +
      `Is bot ko use karne ke liye ek *Access Token* chahiye.\n\n` +
      `Token admin se lo, phir:\n` +
      `👉 \`/token XXXX-XXXX-XXXX\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Ek token sirf ek user ke liye hota hai._`
    );
  });

  // ── /token <TOKEN> — Validate and unlock ──
  tg.onText(/\/token(.*)/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const token  = (match[1] || "").trim().toUpperCase().replace(/\s+/g, "");

    if (!token) {
      return send(msg.chat.id,
        `⚠️ *Token dalo!*\n\nUsage: \`/token XXXX-XXXX-XXXX\``
      );
    }

    if (tgVerified.has(chatId)) {
      return send(msg.chat.id, "✅ Tum pehle se verified ho!\n`/pair <number>` se pair karo.");
    }

    const check = isTokenValid(token);
    if (!check.ok) {
      return send(msg.chat.id,
        `❌ *Token Invalid!*\n\n` +
        `Reason: ${check.reason}\n\n` +
        `_Sahi token admin se lo._`
      );
    }

    useToken(token, chatId);
    tgVerified.add(chatId);
    log(`✅ TG Token used: ${token} by user ${chatId}`);

    send(msg.chat.id,
      `✅ *Access Granted!* 🎉\n\n` +
      `Token verify ho gaya — ab tum bot use kar sakte ho!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 \`/pair <number>\` — WhatsApp pair karo\n\n` +
      `*Example:*\n` +
      `\`/pair 923001234567\` — Pakistan\n` +
      `\`/pair 919876543210\` — India\n\n` +
      `_Enjoy Infinity Bot! ♾️_`
    );
  });

  // ── ACCESS GATE — verified check karo before /pair ──
  const requireVerified = (chatId, fn) => {
    if (!tgVerified.has(String(chatId))) {
      send(chatId,
        `🔐 *Access Required!*\n\n` +
        `Pehle token use karo:\n\`/token XXXX-XXXX-XXXX\`\n\n` +
        `_Token admin se lo._`
      );
      return false;
    }
    return true;
  };

  // ── /pair <number> ──
  tg.onText(/\/pair(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!requireVerified(chatId)) return;

    let phone = (match[1] || "").trim().replace(/[^0-9]/g, "");

    if (!phone || phone.length < 7) {
      return send(chatId,
        `⚠️ *Number sahi nahi hai!*\n\n` +
        `Usage: \`/pair 923001234567\`\n` +
        `_Country code zaroor lagao_`
      );
    }

    // Cancel any existing pairing session for this chat
    const existing = pairingSessions.get(chatId);
    if (existing?.sock) {
      try { existing.sock.end(); } catch {}
      pairingSessions.delete(chatId);
    }

    // Find next available auth_bot slot
    const botSlot = allSocks.findIndex(s => !s) + 1 || allSocks.length + 1;
    const authDir = `./auth_bot_${botSlot}`;

    await send(chatId,
      `⏳ *${phone}* ke liye pair code generate ho raha hai...\n` +
      `> 🤖 Bot Slot: *${botSlot}*`
    );

    try {
      const { state, saveCreds } = await useMultiFileAuthState(authDir);
      const { version } = await fetchLatestBaileysVersion();
      const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        browser: ["Infinity Bot", "Chrome", "1.0"],
      });

      sock.ev.on("creds.update", saveCreds);
      allSocks[botSlot - 1] = sock; // ← Real slot mein add karo
      pairingSessions.set(chatId, { sock, phone, botSlot });

      try {
        // ── WA /pair jaisi proven pattern ──
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Timeout — socket connect nahi hua")), 15000);
          sock.ev.once("connection.update", ({ connection }) => {
            if (connection === "connecting" || connection === "open") {
              clearTimeout(timeout);
              resolve();
            }
          });
        });

        await sleep(800); // socket settle hone do
        const code = await sock.requestPairingCode(phone);
        const fmt  = code.match(/.{1,4}/g).join("-");

        await send(chatId,
          `╔══════════════════════════╗\n` +
          `║   🔑  *PAIR CODE*        ║\n` +
          `╚══════════════════════════╝\n\n` +
          `📱 Number: \`${phone}\`\n` +
          `🤖 Bot Slot: *${botSlot}*\n\n` +
          `🔐 *Tap karke copy karo 👇*\n` +
          `\`${fmt}\`\n\n` +
          `*Steps:*\n` +
          `1️⃣ WhatsApp kholo\n` +
          `2️⃣ ⋮ → *Linked Devices*\n` +
          `3️⃣ *Link with Phone Number*\n` +
          `4️⃣ Upar wala code enter karo ☝️\n\n` +
          `⏳ Link hone ka wait karo...`
        );
      } catch (err) {
        await send(chatId, `❌ Pair code error: \`${err?.message || err}\`\n\nDobara try karo: /pair ${phone}`);
        pairingSessions.delete(chatId);
        allSocks[botSlot - 1] = null;
        return;
      }

      // ── Connection events (after code sent) ──
      sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
          pairingSessions.delete(chatId);
          log(`✅ TG Pair: BOT ${botSlot} — ${phone} linked`);
          await send(chatId,
            `✅ *WhatsApp Linked!* 🎉\n\n` +
            `📱 \`${phone}\` — Bot Slot *${botSlot}* active!\n\n` +
            `Ab WhatsApp pe jaao:\n` +
            `➡️ Bot ko *DM* karo\n` +
            `➡️ \`/owner\` — bot claim karo\n` +
            `➡️ \`/help\` — sab commands dekho\n\n` +
            `_Infinity Bot ready hai! ♾️_`
          );
          saveBotCount(allSocks.filter(Boolean).length);
        }
        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          if (statusCode === DisconnectReason.loggedOut) {
            allSocks[botSlot - 1] = null;
            pairingSessions.delete(chatId);
            if (fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
            await send(chatId, `🚪 *Bot ${botSlot} logged out.*\nDobara pair karo: /pair ${phone}`);
          } else if (statusCode !== 401) {
            setTimeout(() => startBot(botSlot), 3000);
          }
        }
      });

    } catch (err) {
      allSocks[botSlot - 1] = null;
      await send(chatId, `❌ Error: \`${err?.message || err}\`\n\nDobara: /pair ${phone}`);
    }
  });

  // ── /cancel ──
  tg.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const sess   = pairingSessions.get(chatId);
    if (!sess) return send(chatId, "❌ Koi active pairing nahi hai.");
    try { sess.sock?.end(); } catch {}
    if (sess.botSlot) allSocks[sess.botSlot - 1] = null;
    pairingSessions.delete(chatId);
    const authDir = `./auth_bot_${sess.botSlot}`;
    if (sess.botSlot && fs.existsSync(authDir)) fs.rmSync(authDir, { recursive: true, force: true });
    await send(chatId, "🛑 *Pairing cancel ho gaya.*\nDobara: /pair <number>");
  });

  // ── /cleardata ──
  tg.onText(/\/cleardata(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!requireVerified(chatId)) return;

    if (!(match[1] || "").includes("confirm")) {
      return send(chatId,
        `🗑️ *CLEARDATA*\n\n` +
        `Yeh sirf *tumhara* data delete karega:\n` +
        `> 📁 Tumhara \`auth_bot_N\` session\n` +
        `> 🎵 \`temp_music\`\n` +
        `> 🎬 \`temp_video\`\n\n` +
        `⚠️ *Dusron ka data safe rahega!*\n\n` +
        `Confirm: \`/cleardata confirm\``
      );
    }

    const sess = pairingSessions.get(chatId);
    if (sess?.sock) { try { sess.sock.end(); } catch {} pairingSessions.delete(chatId); }

    let deleted = [];

    // Delete only this user's bot slot auth folder
    if (sess?.botSlot) {
      const slotDir = `./auth_bot_${sess.botSlot}`;
      if (fs.existsSync(slotDir)) {
        fs.rmSync(slotDir, { recursive: true, force: true });
        allSocks[sess.botSlot - 1] = null;
        deleted.push(`✅ \`auth_bot_${sess.botSlot}\` deleted`);
      } else {
        deleted.push(`⚪ \`auth_bot_${sess.botSlot}\` — already empty`);
      }
    } else {
      deleted.push(`⚪ No active session found`);
    }
    for (const tmpDir of ["./temp_music", "./temp_video"]) {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        deleted.push(`✅ \`${tmpDir}\` deleted`);
      } else {
        deleted.push(`⚪ \`${tmpDir}\` — already empty`);
      }
    }

    await send(chatId,
      `✅ *Tumhara data clear ho gaya!*\n\n` +
      deleted.join("\n") + "\n\n" +
      `_Dobara pair karne ke liye: /pair <number>_`
    );
  });

  // ── /clear — quick wipe (apna auth + temp, no confirm needed) ──
  tg.onText(/\/clear$/, async (msg) => {
    const chatId = msg.chat.id;
    if (!requireVerified(chatId)) return;

    const sess = pairingSessions.get(chatId);
    if (sess?.sock) { try { sess.sock.end(); } catch {} pairingSessions.delete(chatId); }

    let deleted = [];

    // Sirf is user ka auth_bot_N delete karo
    if (sess?.botSlot) {
      const slotDir = `./auth_bot_${sess.botSlot}`;
      if (fs.existsSync(slotDir)) {
        fs.rmSync(slotDir, { recursive: true, force: true });
        allSocks[sess.botSlot - 1] = null;
        deleted.push(`✅ \`auth_bot_${sess.botSlot}\``);
      }
    }

    // Temp folders
    for (const tmpDir of ["./temp_music", "./temp_video"]) {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        deleted.push(`✅ \`${tmpDir}\``);
      }
    }

    await send(chatId,
      `🗑️ *Cleared!*\n\n` +
      (deleted.length ? deleted.join("\n") : "⚪ Kuch tha hi nahi") + "\n\n" +
      `_Dobara pair: /pair <number>_`
    );
  });

  tg.on("polling_error", err => log("⚠️ TG User Panel polling error:", err?.message || err));
  log("✅ Telegram User Panel ready.");
}

// ── ADMIN PANEL BOT ──
async function startAdminPanel() {
  if (!TELEGRAM_ADMIN_TOKEN || !TelegramBot) {
    if (!TelegramBot && TELEGRAM_ADMIN_TOKEN) {
      log("⚠️  node-telegram-bot-api install nahi — chalaao: npm install node-telegram-bot-api");
    }
    return;
  }
  if (TELEGRAM_ADMIN_IDS.size === 0) {
    log("⚠️  TELEGRAM_ADMIN_IDS empty hai — admin panel nahi chalega. IDs set karo.");
    return;
  }

  const admin = new TelegramBot(TELEGRAM_ADMIN_TOKEN, { polling: true });
  log("👑 Telegram Admin Panel: ONLINE");

  const send = (chatId, text) =>
    admin.sendMessage(chatId, text, { parse_mode: "Markdown" }).catch(() => {});

  const isAdmin = (id) => TELEGRAM_ADMIN_IDS.has(id);

  // ── /start ──
  admin.onText(/\/start/, (msg) => {
    if (!isAdmin(msg.from.id)) return send(msg.chat.id, "❌ Access denied.");
    send(msg.chat.id,
      `╔══════════════════════════════╗\n` +
      `║  👑  *INFINITY ADMIN PANEL*  ║\n` +
      `╚══════════════════════════════╝\n\n` +
      `*Token Management:*\n` +
      `> \`/gentoken [days]\` — 1 token banao\n` +
      `> \`/gentokens <n> [days]\` — Multiple tokens\n` +
      `> \`/tokens\` — Sare tokens dekho\n` +
      `> \`/revoketoken <TOKEN>\` — Token delete karo\n` +
      `> \`/cleartokens\` — Sare expired tokens hatao\n\n` +
      `*Stats:*\n` +
      `> \`/stats\` — Panel stats dekho\n\n` +
      `_Example: \`/gentoken 7\` — 7 din wala token_\n` +
      `_Example: \`/gentokens 5 30\` — 5 tokens, 30 din_`
    );
  });

  // ── /gentoken [days] — Single token generate ──
  admin.onText(/\/gentoken(.*)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return send(msg.chat.id, "❌ Access denied.");
    const days    = parseInt((match[1] || "").trim()) || null;
    const token   = generateTokenCode();
    const tokens  = loadTokens();
    tokens[token] = {
      createdAt: Date.now(),
      expiresAt: days ? Date.now() + days * 86400000 : null,
      createdBy: msg.from.id,
      usedBy:    null,
      usedAt:    null,
    };
    saveTokens(tokens);
    log(`👑 Admin generated token: ${token} (expiry: ${days ? days + "d" : "never"})`);

    send(msg.chat.id,
      `✅ *Naya Token Ready!*\n\n` +
      `🔑 Token:\n\`${token}\`\n\n` +
      `⏳ Expiry: ${days ? `*${days} din*` : "*No expiry*"}\n` +
      `📅 Expires: ${days ? formatDate(tokens[token].expiresAt) : "♾️ Kabhi nahi"}\n\n` +
      `_Yeh token sirf ek user ke liye kaam karega._\n\n` +
      `User ko bolo:\n\`/token ${token}\``
    );
  });

  // ── /gentokens <n> [days] — Multiple tokens ──
  admin.onText(/\/gentokens(.*)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return send(msg.chat.id, "❌ Access denied.");
    const parts = (match[1] || "").trim().split(/\s+/);
    const n     = parseInt(parts[0]) || 1;
    const days  = parseInt(parts[1]) || null;

    if (n > 50) return send(msg.chat.id, "❌ Max 50 tokens ek baar mein.");

    const tokens   = loadTokens();
    const newTokens = [];
    for (let i = 0; i < n; i++) {
      const token  = generateTokenCode();
      tokens[token] = {
        createdAt: Date.now(),
        expiresAt: days ? Date.now() + days * 86400000 : null,
        createdBy: msg.from.id,
        usedBy:    null,
        usedAt:    null,
      };
      newTokens.push(token);
    }
    saveTokens(tokens);
    log(`👑 Admin generated ${n} tokens (expiry: ${days ? days + "d" : "never"})`);

    const list = newTokens.map((t, i) => `${i + 1}. \`${t}\``).join("\n");
    send(msg.chat.id,
      `✅ *${n} Tokens Ready!*\n\n` +
      `⏳ Expiry: ${days ? `*${days} din*` : "*No expiry*"}\n\n` +
      `${list}\n\n` +
      `_Har token ek user ke liye._`
    );
  });

  // ── /tokens — List all tokens ──
  admin.onText(/\/tokens/, async (msg) => {
    if (!isAdmin(msg.from.id)) return send(msg.chat.id, "❌ Access denied.");
    const tokens = loadTokens();
    const all    = Object.entries(tokens);

    if (!all.length) return send(msg.chat.id, "📭 Koi token nahi hai abhi.");

    const unused   = all.filter(([, t]) => !t.usedBy && (!t.expiresAt || Date.now() < t.expiresAt));
    const used     = all.filter(([, t]) => t.usedBy);
    const expired  = all.filter(([, t]) => !t.usedBy && t.expiresAt && Date.now() > t.expiresAt);

    let msg_text =
      `🗂 *TOKEN LIST*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ Active: ${unused.length} | ✔️ Used: ${used.length} | ❌ Expired: ${expired.length}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (unused.length) {
      msg_text += `*🟢 UNUSED TOKENS:*\n`;
      for (const [tok, t] of unused) {
        msg_text += `\`${tok}\`\n> ${formatExpiry(t.expiresAt)}\n`;
      }
      msg_text += "\n";
    }
    if (used.length) {
      msg_text += `*✔️ USED TOKENS:*\n`;
      for (const [tok, t] of used.slice(0, 10)) { // max 10
        msg_text += `\`${tok}\`\n> Used by: \`${t.usedBy}\` on ${formatDate(t.usedAt)}\n`;
      }
      if (used.length > 10) msg_text += `_...aur ${used.length - 10} used tokens_\n`;
      msg_text += "\n";
    }
    if (expired.length) {
      msg_text += `*❌ EXPIRED TOKENS:* ${expired.length} tokens\n`;
      msg_text += `_/cleartokens se hatao_\n`;
    }

    send(msg.chat.id, msg_text);
  });

  // ── /revoketoken <TOKEN> — Delete a token ──
  admin.onText(/\/revoketoken(.*)/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return send(msg.chat.id, "❌ Access denied.");
    const token  = (match[1] || "").trim().toUpperCase();
    if (!token)  return send(msg.chat.id, "⚠️ Usage: `/revoketoken XXXX-XXXX-XXXX`");
    const tokens = loadTokens();
    if (!tokens[token]) return send(msg.chat.id, `❌ Token \`${token}\` nahi mila.`);
    const wasUsed = !!tokens[token].usedBy;
    delete tokens[token];
    saveTokens(tokens);
    send(msg.chat.id,
      `🗑️ *Token Revoked!*\n\n` +
      `Token: \`${token}\`\n` +
      `Status: ${wasUsed ? "Was already used" : "Was unused"}`
    );
  });

  // ── /cleartokens — Delete all expired tokens ──
  admin.onText(/\/cleartokens/, async (msg) => {
    if (!isAdmin(msg.from.id)) return send(msg.chat.id, "❌ Access denied.");
    const tokens  = loadTokens();
    const before  = Object.keys(tokens).length;
    const cleaned = Object.fromEntries(
      Object.entries(tokens).filter(([, t]) =>
        t.usedBy || !t.expiresAt || Date.now() < t.expiresAt
      )
    );
    const removed = before - Object.keys(cleaned).length;
    saveTokens(cleaned);
    send(msg.chat.id,
      `♻️ *Cleanup Done!*\n\n` +
      `> ❌ Expired tokens removed: *${removed}*\n` +
      `> ✅ Remaining: *${Object.keys(cleaned).length}*`
    );
  });

  // ── /stats ──
  admin.onText(/\/stats/, async (msg) => {
    if (!isAdmin(msg.from.id)) return send(msg.chat.id, "❌ Access denied.");
    const tokens  = loadTokens();
    const all     = Object.values(tokens);
    const total   = all.length;
    const used    = all.filter(t => t.usedBy).length;
    const active  = all.filter(t => !t.usedBy && (!t.expiresAt || Date.now() < t.expiresAt)).length;
    const expired = all.filter(t => !t.usedBy && t.expiresAt && Date.now() > t.expiresAt).length;
    const verifiedCount = tgVerified.size;

    send(msg.chat.id,
      `📊 *ADMIN STATS*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔑 Total Tokens: *${total}*\n` +
      `🟢 Active (unused): *${active}*\n` +
      `✔️ Used: *${used}*\n` +
      `❌ Expired: *${expired}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 Verified Users: *${verifiedCount}*\n` +
      `🤖 WA Bots Active: *${allSocks.filter(Boolean).length}*\n` +
      `⏱ Uptime: *${formatUptime(Date.now() - START_TIME)}*`
    );
  });

  admin.on("polling_error", err => log("⚠️ TG Admin Panel polling error:", err?.message || err));
  log("✅ Telegram Admin Panel ready.");
}
/* ============ START ============ */

// Auto-detect existing auth_bot_* sessions and restore them
function autoRestoreSessions() {
  const dirs = fs.readdirSync(".").filter(d => /^auth_bot_\d+$/.test(d));
  if (dirs.length === 0) {
    log("ℹ️  Koi saved session nahi mili — Telegram pe /pair karo");
    return;
  }
  const slots = dirs.map(d => parseInt(d.replace("auth_bot_", ""))).sort((a,b)=>a-b);
  log(`♻️  ${slots.length} saved session(s) mili — auto-restoring: ${slots.join(", ")}`);
  for (const slot of slots) startBot(slot);
  saveBotCount(slots.length);
}

function launchBots(c) {
  saveBotCount(c);
  console.log(`\n╔══════════════════════════════╗`);
  console.log(`║   ♾️   INFINITY BOT V9   ♾️   ║`);
  console.log(`╚══════════════════════════════╝`);
  console.log(`🤖 Starting ${c} bot(s)...`);
  console.log(`💡 Pair karne ke liye: Telegram bot pe /pair <number>\n`);
  for (let i = 1; i <= c; i++) startBot(i);
  startTelegramPanel().catch(err => log("❌ Telegram User Panel Error:", err?.message || err));
  startAdminPanel().catch(err => log("❌ Telegram Admin Panel Error:", err?.message || err));
}

// Startup: restore existing sessions OR start fresh
const _existingDirs = fs.readdirSync(".").filter(d => /^auth_bot_\d+$/.test(d));
if (_existingDirs.length > 0) {
  console.log(`\n╔══════════════════════════════╗`);
  console.log(`║   ♾️   INFINITY BOT V9   ♾️   ║`);
  console.log(`╚══════════════════════════════╝`);
  autoRestoreSessions();
  startTelegramPanel().catch(err => log("❌ Telegram User Panel Error:", err?.message || err));
  startAdminPanel().catch(err => log("❌ Telegram Admin Panel Error:", err?.message || err));
} else {
  // No sessions — start TG panels only, wait for /pair
  console.log(`\n╔══════════════════════════════╗`);
  console.log(`║   ♾️   INFINITY BOT V9   ♾️   ║`);
  console.log(`╚══════════════════════════════╝`);
  console.log(`ℹ️  Koi WhatsApp session nahi hai`);
  console.log(`📱 Telegram pe /pair <number> bhejo pair karne ke liye\n`);
  startTelegramPanel().catch(err => log("❌ Telegram User Panel Error:", err?.message || err));
  startAdminPanel().catch(err => log("❌ Telegram Admin Panel Error:", err?.message || err));
}
