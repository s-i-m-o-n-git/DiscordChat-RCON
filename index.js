const { Client, GatewayIntentBits } = require("discord.js");
const { Rcon } = require("rcon-client");
const http = require("http");
const https = require("https");
const fs = require("fs");
const config = require("./config.json");

// ➤ Connexion à Discord
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

discordClient.once("ready", () => {
  console.log(`[Discord] Connecté en tant que ${discordClient.user.tag}`);
});

// ➤ Reconnexion Discord
async function loginDiscordWithRetry(retries = -1, delay = 5000) {
  for (let attempt = 1; retries === -1 || attempt <= retries; attempt++) {
    try {
      await discordClient.login(config.discordToken);
      console.log("[Discord] Connexion réussie.");
      return;
    } catch (err) {
      console.error(`[Discord] Connexion échouée (tentative ${attempt})`, err);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

discordClient.on("error", (err) => {
  console.error("[Discord ERROR]", err);
});

discordClient.on("disconnect", async () => {
  console.warn("[Discord] Déconnecté. Tentative de reconnexion...");
  await loginDiscordWithRetry(-1);
});

discordClient.on("shardError", error => {
  console.error('[Discord] Erreur de shard:', error);
});

// ➤ Connexion à RCON
let rcon;

async function connectRconWithRetry(retries = -1, delay = 5000) {
  for (let attempt = 1; retries === -1 || attempt <= retries; attempt++) {
    try {
      rcon = await Rcon.connect({
        host: config.rcon.host,
        port: config.rcon.port,
        password: config.rcon.password,
      });
      console.log("[RCON] Connecté au serveur Minecraft.");
      rcon.on("end", async () => {
        console.warn("[RCON] Déconnecté. Tentative de reconnexion...");
        await connectRconWithRetry(-1);
      });
      return;
    } catch (err) {
      console.error(`[RCON] Connexion échouée (tentative ${attempt})`, err);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

// ➤ Traitement des messages Discord ➜ Minecraft
discordClient.on("messageCreate", async (message) => {
  if (message.author.bot || message.channel.id !== config.discordChannelId) return;

  const mcMessage = `tellraw @a {"text":"[Discord] ${message.author.username}: ${message.content}","color":"gold"}`;
  try {
    await rcon.send(mcMessage);
    console.log(`[RCON] ${message.author.username}: ${message.content}`);
  } catch (err) {
    console.error("[RCON ERROR]", err);
  }
});

// ➤ Envoi au webhook Discord avec avatar Minotar
function sendToWebhook(displayName, message) {
  if (!config.webhookUrl) return console.error("Webhook non défini dans la config.");

  let usernameOnly = displayName.trim();
  if (usernameOnly.includes(" ")) {
    const parts = usernameOnly.split(/\s+/);
    usernameOnly = parts[parts.length - 1];
  }

  const sanitizedAvatarName = usernameOnly.replace(/[^a-zA-Z0-9_\-]/g, "") || "MinecraftUser";
  const sanitizedMessage = message.replace(/[\r\n]+/g, " ").trim();
  const avatarUrl = `https://minotar.net/avatar/${encodeURIComponent(sanitizedAvatarName)}?rand=${Date.now()}`;

  const payload = JSON.stringify({
    username: displayName,
    content: sanitizedMessage || "(message vide)",
    avatar_url: avatarUrl
  });

  const webhook = new URL(config.webhookUrl);
  const options = {
    hostname: webhook.hostname,
    path: webhook.pathname + webhook.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      "User-Agent": "Node.js/DiscordChat"
    }
  };

  const req = https.request(options, (res) => {
    if (res.statusCode !== 204) {
      console.error(`[Webhook] Échec: code ${res.statusCode}`);
      res.on("data", (chunk) => {
        console.error("Réponse Discord :", chunk.toString());
      });
    }
  });

  req.on("error", (err) => {
    console.error("[Webhook ERROR]", err);
  });

  req.write(payload);
  req.end();
}

// ➤ Serveur HTTP pour recevoir les messages Minecraft ➜ Discord
const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/minecraft/hook") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      const line = body.toString();
      const match = line.match(/<([^>]+)> (.+)/);
      if (match) {
        const [_, displayName, message] = match;
        sendToWebhook(displayName, message);
        console.log(`[MC ➜ Discord] ${displayName}: ${message}`);
      }
      res.writeHead(200);
      res.end("OK");
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(25504, () => {
  console.log("[HTTP] Serveur en écoute sur le port 25504 pour recevoir les logs Minecraft.");
});

// ➤ Lancement automatique avec reconnexions infinies
(async () => {
  await connectRconWithRetry(-1);      // -1 = tentatives illimitées
  await loginDiscordWithRetry(-1);     // -1 = tentatives illimitées
})();
