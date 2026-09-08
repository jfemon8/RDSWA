import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import RichTextEditor from '@/components/ui/RichTextEditor';

/** Inline form for starting a custom chat group, shown to Moderator+ from the chat hub. */
export default function CreateGroupForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  const createMutation = useMutation({
    mutationFn: () => api.post('/communication/groups', { name, description, type: 'custom' }),
    onSuccess: () => {
      toast.success('Group created!');
      onCreated();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create group');
    },
  });

  const handleSubmit = () => {
    setErrors({});
    if (!name.trim()) {
      setErrors({ name: 'Group name is required' });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="bg-card border rounded-lg p-5 mb-4">
      <h3 className="font-semibold mb-3">Create New Group</h3>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} noValidate className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="Group name"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors({}); }}
            className={`w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? 'border-red-500' : ''}`}
          />
          <FieldError message={errors.name} />
        </div>
        <RichTextEditor
          value={description}
          onChange={setDescription}
          placeholder="Description..."
          minHeight="80px"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
