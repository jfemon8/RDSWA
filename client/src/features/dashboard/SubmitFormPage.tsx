import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Send, UserPlus, Info, Upload, X, FileText, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { useToast } from '@/components/ui/Toast';
import RichTextEditor from '@/components/ui/RichTextEditor';
import {
  ACADEMIC_DOC_TYPES,
  IDENTITY_DOC_TYPES,
  DEFAULT_MEMBERSHIP_CRITERIA,
  type MembershipCriteria,
} from '@/lib/membershipDocs';

interface UploadedFile {
  /** Doc-type key (e.g. 'nid', 'student_id') for membership/alumni group uploads,
   *  or a free-form label for legacy alumni uploads. Persisted on the Form. */
  name: string;
  url: string;
  uploading?: boolean;
}

export default function SubmitFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const toast = useToast();
  const [type, setType] = useState('membership');
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isMembershipForm = type === 'membership';
  const isAlumniForm = type === 'alumni';
  const alreadyMember = user?.membershipStatus === 'approved';
  const alreadyPending = user?.membershipStatus === 'pending';
  const canApplyAlumni = user?.membershipStatus === 'approved';

  // Pull live criteria so the form mirrors whatever an admin has configured.
  const { data: criteriaData } = useQuery<MembershipCriteria>({
    queryKey: ['settings', 'membership-criteria'],
    queryFn: async () => {
      const { data } = await api.get('/settings/membership-criteria');
      return { ...DEFAULT_MEMBERSHIP_CRITERIA, ...(data.data || {}) };
    },
    enabled: isMembershipForm,
  });
  const criteria: MembershipCriteria = criteriaData ?? DEFAULT_MEMBERSHIP_CRITERIA;

  // Per-group selected doc type (only meaningful while picking a file).
  const [academicDocType, setAcademicDocType] = useState<string>('');
  const [identityDocType, setIdentityDocType] = useState<string>('');

  const academicAccepted = ACADEMIC_DOC_TYPES.filter((d) =>
    criteria.academicDocs.accepted.includes(d.key),
  );
  const identityAccepted = IDENTITY_DOC_TYPES.filter((d) =>
    criteria.identityDocs.accepted.includes(d.key),
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, attachmentName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP, or PDF files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    setUploading(true);
    setErrors((prev) => { const { attachments, ...rest } = prev; return rest; });

    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Replace any previous attachment with the same name (e.g. switching
      // from passport to NID within the identity group).
      setAttachments((prev) => [
        ...prev.filter((a) => a.name !== attachmentName),
        { name: attachmentName, url: data.data.url },
      ]);
    } catch {
      toast.error('File upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Whether each group is currently satisfied by an uploaded file.
  const academicUpload = attachments.find((a) =>
    academicAccepted.some((d) => d.key === a.name),
  );
  const identityUpload = attachments.find((a) =>
    identityAccepted.some((d) => d.key === a.name),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/forms', {
        type,
        data: { reason },
        attachments: attachments.map(({ name, url }) => ({ name, url })),
      });
      return data;
    },
    onSuccess: async () => {
      if (isMembershipForm) {
        try {
          const { data } = await api.get('/users/me');
          setUser(data.data);
        } catch {}
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      toast.success('Form submitted successfully!');
      navigate('/dashboard/forms');
    },
    onError: (err: any) => {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
      } else {
        toast.error(err.response?.data?.message || 'Submission failed');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!reason.trim()) {
      setErrors({ reason: isMembershipForm ? 'Please explain why you want to join' : 'Please provide details' });
      return;
    }

    // Validate required attachments
    if (isMembershipForm) {
      const missing: string[] = [];
      if (criteria.academicDocs.enabled && !academicUpload) missing.push('an academic document');
      if (criteria.identityDocs.enabled && !identityUpload) missing.push('an identity document');
      if (missing.length > 0) {
        setErrors({ attachments: `Please upload ${missing.join(' and ')}.` });
        return;
      }
    }
    if (isAlumniForm && attachments.length < 1) {
      setErrors({ attachments: 'Please upload your Business ID Card/Trade Licence/Employee ID Card' });
      return;
    }

    mutation.mutate();
  };

  // Alumni upload fields (legacy single-file flow — unchanged)
  const alumniUploads = [
    { label: 'Business ID Card / Trade Licence / Employee ID Card', key: 'work_id' },
  ];

  const currentUploads = isAlumniForm ? alumniUploads : [];

  return (
    <FadeIn direction="up" blur duration={0.5}>
      <div className="container mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">
          {isMembershipForm ? 'Membership Application' : isAlumniForm ? 'Alumni Application' : 'Submit Form'}
        </h1>

        {/* Membership info banner */}
        <AnimatePresence>
          {isMembershipForm && !alreadyMember && !alreadyPending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 rounded-xl border bg-primary/5 border-primary/20"
            >
              <div className="flex items-start gap-3">
                <UserPlus className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Join RDSWA</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submit your membership application with required documents below.
                    {criteria.academicDocs.enabled && (
                      <> You must upload one academic document ({academicAccepted.map((d) => d.label).join(' / ')}).</>
                    )}
                    {criteria.identityDocs.enabled && (
                      <> You must also upload one identity document ({identityAccepted.map((d) => d.label).join(' / ')}).</>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alumni info banner */}
        <AnimatePresence>
          {isAlumniForm && canApplyAlumni && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 rounded-xl border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
            >
              <div className="flex items-start gap-3">
                <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-amber-800 dark:text-amber-300">Apply for Alumni Status</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">
                    Upload your Business ID Card, Trade Licence, or Employee ID Card to verify your professional status.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <label className="block text-sm font-medium mb-1">Form Type</label>
            <select value={type} onChange={(e) => { setType(e.target.value); setAttachments([]); setErrors({}); }}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="membership">Membership Application</option>
              <option value="construction_fund">Construction Fund</option>
              {canApplyAlumni && <option value="alumni">Alumni Registration</option>}
            </select>
          </motion.div>

          {/* Alumni restriction message */}
          {isAlumniForm && !canApplyAlumni && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="p-4 rounded-md border bg-muted"
            >
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Only approved members can apply for alumni status.</span>
              </div>
            </motion.div>
          )}

          {isMembershipForm && (alreadyMember || alreadyPending) ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="p-4 rounded-md border bg-muted"
            >
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {alreadyMember
                    ? 'You are already an approved member.'
                    : 'You already have a pending membership application. Please wait for admin review.'}
                </span>
              </div>
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <label className="block text-sm font-medium mb-1">
                  {isMembershipForm ? 'Why do you want to join RDSWA?' : isAlumniForm ? 'Tell us about your professional status' : 'Details / Reason'}
                </label>
                <RichTextEditor
                  value={reason}
                  onChange={(v) => { setReason(v); setErrors((prev) => { const { reason, ...rest } = prev; return rest; }); }}
                  placeholder={isMembershipForm ? 'Tell us about yourself — your district, department, why you want to join...' : isAlumniForm ? 'Describe your current profession, company/business...' : 'Provide details about your application...'}
                  minHeight="120px"
                  error={!!errors.reason}
                />
                <FieldError message={errors.reason} />
              </motion.div>

              {/* Grouped uploads for membership — one of each accepted type */}
              {isMembershipForm && (criteria.academicDocs.enabled || criteria.identityDocs.enabled) && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="space-y-3"
                >
                  <label className="block text-sm font-medium">Required Documents</label>

                  {criteria.academicDocs.enabled && academicAccepted.length > 0 && (
                    <DocGroupUpload
                      title="Academic Document"
                      hint="Upload one of the following:"
                      acceptedDocs={academicAccepted}
                      selectedDocType={academicDocType}
                      setSelectedDocType={setAcademicDocType}
                      uploaded={academicUpload}
                      uploading={uploading}
                      onUpload={handleFileUpload}
                      onRemove={() => academicUpload && removeAttachment(attachments.indexOf(academicUpload))}
                    />
                  )}

                  {criteria.identityDocs.enabled && identityAccepted.length > 0 && (
                    <DocGroupUpload
                      title="Identity Document"
                      hint="Upload one of the following:"
                      acceptedDocs={identityAccepted}
                      selectedDocType={identityDocType}
                      setSelectedDocType={setIdentityDocType}
                      uploaded={identityUpload}
                      uploading={uploading}
                      onUpload={handleFileUpload}
                      onRemove={() => identityUpload && removeAttachment(attachments.indexOf(identityUpload))}
                    />
                  )}

                  <FieldError message={errors.attachments} />
                </motion.div>
              )}

              {/* Legacy single-file uploads (alumni form) */}
              {currentUploads.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="space-y-3"
                >
                  <label className="block text-sm font-medium">Required Documents</label>
                  {currentUploads.map((upload, i) => {
                    const existing = attachments.find((a) => a.name === upload.label);
                    return (
                      <motion.div
                        key={upload.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.05 }}
                        className="border rounded-lg p-3 bg-background"
                      >
                        <p className="text-sm font-medium mb-2">{upload.label}</p>
                        {existing ? (
                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <FileText className="h-4 w-4" />
                            <span className="truncate flex-1">Uploaded</span>
                            <motion.button
                              type="button"
                              onClick={() => removeAttachment(attachments.indexOf(existing))}
                              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <X className="h-4 w-4" />
                            </motion.button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-md cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors text-sm text-muted-foreground">
                            <Upload className="h-4 w-4" />
                            <span>{uploading ? 'Uploading...' : 'Choose file (JPEG, PNG, PDF — max 5MB)'}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, upload.label)}
                              disabled={uploading}
                            />
                          </label>
                        )}
                      </motion.div>
                    );
                  })}
                  <FieldError message={errors.attachments} />
                </motion.div>
              )}

              <motion.button
                type="submit"
                disabled={mutation.isPending || uploading}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isMembershipForm ? 'Submit Application' : isAlumniForm ? 'Submit Alumni Application' : 'Submit'}
              </motion.button>
            </>
          )}
        </form>
      </div>
    </FadeIn>
  );
}

