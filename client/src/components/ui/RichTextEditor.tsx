import { useEffect, useCallback } from 'react';
import { usePrompt } from '@/components/ui/ConfirmModal';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Redo, Undo, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Code, Code2, Link as LinkIcon, Unlink, Highlighter,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  RemoveFormatting, Baseline, Pilcrow,
  Heading1, Heading2, Heading3, Heading4,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  error?: boolean;
}

/** Heading levels offered as their own buttons, alongside the plain paragraph. */
const HEADING_LEVELS = [
  { level: 1, icon: Heading1 },
  { level: 2, icon: Heading2 },
  { level: 3, icon: Heading3 },
  { level: 4, icon: Heading4 },
] as const;

type Tool =
  | { type: 'divider' }
  | { icon: typeof Bold; action: () => void; active: boolean; label: string; disabled?: boolean };

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something...',
  minHeight = '120px',
  error,
}: RichTextEditorProps) {
  const prompt = usePrompt();
  const editor = useEditor({
    extensions: [
      // StarterKit (v3) already bundles Underline, Link and the code marks, so those
      // are never registered separately or Tiptap warns about duplicate extensions.
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        heading: { levels: [1, 2, 3, 4] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Subscript,
      Superscript,
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

  const setLink = useCallback(async (ed: Editor) => {
    const previous = ed.getAttributes('link').href || '';
    const url = await prompt({
      title: previous ? 'Edit link' : 'Insert link',
      message: 'Paste the address this text should point to.',
      label: 'Link URL',
      placeholder: 'https://example.com',
      defaultValue: previous,
      confirmLabel: previous ? 'Update link' : 'Insert link',
      variant: 'info',
    });
    // Cancelling leaves the text alone, while clearing the field removes the link.
    if (url === null) return;
    if (url === '') {
      ed.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    ed.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank', rel: 'noopener noreferrer' }).run();
  }, [prompt]);

  if (!editor) return null;

  const currentColor = editor.getAttributes('textStyle').color || '#000000';

  const groups: Tool[][] = [
    [
      { icon: Pilcrow, action: () => editor.chain().focus().setParagraph().run(), active: editor.isActive('paragraph'), label: 'Paragraph' },
      ...HEADING_LEVELS.map(({ level, icon }) => ({
        icon,
        action: () => editor.chain().focus().toggleHeading({ level }).run(),
        active: editor.isActive('heading', { level }),
        label: `Heading ${level}`,
      })),
    ],
    [
      { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), label: 'Bold' },
      { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), label: 'Italic' },
      { icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), label: 'Underline' },
      { icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), label: 'Strikethrough' },
    ],
    [
      { icon: Highlighter, action: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive('highlight'), label: 'Highlight' },
      { icon: SubscriptIcon, action: () => editor.chain().focus().toggleSubscript().run(), active: editor.isActive('subscript'), label: 'Subscript' },
      { icon: SuperscriptIcon, action: () => editor.chain().focus().toggleSuperscript().run(), active: editor.isActive('superscript'), label: 'Superscript' },
    ],
    [
      { icon: AlignLeft, action: () => editor.chain().focus().setTextAlign('left').run(), active: editor.isActive({ textAlign: 'left' }), label: 'Align left' },
      { icon: AlignCenter, action: () => editor.chain().focus().setTextAlign('center').run(), active: editor.isActive({ textAlign: 'center' }), label: 'Align center' },
      { icon: AlignRight, action: () => editor.chain().focus().setTextAlign('right').run(), active: editor.isActive({ textAlign: 'right' }), label: 'Align right' },
      { icon: AlignJustify, action: () => editor.chain().focus().setTextAlign('justify').run(), active: editor.isActive({ textAlign: 'justify' }), label: 'Justify' },
    ],
    [
      { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), label: 'Bullet list' },
      { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), label: 'Numbered list' },
      { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Quote' },
      { icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run(), active: false, label: 'Horizontal rule' },
    ],
    [
      { icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), label: 'Inline code' },
      { icon: Code2, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), label: 'Code block' },
      { icon: LinkIcon, action: () => { void setLink(editor); }, active: editor.isActive('link'), label: 'Add link' },
      { icon: Unlink, action: () => editor.chain().focus().unsetLink().run(), active: false, label: 'Remove link', disabled: !editor.isActive('link') },
    ],
    [
      { icon: RemoveFormatting, action: () => editor.chain().focus().unsetAllMarks().clearNodes().run(), active: false, label: 'Clear formatting' },
      { icon: Undo, action: () => editor.chain().focus().undo().run(), active: false, label: 'Undo', disabled: !editor.can().undo() },
      { icon: Redo, action: () => editor.chain().focus().redo().run(), active: false, label: 'Redo', disabled: !editor.can().redo() },
    ],
  ];

  const controlClass = 'h-9 sm:h-8 min-w-[36px] sm:min-w-[32px] flex items-center justify-center rounded transition-colors shrink-0';

  return (
    // No `overflow-hidden` here: it would make this box the toolbar's scroll container and the sticky toolbar would never stick.
    <div className={`border rounded-md bg-background ${error ? 'border-red-500' : 'focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary'}`}>
      {/* Sticky under the 4rem app header, so the controls stay reachable while writing a long entry. */}
      {/* One scrolling row on a phone, where wrapping every option would eat most of the screen, and a wrapped block from `sm` up. */}
      <div className="sticky top-16 z-20 flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap sm:overflow-visible items-center gap-x-0.5 gap-y-1 px-2 py-1.5 border-b bg-muted rounded-t-md">
        <label
          title="Text colour"
          className={`${controlClass} cursor-pointer text-muted-foreground hover:bg-accent hover:text-foreground relative`}
        >
          <Baseline className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          <span
            className="absolute bottom-1 h-1 w-4 rounded-sm border border-border"
            style={{ backgroundColor: currentColor }}
          />
          <input
            type="color"
            value={currentColor}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="sr-only"
            aria-label="Text colour"
          />
        </label>

        {groups.map((group, gi) => (
          <div key={gi} className="flex items-center gap-x-0.5 shrink-0">
            <span className="w-px h-5 bg-border mx-1 hidden sm:block" aria-hidden />
            {group.map((tool, i) => {
              if ('type' in tool) return null;
              const Icon = tool.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={tool.action}
                  disabled={tool.disabled}
                  title={tool.label}
                  aria-label={tool.label}
                  aria-pressed={tool.active}
                  className={`${controlClass} disabled:opacity-40 disabled:cursor-not-allowed ${
                    tool.active
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>
              );
            })}
          </div>
        ))}
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
