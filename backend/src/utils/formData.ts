import { Request } from 'express';

/**
 * Processa dados de FormData que podem vir em diferentes formatos
 * e normaliza para o formato esperado pelos schemas Zod
 */
export function processFormData<T extends Record<string, any>>(req: Request): T {
  const bodyData = { ...req.body } as any;

  // Processar tagIds que pode vir como string JSON, array de strings, ou tagIds[]
  if (bodyData.tagIds !== undefined) {
    if (typeof bodyData.tagIds === 'string') {
      try {
        bodyData.tagIds = JSON.parse(bodyData.tagIds);
      } catch {
        // Se não for JSON válido, tratar como array vazio
        bodyData.tagIds = [];
      }
    }
  }

  // Se tagIds vier como array de strings do FormData (tagIds[])
  if (Array.isArray(bodyData['tagIds[]'])) {
    bodyData.tagIds = bodyData['tagIds[]'];
    delete bodyData['tagIds[]'];
  }

  return bodyData as T;
}

/**
 * Processa arquivos do multer e retorna formato padronizado
 */
export function processAttachments(req: Request): Array<{
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}> {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    return [];
  }

  return req.files.map((file: Express.Multer.File) => ({
    fileName: file.originalname,
    filePath: file.filename,
    fileSize: file.size,
    mimeType: file.mimetype,
  }));
}

