import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { clsx } from 'clsx';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  className?: string;
  height?: string;
  darkTheme?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  label,
  error,
  className,
  height = '200px',
  darkTheme = false,
}) => {
  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'code-block'],
      ['clean'],
    ],
  };

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'blockquote',
    'list',
    'bullet',
    'link',
    'code-block',
  ];

  const editorId = React.useId();
  const editorClassName = darkTheme ? `rich-text-editor-dark-${editorId}` : `rich-text-editor-light-${editorId}`;
  const editorRef = React.useRef<ReactQuill>(null);
  
  // Garantir que o editor seja focado e tenha cor correta quando montado
  React.useEffect(() => {
    if (editorRef.current) {
      const quill = editorRef.current.getEditor();
      if (quill && quill.root) {
        quill.root.setAttribute('contenteditable', 'true');
        quill.root.style.pointerEvents = 'auto';
        
        // Função para aplicar cor do texto de forma agressiva
        const applyTextColor = () => {
          if (!darkTheme) {
            // Aplicar cor diretamente no elemento raiz
            quill.root.style.setProperty('color', '#111827', 'important');
            
            // Forçar cor em todos os elementos filhos, incluindo texto direto
            const allElements = quill.root.querySelectorAll('*');
            allElements.forEach((el: Element) => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.setProperty('color', '#111827', 'important');
            });
            
            // Também aplicar no próprio texto do root se houver
            if (quill.root.textContent) {
              quill.root.style.setProperty('color', '#111827', 'important');
            }
          }
        };
        
        // Aplicar cor inicialmente
        applyTextColor();
        
        // Usar MutationObserver para detectar mudanças no DOM
        const observer = new MutationObserver(() => {
          applyTextColor();
        });
        
        observer.observe(quill.root, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        
        // Listener para quando o texto muda
        const textChangeHandler = () => {
          // Usar setTimeout para garantir que o DOM foi atualizado
          setTimeout(() => {
            applyTextColor();
          }, 0);
        };
        
        quill.on('text-change', textChangeHandler);
        quill.on('selection-change', textChangeHandler);
        
        // Cleanup
        return () => {
          observer.disconnect();
          quill.off('text-change', textChangeHandler);
          quill.off('selection-change', textChangeHandler);
        };
      }
    }
  }, [darkTheme]);

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label className={clsx('block text-sm font-medium mb-2', darkTheme ? 'text-gray-300' : 'text-gray-700')}>
          {label}
        </label>
      )}
      <div 
        className={clsx(
          'rounded-md quill-wrapper',
          darkTheme ? 'bg-gray-700/50 border border-gray-600' : 'bg-white border border-gray-300',
          error && (darkTheme ? 'border-red-500/50' : 'border-red-300')
        )}
        style={{ 
          position: 'relative',
          ...(!darkTheme && { color: '#111827' })
        }}
      >
        <ReactQuill
          ref={editorRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          style={{ height, marginBottom: '50px' }}
          className={clsx('rounded-md', editorClassName)}
          readOnly={false}
        />
      </div>
      {error && <p className={clsx('mt-2 text-sm', darkTheme ? 'text-red-400' : 'text-red-600')}>{error}</p>}
      
      {/* Customização CSS para o Quill se adaptar melhor ao Tailwind e tema escuro */}
      <style>{`
        .quill-wrapper {
          position: relative;
        }
        .quill-wrapper * {
          pointer-events: auto !important;
        }
        .${editorClassName} {
          position: relative;
        }
        .${editorClassName} .ql-container {
          pointer-events: auto !important;
        }
        .${editorClassName} .ql-editor {
          pointer-events: auto !important;
          cursor: text !important;
        }
        .${editorClassName} .ql-toolbar.ql-snow {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          border-color: ${darkTheme ? '#4B5563' : '#e5e7eb'};
          background: ${darkTheme ? '#374151' : '#ffffff'};
        }
        .${editorClassName} .ql-container.ql-snow {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border-color: ${darkTheme ? '#4B5563' : '#e5e7eb'};
          background: ${darkTheme ? '#1F2937' : '#ffffff'};
        }
        .${editorClassName} .ql-editor {
          min-height: ${height};
          color: ${darkTheme ? '#E5E7EB' : '#111827'} !important;
          background: ${darkTheme ? '#1F2937' : '#ffffff'} !important;
        }
        ${!darkTheme ? `
        .${editorClassName} .ql-editor {
          color: #111827 !important;
        }
        .${editorClassName} .ql-editor * {
          color: #111827 !important;
        }
        .${editorClassName} .ql-editor p,
        .${editorClassName} .ql-editor div,
        .${editorClassName} .ql-editor span,
        .${editorClassName} .ql-editor strong,
        .${editorClassName} .ql-editor em,
        .${editorClassName} .ql-editor u,
        .${editorClassName} .ql-editor li,
        .${editorClassName} .ql-editor h1,
        .${editorClassName} .ql-editor h2,
        .${editorClassName} .ql-editor h3,
        .${editorClassName} .ql-editor h4,
        .${editorClassName} .ql-editor h5,
        .${editorClassName} .ql-editor h6,
        .${editorClassName} .ql-editor blockquote,
        .${editorClassName} .ql-editor code,
        .${editorClassName} .ql-editor pre,
        .${editorClassName} .ql-editor a,
        .${editorClassName} .ql-editor br {
          color: #111827 !important;
        }
        .${editorClassName} .ql-editor::selection {
          background: #BFDBFE !important;
          color: #111827 !important;
        }
        .${editorClassName} .ql-editor::-moz-selection {
          background: #BFDBFE !important;
          color: #111827 !important;
        }
        ` : `
        .${editorClassName} .ql-editor p,
        .${editorClassName} .ql-editor div,
        .${editorClassName} .ql-editor span,
        .${editorClassName} .ql-editor strong,
        .${editorClassName} .ql-editor em,
        .${editorClassName} .ql-editor u,
        .${editorClassName} .ql-editor li,
        .${editorClassName} .ql-editor h1,
        .${editorClassName} .ql-editor h2,
        .${editorClassName} .ql-editor h3,
        .${editorClassName} .ql-editor h4,
        .${editorClassName} .ql-editor h5,
        .${editorClassName} .ql-editor h6,
        .${editorClassName} .ql-editor blockquote,
        .${editorClassName} .ql-editor code,
        .${editorClassName} .ql-editor pre,
        .${editorClassName} .ql-editor a {
          color: #E5E7EB !important;
        }
        `}
        .${editorClassName} .ql-editor.ql-blank::before {
          color: ${darkTheme ? '#9CA3AF' : '#6B7280'} !important;
        }
        .${editorClassName} .ql-stroke {
          stroke: ${darkTheme ? '#9CA3AF' : '#374151'};
        }
        .${editorClassName} .ql-fill {
          fill: ${darkTheme ? '#9CA3AF' : '#374151'};
        }
        .${editorClassName} .ql-picker-label {
          color: ${darkTheme ? '#E5E7EB' : '#111827'};
        }
        .${editorClassName} .ql-picker-options {
          background: ${darkTheme ? '#374151' : '#ffffff'};
          border-color: ${darkTheme ? '#4B5563' : '#e5e7eb'};
          z-index: 1000 !important;
        }
        .${editorClassName} .ql-picker-item {
          color: ${darkTheme ? '#E5E7EB' : '#111827'};
        }
        .${editorClassName} .ql-picker-item:hover {
          background: ${darkTheme ? '#4B5563' : '#f3f4f6'};
        }
        .${editorClassName} button:hover .ql-stroke,
        .${editorClassName} button.ql-active .ql-stroke {
          stroke: ${darkTheme ? '#8DF768' : '#059669'};
        }
        .${editorClassName} button:hover .ql-fill,
        .${editorClassName} button.ql-active .ql-fill {
          fill: ${darkTheme ? '#8DF768' : '#059669'};
        }
      `}</style>
    </div>
  );
};

