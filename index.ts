#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const SNCF_SEARCH_TOOL: Tool = {
  name: "sncf_search_train",
  description:
    "Recherche les trains entre deux villes via l'API SNCF. Fournit les horaires, durées et correspondances.",
  inputSchema: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Ville ou gare de départ",
      },
      to: {
        type: "string",
        description: "Ville ou gare d'arrivée",
      },
      datetime: {
        type: "string",
        description:
          "Date et heure de départ au format YYYYMMDDTHHmmss (optionnel)",
      },
    },
    required: ["from", "to"],
  },
};

const SNCF_TRAIN_DETAILS_TOOL: Tool = {
  name: "sncf_train_details",
  description:
    "Donne les détails d'un train SNCF à partir de son identifiant vehicle_journey.",
  inputSchema: {
    type: "object",
    properties: {
      vehicle_journey_id: {
        type: "string",
        description:
          "Identifiant vehicle_journey du train (ex: vehicle_journey:SNCF:2025-05-20:88721:1187:Train)",
      },
    },
    required: ["vehicle_journey_id"],
  },
};

const server = new Server(
  {
    name: "sncf-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const SNCF_API_KEY = process.env.SNCF_API_KEY;
if (!SNCF_API_KEY) {
  console.error("Error: SNCF_API_KEY environment variable is required");
  process.exit(1);
}

async function getStopArea(city: string): Promise<string | null> {
  const resp = await axios.get(
    `https://api.sncf.com/v1/coverage/sncf/places?q=${encodeURIComponent(
      city
    )}`,
    { auth: { username: SNCF_API_KEY as string, password: "" } }
  );
  const stop = (resp.data.places || []).find((p: any) => p.stop_area);
  return stop?.stop_area?.id || null;
}

async function searchTrains(from: string, to: string, datetime?: string) {
  const fromId = await getStopArea(from);
  if (!fromId) throw new Error(`Aucun stop_area trouvé pour ${from}`);
  const toId = await getStopArea(to);
  if (!toId) throw new Error(`Aucun stop_area trouvé pour ${to}`);
  const dateParam = datetime
    ? `&datetime=${datetime}&datetime_represents=departure`
    : "";
  const url = `https://api.sncf.com/v1/coverage/sncf/journeys?from=${fromId}&to=${toId}${dateParam}&count=10`;
  const resp = await axios.get(url, {
    auth: { username: SNCF_API_KEY as string, password: "" },
  });
  const journeys = (resp.data.journeys || []).map((j: any) => ({
    departure: j.departure_date_time,
    arrival: j.arrival_date_time,
    duration: j.duration,
    nb_transfers: j.nb_transfers,
    sections: j.sections.map((s: any) => ({
      from: s.from ? s.from.name || "" : "",
      to: s.to ? s.to.name || "" : "",
      mode: s.mode,
      type: s.type,
      duration: s.duration,
    })),
  }));
  return journeys;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [SNCF_SEARCH_TOOL, SNCF_TRAIN_DETAILS_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    if (name === "sncf_train_details") {
      if (!args || typeof args !== "object" || !args.vehicle_journey_id) {
        return {
          content: [
            { type: "text", text: "Argument 'vehicle_journey_id' requis" },
          ],
          isError: true,
        };
      }
      try {
        const { vehicle_journey_id } = args as { vehicle_journey_id: string };
        const url = `https://api.sncf.com/v1/coverage/sncf/vehicle_journeys/${encodeURIComponent(
          vehicle_journey_id
        )}`;
        const resp = await axios.get(url, {
          auth: { username: SNCF_API_KEY, password: "" },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(resp.data, null, 2) }],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Erreur: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
    if (name !== "sncf_search_train") {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    if (!args || typeof args !== "object" || !args.from || !args.to) {
      return {
        content: [{ type: "text", text: "Arguments 'from' et 'to' requis" }],
        isError: true,
      };
    }
    const { from, to, datetime } = args as {
      from: string;
      to: string;
      datetime?: string;
    };
    const journeys = await searchTrains(from, to, datetime);
    if (!journeys.length) {
      return {
        content: [{ type: "text", text: "Aucun trajet trouvé." }],
        isError: false,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(journeys, null, 2) }],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Erreur: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SNCF MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