/**
 * Doc-group upload UI: pick a doc type from the accepted list, then upload.
 * The selected doc-type key is what gets stored as `attachment.name`.
 */
function DocGroupUpload({
  title,
  hint,
  acceptedDocs,
  selectedDocType,
  setSelectedDocType,
  uploaded,
  uploading,
  onUpload,
  onRemove,
}: {
  title: string;
  hint: string;
  acceptedDocs: ReadonlyArray<{ key: string; label: string }>;
  selectedDocType: string;
  setSelectedDocType: (k: string) => void;
  uploaded: UploadedFile | undefined;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, attachmentName: string) => void;
  onRemove: () => void;
}) {
  const uploadedLabel = acceptedDocs.find((d) => d.key === uploaded?.name)?.label ?? '';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="border rounded-lg p-3 bg-background space-y-2"
    >
      <p className="text-sm font-medium">{title}</p>

      {uploaded ? (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <FileText className="h-4 w-4" />
          <span className="truncate flex-1">{uploadedLabel} uploaded</span>
          <motion.button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Remove uploaded document"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{hint}</p>
          <div className="flex flex-wrap gap-2">
            {acceptedDocs.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDocType(d.key)}
                className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                  selectedDocType === d.key
                    ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                    : 'hover:bg-accent'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <label
            className={`flex items-center gap-2 px-3 py-2 border border-dashed rounded-md text-sm transition-colors ${
              selectedDocType
                ? 'cursor-pointer hover:border-primary hover:bg-primary/5 text-muted-foreground'
                : 'opacity-50 cursor-not-allowed text-muted-foreground'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>
              {uploading
                ? 'Uploading...'
                : selectedDocType
                  ? 'Choose file (JPEG, PNG, PDF — max 5MB)'
                  : 'Select a document type first'}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => selectedDocType && onUpload(e, selectedDocType)}
              disabled={uploading || !selectedDocType}
            />
          </label>
        </>
      )}
    </motion.div>
  );
}
