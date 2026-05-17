import {
  EventPicTemplateRequest,
  EventPicTemplateRequestAutomation
} from "@/src/shared/eventPicTemplates";
import { updateEventPicTemplateRequestAutomation } from "@/src/server/eventPicTemplateRequests";

type CanvaConfig = {
  accessToken: string;
  rootFolderId: string;
};

type CanvaFolderData = {
  id: string;
  name: string;
  url: string | null;
};

type CanvaCreateFolderResponse = {
  folder?: {
    id?: string;
    name?: string;
  };
};

function getCanvaConfig(): CanvaConfig | null {
  const accessToken = process.env.CANVA_ACCESS_TOKEN;
  const rootFolderId = process.env.CANVA_ROOT_FOLDER_ID || "root";

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    rootFolderId
  };
}

function sanitizeFolderName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 255);
}

function getClientName(request: EventPicTemplateRequest) {
  return `${request.client.first_name} ${request.client.last_name}`.trim();
}

async function createCanvaFolder(name: string, parentFolderId: string, config: CanvaConfig): Promise<CanvaFolderData> {
  const response = await fetch("https://api.canva.com/rest/v1/folders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: sanitizeFolderName(name),
      parent_folder_id: parentFolderId
    })
  });

  const payload = (await response.json().catch(() => ({}))) as CanvaCreateFolderResponse;
  const folder = payload.folder;

  if (!response.ok || !folder?.id) {
    throw new Error(`Création du dossier Canva impossible (${response.status}).`);
  }

  return {
    id: folder.id,
    name: folder.name ?? name,
    url: `https://www.canva.com/folder/${folder.id}`
  };
}

export async function createEventFolder(request: EventPicTemplateRequest) {
  const config = getCanvaConfig();

  if (!config) {
    throw new Error("Intégration Canva non configurée.");
  }

  return createCanvaFolder(`Event Pic - ${getClientName(request)} - ${request.event.date}`, config.rootFolderId, config);
}

export async function createSubfolderForTemplates(request: EventPicTemplateRequest) {
  const config = getCanvaConfig();

  if (!config) {
    throw new Error("Intégration Canva non configurée.");
  }

  const parentFolderId = request.automation.canva_folder_id ?? config.rootFolderId;
  return createCanvaFolder("Templates sélectionnés", parentFolderId, config);
}

export async function saveCanvaFolderLink(requestId: string, folderData: CanvaFolderData) {
  return updateEventPicTemplateRequestAutomation(requestId, {
    canva_folder_status: "created",
    canva_folder_id: folderData.id,
    canva_folder_url: folderData.url,
    canva_error: undefined
  });
}

export async function prepareCanvaAutomation(request: EventPicTemplateRequest) {
  const folderData = await createEventFolder(request);
  return saveCanvaFolderLink(request.id, folderData);
}

export async function markCanvaAutomationStatus(
  requestId: string,
  automation: Partial<EventPicTemplateRequestAutomation>
) {
  return updateEventPicTemplateRequestAutomation(requestId, automation);
}

export function isCanvaAutomationConfigured() {
  return Boolean(getCanvaConfig());
}
