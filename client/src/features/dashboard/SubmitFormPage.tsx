import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Loader2, Send } from 'lucide-react';

export default function SubmitFormPage() {
  const navigate = useNavigate();
  const [type, setType] = useState('membership');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/forms', {
        type,
        data: { reason },
      });
      return data;
    },
    onSuccess: () => navigate('/dashboard/forms'),
    onError: (err: any) => setError(err.response?.data?.message || 'Submission failed'),
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Submit Form</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">{error}</div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Form Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="membership">Membership Application</option>
            <option value="construction_fund">Construction Fund</option>
            <option value="alumni">Alumni Registration</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Details / Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={5}
            className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Provide details about your application..." required />
        </div>

        <button type="submit" disabled={mutation.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit
        </button>
      </form>
    </div>
  );
}
