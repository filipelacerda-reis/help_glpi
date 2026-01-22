import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { clsx } from 'clsx';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // em bytes
  accept?: Record<string, string[]>;
  className?: string;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB padrão
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  },
  className,
  disabled = false,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setError(null);

      if (fileRejections.length > 0) {
        const firstError = fileRejections[0].errors[0];
        if (firstError.code === 'file-too-large') {
          setError(`Arquivo muito grande. Máximo de ${maxSize / 1024 / 1024}MB.`);
        } else if (firstError.code === 'file-invalid-type') {
          setError('Tipo de arquivo inválido.');
        } else if (firstError.code === 'too-many-files') {
          setError(`Muitos arquivos. Máximo de ${maxFiles}.`);
        } else {
          setError(firstError.message);
        }
        return;
      }

      // Verificar limite total de arquivos se já houver arquivos selecionados (opcional, aqui estamos substituindo ou adicionando)
      // Aqui vamos apenas repassar os arquivos aceitos para o pai
      setFiles(acceptedFiles);
      onFilesSelected(acceptedFiles);
    },
    [maxFiles, maxSize, onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles,
    maxSize,
    accept,
    disabled,
  });

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-etus-green',
          isDragActive
            ? 'border-etus-green bg-etus-green/5'
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
          error && 'border-red-300 bg-red-50'
        )}
      >
        <input {...getInputProps()} />
        <div className="space-y-1">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-etus-green hover:text-etus-green-dark">
              Clique para enviar
            </span>{' '}
            ou arraste e solte
          </div>
          <p className="text-xs text-gray-500">
            Imagens, PDF, DOCX, XLSX até {maxSize / 1024 / 1024}MB
          </p>
        </div>
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      {/* Preview simples dos arquivos selecionados (opcional, pois o pai pode querer controlar isso) */}
      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file, index) => (
            <li key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md text-sm">
              <span className="truncate max-w-xs text-gray-700">{file.name}</span>
              <span className="text-gray-500 text-xs">{(file.size / 1024).toFixed(0)}kb</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

