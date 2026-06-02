# OctoPrint Matter Status

Plugin [Homebridge](https://homebridge.io) 2 qui expose l’état d’impression de vos imprimantes [OctoPrint](https://octoprint.org/) comme capteurs **Matter**. Chaque imprimante apparaît dans Apple Home, Google Home, Amazon Alexa, Home Assistant ou tout autre contrôleur Matter compatible — avec le nom que vous choisissez.

**Paquet npm :** `homebridge-octoprint-matter-status`

## Fonctionnement

| État OctoPrint | Capteur Matter (défaut : occupancy) |
|----------------|-------------------------------------|
| Impression en cours (`flags.printing` ou transitions pausing/cancelling/finishing) | Détecté / occupé |
| Idle, opérationnel, pas en impression | Inactif |
| OctoPrint injoignable | Dernier état conservé (pas de bascule intempestive) |

Le plugin interroge OctoPrint via `GET /api/printer` (polling configurable). Aucune modification côté serveur OctoPrint n’est requise.

## Prérequis

- **Homebridge** ≥ 2.0.0 avec **Matter activé** sur le bridge principal ou sur un child bridge (`bridge.matter` ou `_bridge.matter`)
- **Node.js** 22 ou 24 (LTS)
- Une ou plusieurs instances **OctoPrint** accessibles depuis le réseau où tourne Homebridge
- Une **clé API** OctoPrint par imprimante, avec au minimum la permission **STATUS** (clé utilisateur ou Application Key — pas la clé globale dépréciée)

## Installation

### Via Homebridge Config UI X

1. Installez le plugin depuis l’onglet **Plugins** (une fois publié sur npm), ou en mode développement :

   ```bash
   cd /path/to/homebridge
   npm install -g /chemin/vers/homebridge-octoprint-matter-status
   ```

2. Redémarrez Homebridge.

3. Ajoutez la plateforme **OctoPrint Matter Status** dans la configuration.

### Configuration manuelle (`config.json`)

```json
{
  "platforms": [
    {
      "platform": "OctoPrintMatterStatus",
      "name": "OctoPrint Matter Status",
      "debug": false,
      "printers": [
        {
          "id": "mk3s",
          "sensorName": "Prusa MK3S Printing",
          "octoprintUrl": "http://octopi.local",
          "apiKey": "VOTRE_CLE_API",
          "sensorType": "occupancy",
          "enabled": true,
          "pollIntervalSeconds": 10,
          "invertState": false
        }
      ]
    }
  ]
}
```

> **Migration** : si vous utilisiez une version antérieure avec `"platform": "OctoPrintMatter"`, remplacez par `"OctoPrintMatterStatus"` et réappairez Matter si les capteurs ne réapparaissent pas (l’UUID Matter a changé).

## Configuration dans l’interface

Le plugin fournit une **interface dédiée** dans Homebridge Config UI X :

- Ajouter / supprimer des imprimantes
- **Nom du capteur** (`sensorName`) — nom affiché dans HomeKit / Matter au premier appairage
- URL OctoPrint et clé API (masquée)
- Type de capteur : **Occupancy / Motion** (recommandé) ou **Contact**
- Intervalle de polling, activation, inversion d’état
- Bouton **Tester la connexion** par imprimante (la clé API n’est jamais envoyée au navigateur ; le test passe par le serveur du plugin)

### Champs par imprimante

| Champ | Description |
|-------|-------------|
| `id` | Identifiant unique et **stable** (ex. `mk3s`). Ne pas le modifier après l’appairage Matter. |
| `sensorName` | Nom du capteur dans les apps domotiques (ex. `Voron 2.4 Printing`). |
| `octoprintUrl` | URL complète, ex. `http://192.168.1.50` ou `http://octopi.local`. |
| `apiKey` | Clé API OctoPrint (permission STATUS). |
| `sensorType` | `occupancy` (défaut) ou `contact`. |
| `enabled` | Désactiver temporairement sans supprimer l’entrée. |
| `pollIntervalSeconds` | Fréquence de lecture (min. 2 s, défaut 10). |
| `invertState` | Inverser actif/inactif si besoin pour des automatisations. |

## Clé API OctoPrint

1. Dans OctoPrint : **Paramètres** → **Clés API** (ou **Application Keys**).
2. Créez une clé avec la permission **STATUS** (lecture de l’état imprimante).
3. Collez-la dans la configuration du plugin.

Référence : [OctoPrint API — General information](https://docs.octoprint.org/en/master/api/general.html)

## Activer Matter et appairer

1. Dans Homebridge Config UI X, activez **Matter** sur le bridge qui héberge ce plugin (ou sur le child bridge dédié).
2. Redémarrez le bridge.
3. Scannez le **code QR Matter** affiché par Homebridge dans l’app de votre choix (Maison, Google Home, etc.).
4. Chaque imprimante configurée et activée apparaît comme un capteur nommé selon `sensorName`.

> Matter et HomeKit via Homebridge sont des appairages **séparés**. Les capteurs Matter ne s’affichent pas dans l’écran accessoires classique de Homebridge ; ils sont gérés par le contrôleur Matter.

## Types de capteurs

- **Occupancy / Motion** (défaut) — adapté à « l’imprimante est en train d’imprimer ».
- **Contact** — sémantique ouvert/fermé Matter inversée côté protocole ; utile si votre écosystème le préfère.

## Développement

```bash
git clone https://github.com/blaisebarrette/Octoprint-homekit-connection.git
cd Octoprint-homekit-connection
npm install
npm run build      # compile vers dist/
npm test           # tests unitaires
npm run lint
npm run typecheck
```

Lien symbolique pour tester localement dans Homebridge :

```bash
npm link
# puis dans le répertoire Homebridge :
npm link homebridge-octoprint-matter-status
```

## Dépannage

| Symptôme | Piste |
|----------|--------|
| Aucun capteur dans Matter | Vérifier que Matter est activé sur le bon bridge et redémarrer. |
| « Matter n’est pas activé » dans les logs | Ajouter `matter: true` (ou bloc `matter` selon votre version HB) au bridge. |
| Test de connexion : 401/403 | Clé API invalide ou permission STATUS manquante. |
| Test OK mais capteur toujours inactif | Vérifier qu’une impression est bien en cours (`flags.printing`). |
| Capteur qui change de nom après renommage | Le nom Matter est fixé à l’appairage ; modifier `sensorName` peut nécessiter de retirer/réajouter le capteur côté contrôleur. |

## Licence

MIT — voir `package.json`.

## Crédits

- [Homebridge](https://homebridge.io) et l’API Matter v2
- [OctoPrint](https://octoprint.org/) API
