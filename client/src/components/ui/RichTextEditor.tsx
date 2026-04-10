import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Redo, Undo, Minus,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  error?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something...',
  minHeight = '120px',
  error,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes into editor (e.g. after API data loads)
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.getHTML();
    if (value !== current && !(value === '' && current === '<p></p>')) {
      editor.commands.setContent(value || '');
    }
  }, [editor, value]);

  if (!editor) return null;

  const tools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), label: 'Bold' },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), label: 'Italic' },
    { icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), label: 'Underline' },
    { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), label: 'Strikethrough' },
    { type: 'divider' as const },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), label: 'Bullet List' },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), label: 'Ordered List' },
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Quote' },
    { icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), active: false, label: 'Horizontal Rule' },
    { type: 'divider' as const },
    { icon: Undo, action: () => editor.chain().focus().undo().run(), active: false, label: 'Undo' },
    { icon: Redo, action: () => editor.chain().focus().redo().run(), active: false, label: 'Redo' },
  ];

  return (
    <div className={`border rounded-md overflow-hidden bg-background ${error ? 'border-red-500' : 'focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary'}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        {tools.map((tool, i) => {
          if ('type' in tool && tool.type === 'divider') {
            return <div key={i} className="w-px h-5 bg-border mx-1 hidden sm:block" />;
          }
          const Icon = (tool as any).icon;
          return (
            <button
              key={i}
              type="button"
              onClick={(tool as any).action}
              title={(tool as any).label}
              aria-label={(tool as any).label}
              className={`p-2 sm:p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded transition-colors ${
                (tool as any).active
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="rich-editor"
        style={{ minHeight }}
      />
    </div>
  );
}
