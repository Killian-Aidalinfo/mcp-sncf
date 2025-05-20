# mcp-sncf

Un serveur MCP (Model Context Protocol) pour rechercher les trains SNCF et obtenir des informations sur les trajets.

## Installation

```bash
npm install mcp-sncf
# ou avec pnpm
pnpm add mcp-sncf
# ou avec yarn
yarn add mcp-sncf
```

## Prérequis

Vous devez disposer d'une clé API SNCF pour utiliser ce service. Vous pouvez l'obtenir sur [le portail développeurs de la SNCF](https://www.digital.sncf.com/startup/api).

## Configuration avec MCPClient

Intégrez mcp-sncf dans votre application MCP en configurant un client MCP comme ceci:

```typescript
import { MCPClient } from "@modelcontextprotocol/sdk";

// Configuration du client MCP avec le serveur SNCF
const mcp = new MCPClient({
  servers: {
    sncf: {
      command: "npx",
      args: ["mcp-sncf"],
      env: {
        SNCF_API_KEY: "votre-clé-api-sncf", // Remplacez par votre clé API SNCF
      },
      timeout: 20000, // Délai d'attente spécifique au serveur
    },
  },
});

// Vous pouvez maintenant utiliser les outils SNCF via le client MCP
```

## Outils disponibles

### sncf_search_train

Recherche les trains entre deux villes.

```typescript
const result = await mcp.callTool("sncf", "sncf_search_train", {
  from: "Paris",
  to: "Lyon",
  datetime: "20250520T080000" // Format YYYYMMDDTHHmmss (optionnel)
});
```

### sncf_train_details

Obtient les détails d'un train spécifique à partir de son identifiant.

```typescript
const result = await mcp.callTool("sncf", "sncf_train_details", {
  vehicle_journey_id: "vehicle_journey:SNCF:2025-05-20:88721:1187:Train"
});
```

## Environnement de développement

1. Cloner ce dépôt
2. Installer les dépendances: `pnpm install`
3. Créer un fichier `.env` avec votre clé API: `SNCF_API_KEY=votre-clé-api`
4. Compiler le projet: `pnpm build`
5. Lancer le serveur: `pnpm start`

## Licence

ISC