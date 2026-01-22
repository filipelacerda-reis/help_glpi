import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

// Criar diretório de uploads se não existir
const uploadsDir = path.join(process.cwd(), 'uploads', 'tickets');
const journalUploadsDir = path.join(process.cwd(), 'uploads', 'journal');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('Diretório de uploads criado', { path: uploadsDir });
}
if (!fs.existsSync(journalUploadsDir)) {
  fs.mkdirSync(journalUploadsDir, { recursive: true });
  logger.info('Diretório de uploads do journal criado', { path: journalUploadsDir });
}

// Configuração de armazenamento para tickets
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Verificar se é rota de journal
    const isJournalRoute = req.path?.includes('/journal');
    cb(null, isJournalRoute ? journalUploadsDir : uploadsDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const isJournalRoute = req.path?.includes('/journal');
    const prefix = isJournalRoute ? 'journal' : 'ticket';
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  },
});

// Filtro para aceitar apenas imagens
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas (JPEG, PNG, GIF, WEBP)'));
  }
};

// Configuração do multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
});

// Middleware para múltiplos arquivos
export const uploadMultiple = upload.array('images', 10); // Máximo 10 imagens

// Função para obter URL do arquivo
export const getFileUrl = (filename: string, isJournal: boolean = false): string => {
  const subdir = isJournal ? 'journal' : 'tickets';
  return `/uploads/${subdir}/${filename}`;
};

// Função para deletar arquivo
export const deleteFile = (filePath: string): void => {
  const fullPath = path.join(uploadsDir, path.basename(filePath));
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    logger.debug('Arquivo deletado', { path: fullPath });
  }
};

