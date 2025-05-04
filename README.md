# DiscordChat-RCON

Ce projet permet de relier un serveur Minecraft au chat d'un salon Discord, dans les deux sens. Les messages envoyés sur Discord apparaissent dans Minecraft, et les messages du chat Minecraft apparaissent dans un salon Discord via un webhook.

## Fonctionnalités

* Relais des messages de Discord vers Minecraft via RCON (`tellraw`)
* Relais des messages de Minecraft vers Discord via un webhook
* Affichage des avatars Minecraft dans Discord via l'API Minotar
* Serveur HTTP intégré pour recevoir les logs Minecraft

## Prérequis

* Node.js (v16 ou supérieur)
* Un bot Discord avec les permissions d'accès aux messages
* Accès RCON activé sur votre serveur Minecraft
* Accès au fichier `latest.log` de Minecraft (via `tail`)

## Installation

1. Clonez le dépôt :

```bash
git clone https://github.com/votre-utilisateur/discordchat-rcon.git
cd discordchat-rcon
```

2. Installez les dépendances :

```bash
npm install
```

3. Créez un fichier `config.json` à la racine avec le contenu suivant :

```json
{
  "discordToken": "VOTRE_TOKEN_DISCORD",
  "discordChannelId": "ID_DU_SALON_DISCORD",
  "webhookUrl": "URL_DU_WEBHOOK_DISCORD",
  "rcon": {
    "host": "ADRESSE_IP_DU_SERVEUR",
    "port": 25575,
    "password": "VOTRE_MOT_DE_PASSE_RCON"
  }
}
```

## Lancement

```bash
node index.js
```

## Récupération des messages Minecraft

Lancez cette commande Bash sur le serveur hébergeant Minecraft (assurez-vous que l'IP et le chemin vers `latest.log` sont corrects) :

```bash
tail -F chemin/vers/logs/latest.log \
| grep --line-buffered ": <" \
| while read x; do
  echo -ne "$x" | curl -X POST -H "X-Token: SECRET123" -d @- http://ip-server-nodejs:port/minecraft/hook
  done
```

Cette commande lit en temps réel les messages de chat dans les logs Minecraft et les envoie au serveur HTTP local qui les relaie à Discord.

## Sécurité

* Pensez à **ne jamais partager** votre `config.json` publiquement, notamment le token Discord, le webhook et les identifiants RCON.
* Vous pouvez renforcer la sécurité du webhook HTTP en validant un en-tête `X-Token` ou en ajoutant une authentification.

## Auteur

Projet initial par Simon.

---

N'hésitez pas à ouvrir une issue ou une pull request pour améliorer le projet !
