
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Save, Loader2, BookOpen, 
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Type, Minus, Eraser
} from 'lucide-react';

interface NotebookEditorModalProps {
  initialData?: string;
  title: string;
  onSave: (data: string) => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
}

const NotebookEditorModal: React.FC<NotebookEditorModalProps> = ({ initialData, title, onSave, onClose, readOnly }) => {
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Color States for Pickers
  const [foreColor, setForeColor] = useState('#ffffff');
  const [hiliteColor, setHiliteColor] = useState('#eab308'); // Yellow-500 default

  useEffect(() => {
    if (editorRef.current) {
        // Set initial HTML. Handles plain text or HTML gracefully.
        editorRef.current.innerHTML = initialData || '';
    }
  }, [initialData]);

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
        const htmlContent = editorRef.current.innerHTML;
        await onSave(htmlContent);
    } catch (error) {
        console.error("Save failed", error);
    } finally {
        setSaving(false);
    }
  };

  const execCmd = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  // Helper for Toolbar Buttons
  const ToolbarBtn = ({ icon: Icon, cmd, val, title, activeClass = "" }: any) => (
    <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); execCmd(cmd, val); }}
        className={`p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors ${activeClass}`}
        title={title}
    >
        <Icon size={16} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] w-screen h-screen bg-zinc-950 flex flex-col animate-in fade-in duration-300">
      
        {/* Header */}
        <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-950 shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 border border-yellow-500/20">
                <BookOpen size={20} />
             </div>
             <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tighter leading-none">{title}</h2>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Caderno de Anotações</span>
             </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Toolbar (Only if not ReadOnly) */}
        {!readOnly && (
            <div className="px-4 py-2 border-b border-zinc-900 bg-zinc-900/50 flex flex-wrap items-center gap-1 shrink-0 overflow-x-auto">
                {/* Text Style */}
                <div className="flex items-center gap-0.5 border-r border-zinc-800 pr-2 mr-2">
                    <ToolbarBtn icon={Bold} cmd="bold" title="Negrito" />
                    <ToolbarBtn icon={Italic} cmd="italic" title="Itálico" />
                    <ToolbarBtn icon={Underline} cmd="underline" title="Sublinhado" />
                    <ToolbarBtn icon={Strikethrough} cmd="strikeThrough" title="Taxado" />
                </div>

                {/* Alignment */}
                <div className="flex items-center gap-0.5 border-r border-zinc-800 pr-2 mr-2">
                    <ToolbarBtn icon={AlignLeft} cmd="justifyLeft" title="Alinhar Esquerda" />
                    <ToolbarBtn icon={AlignCenter} cmd="justifyCenter" title="Centralizar" />
                    <ToolbarBtn icon={AlignRight} cmd="justifyRight" title="Alinhar Direita" />
                    <ToolbarBtn icon={AlignJustify} cmd="justifyFull" title="Justificar" />
                </div>

                {/* Font Size (Simplified) */}
                <div className="flex items-center gap-2 border-r border-zinc-800 pr-2 mr-2">
                    <select 
                        onChange={(e) => execCmd('fontSize', e.target.value)}
                        className="bg-zinc-900 text-xs text-white border border-zinc-800 rounded p-1.5 focus:outline-none focus:border-yellow-500"
                    >
                        <option value="3">Normal</option>
                        <option value="1">Pequeno</option>
                        <option value="5">Grande</option>
                        <option value="7">Enorme</option>
                    </select>
                </div>

                {/* Colors */}
                <div className="flex items-center gap-2 border-r border-zinc-800 pr-2 mr-2">
                    {/* Font Color */}
                    <div className="relative group w-8 h-8 flex items-center justify-center">
                        <ToolbarBtn icon={Type} cmd="foreColor" val={foreColor} title="Cor da Fonte" activeClass="text-white" />
                        <input 
                            type="color" 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            value={foreColor}
                            onChange={(e) => {
                                setForeColor(e.target.value);
                                execCmd('foreColor', e.target.value);
                            }}
                        />
                        <div className="h-1 w-6 absolute bottom-1 left-1 rounded-full" style={{ backgroundColor: foreColor }}></div>
                    </div>

                    {/* Highlight */}
                    <div className="relative group w-8 h-8 flex items-center justify-center">
                        <ToolbarBtn icon={Highlighter} cmd="hiliteColor" val={hiliteColor} title="Marca Texto" activeClass="text-white" />
                        <input 
                            type="color" 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            value={hiliteColor}
                            onChange={(e) => {
                                setHiliteColor(e.target.value);
                                execCmd('hiliteColor', e.target.value);
                            }}
                        />
                        <div className="h-1 w-6 absolute bottom-1 left-1 rounded-full" style={{ backgroundColor: hiliteColor }}></div>
                    </div>
                    
                    <ToolbarBtn icon={Eraser} cmd="removeFormat" title="Limpar Formatação" />
                </div>

                {/* Divider */}
                <ToolbarBtn icon={Minus} cmd="insertHorizontalRule" title="Linha Divisória" />

            </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 bg-zinc-950 relative overflow-hidden flex flex-col">
          <div 
            ref={editorRef}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className={`
                w-full h-full p-8 text-zinc-300 focus:outline-none overflow-y-auto custom-scrollbar
                prose prose-invert prose-sm max-w-none
                ${readOnly ? '' : 'cursor-text'}
            `}
            style={{ 
                fontFamily: 'Inter, sans-serif',
                lineHeight: '1.6',
                minHeight: '100%'
            }}
            spellCheck={false}
          />
        </div>

        {/* Footer */}
        {!readOnly && (
          <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex justify-end shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase text-xs tracking-widest rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-yellow-900/20"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar Caderno'}
            </button>
          </div>
        )}
        
        {/* Style Injection for Editor Content */}
        <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 8px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
            
            /* Basic resets for contentEditable */
            [contenteditable]:empty:before {
                content: 'Digite suas anotações aqui...';
                color: #52525b;
                font-style: italic;
            }
            
            b, strong { font-weight: 900; color: white; }
            i, em { font-style: italic; }
            u { text-decoration: underline; }
            strike { text-decoration: line-through; opacity: 0.7; }
            
            hr { border: 0; border-top: 1px solid #3f3f46; margin: 20px 0; }
            
            /* Font Sizes mapping */
            font[size="1"] { font-size: 0.75rem; }
            font[size="2"] { font-size: 0.875rem; }
            font[size="3"] { font-size: 1rem; }
            font[size="4"] { font-size: 1.125rem; }
            font[size="5"] { font-size: 1.5rem; font-weight: bold; }
            font[size="6"] { font-size: 2rem; font-weight: 900; }
            font[size="7"] { font-size: 3rem; font-weight: 900; }
        `}</style>
    </div>
  );
};

export default NotebookEditorModal;
