import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { divisions, districts, upazilas, type Division } from '@/data/bdGeo';
import { useToast } from '@/components/ui/Toast';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'personal' | 'academic' | 'professional' | 'social'>('personal');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: user?.name || '',
    namebn: user?.namebn || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
    gender: user?.gender || '',
    bloodGroup: user?.bloodGroup || '',
    isBloodDonor: user?.isBloodDonor || false,
    presentAddress: (user as any)?.presentAddress || { division: '', district: '', upazila: '', details: '' },
    permanentAddress: (user as any)?.permanentAddress || { division: '', district: '', upazila: '', details: '' },
    studentId: user?.studentId || '',
    batch: user?.batch || '',
    session: user?.session || '',
    department: user?.department || '',
    faculty: user?.faculty || '',
    facebook: user?.facebook || '',
    linkedin: user?.linkedin || '',
    website: user?.website || '',
    skills: user?.skills?.join(', ') || '',
    profession: (user as any)?.profession || '',
    earningSource: (user as any)?.earningSource || '',
    jobHistory: (user as any)?.jobHistory || [],
    businessInfo: (user as any)?.businessInfo || [],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { data: res } = await api.patch('/users/me', data);
      return res;
    },
    onSuccess: (res) => {
      setUser(res.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      toast.success('Profile updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!form.name.trim()) {
      setErrors({ name: 'Name is required' });
      return;
    }
    const payload: Record<string, any> = { ...form };
    if (payload.skills) {
      payload.skills = payload.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
    } else {
      payload.skills = [];
    }
    if (payload.batch) payload.batch = Number(payload.batch);
    updateMutation.mutate(payload);
  };

  const set = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));
  const setNested = (parent: string, field: string, value: string) =>
    setForm((prev) => ({ ...prev, [parent]: { ...(prev as any)[parent], [field]: value } }));

  const tabs = [
    { key: 'personal', label: 'Personal' },
    { key: 'academic', label: 'Academic' },
    { key: 'professional', label: 'Professional' },
    { key: 'social', label: 'Social' },
  ] as const;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Edit Profile</h1>

      <div className="flex gap-2 mb-6 border-b relative">
        {tabs.map((tab) => (
          <motion.button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="profile-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {activeTab === 'personal' && (
          <FadeIn direction="up" duration={0.4}>
            <div className="space-y-4">
              <InputField label="Full Name" value={form.name} onChange={(v) => { set('name', v); setErrors((prev) => { const { name, ...rest } = prev; return rest; }); }} required error={errors.name} />
              <InputField label="Name (Bangla)" value={form.namebn} onChange={(v) => set('namebn', v)} />
              <InputField label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
              <InputField label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} />
              <SelectField label="Gender" value={form.gender} onChange={(v) => set('gender', v)} options={[{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }]} />
              <SelectField label="Blood Group" value={form.bloodGroup} onChange={(v) => set('bloodGroup', v)} options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => ({ label: v, value: v }))} />
              <CheckboxField label="Available as Blood Donor" checked={form.isBloodDonor} onChange={(v) => set('isBloodDonor', v)} />
              <AddressFieldset
                legend="Present Address"
                address={form.presentAddress}
                onChange={(field, value) => {
                  if (field === 'division') {
                    setForm(prev => ({ ...prev, presentAddress: { ...prev.presentAddress, division: value, district: '', upazila: '' } }));
                  } else if (field === 'district') {
                    setForm(prev => ({ ...prev, presentAddress: { ...prev.presentAddress, district: value, upazila: '' } }));
                  } else {
                    setNested('presentAddress', field, value);
                  }
                }}
              />
              <AddressFieldset
                legend="Permanent Address"
                address={form.permanentAddress}
                onChange={(field, value) => {
                  if (field === 'division') {
                    setForm(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, division: value, district: '', upazila: '' } }));
                  } else if (field === 'district') {
                    setForm(prev => ({ ...prev, permanentAddress: { ...prev.permanentAddress, district: value, upazila: '' } }));
                  } else {
                    setNested('permanentAddress', field, value);
                  }
                }}
              />
            </div>
          </FadeIn>
        )}

        {activeTab === 'academic' && (
          <FadeIn direction="up" duration={0.4}>
            <div className="space-y-4">
              <InputField label="Student ID" value={form.studentId} onChange={(v) => set('studentId', v)} />
              <InputField label="Batch" type="number" value={String(form.batch)} onChange={(v) => set('batch', v)} />
              <InputField label="Session" value={form.session} onChange={(v) => set('session', v)} placeholder="e.g. 2019-20" />
              <InputField label="Department" value={form.department} onChange={(v) => set('department', v)} />
              <InputField label="Faculty" value={form.faculty} onChange={(v) => set('faculty', v)} />
            </div>
          </FadeIn>
        )}

        {activeTab === 'professional' && (
          <FadeIn direction="up" duration={0.4}>
            <div className="space-y-6">
              <InputField label="Profession" value={form.profession} onChange={(v) => set('profession', v)} placeholder="e.g. Software Engineer, Teacher" />
              <InputField label="Earning Source" value={form.earningSource} onChange={(v) => set('earningSource', v)} placeholder="e.g. Job, Freelancing, Business" />
              <InputField label="Skills (comma separated)" value={form.skills} onChange={(v) => set('skills', v)} placeholder="e.g. JavaScript, React, Node.js" />

              {/* Job History */}
              <fieldset className="border rounded-md p-4">
                <legend className="text-sm font-medium px-2">Job History</legend>
                <div className="space-y-4">
                  <AnimatePresence>
                    {form.jobHistory.map((job: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border rounded-md relative"
                      >
                        <InputField label="Company" value={job.company || ''} onChange={(v) => {
                          const updated = [...form.jobHistory]; updated[i] = { ...updated[i], company: v }; set('jobHistory', updated);
                        }} />
                        <InputField label="Position" value={job.position || ''} onChange={(v) => {
                          const updated = [...form.jobHistory]; updated[i] = { ...updated[i], position: v }; set('jobHistory', updated);
                        }} />
                        <InputField label="Start Date" type="date" value={job.startDate ? new Date(job.startDate).toISOString().split('T')[0] : ''} onChange={(v) => {
                          const updated = [...form.jobHistory]; updated[i] = { ...updated[i], startDate: v }; set('jobHistory', updated);
                        }} />
                        <InputField label="End Date" type="date" value={job.endDate ? new Date(job.endDate).toISOString().split('T')[0] : ''} onChange={(v) => {
                          const updated = [...form.jobHistory]; updated[i] = { ...updated[i], endDate: v }; set('jobHistory', updated);
                        }} />
                        <CheckboxField label="Currently working here" checked={job.isCurrent || false} onChange={(v) => {
                          const updated = [...form.jobHistory]; updated[i] = { ...updated[i], isCurrent: v }; set('jobHistory', updated);
                        }} />
                        <button type="button"
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                          onClick={() => set('jobHistory', form.jobHistory.filter((_: any, j: number) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <button type="button"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                    onClick={() => set('jobHistory', [...form.jobHistory, { company: '', position: '', startDate: '', endDate: '', isCurrent: false }])}>
                    <Plus className="h-4 w-4" /> Add Job
                  </button>
                </div>
              </fieldset>

              {/* Business Info */}
              <fieldset className="border rounded-md p-4">
                <legend className="text-sm font-medium px-2">Business Info</legend>
                <div className="space-y-4">
                  <AnimatePresence>
                    {form.businessInfo.map((biz: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border rounded-md relative"
                      >
                        <InputField label="Business Name" value={biz.businessName || ''} onChange={(v) => {
                          const updated = [...form.businessInfo]; updated[i] = { ...updated[i], businessName: v }; set('businessInfo', updated);
                        }} />
                        <InputField label="Type" value={biz.type || ''} onChange={(v) => {
                          const updated = [...form.businessInfo]; updated[i] = { ...updated[i], type: v }; set('businessInfo', updated);
                        }} />
                        <InputField label="Start Date" type="date" value={biz.startDate ? new Date(biz.startDate).toISOString().split('T')[0] : ''} onChange={(v) => {
                          const updated = [...form.businessInfo]; updated[i] = { ...updated[i], startDate: v }; set('businessInfo', updated);
                        }} />
                        <CheckboxField label="Currently active" checked={biz.isCurrent || false} onChange={(v) => {
                          const updated = [...form.businessInfo]; updated[i] = { ...updated[i], isCurrent: v }; set('businessInfo', updated);
                        }} />
                        <button type="button"
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                          onClick={() => set('businessInfo', form.businessInfo.filter((_: any, j: number) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <button type="button"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                    onClick={() => set('businessInfo', [...form.businessInfo, { businessName: '', type: '', startDate: '', isCurrent: false }])}>
                    <Plus className="h-4 w-4" /> Add Business
                  </button>
                </div>
              </fieldset>
            </div>
          </FadeIn>
        )}

        {activeTab === 'social' && (
          <FadeIn direction="up" duration={0.4}>
            <div className="space-y-4">
              <InputField label="Facebook" value={form.facebook} onChange={(v) => set('facebook', v)} placeholder="https://facebook.com/..." />
              <InputField label="LinkedIn" value={form.linkedin} onChange={(v) => set('linkedin', v)} placeholder="https://linkedin.com/in/..." />
              <InputField label="Website" value={form.website} onChange={(v) => set('website', v)} placeholder="https://..." />
            </div>
          </FadeIn>
        )}

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </form>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', required, placeholder, error }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${error ? 'border-red-500' : ''}`} />
      <FieldError message={error} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
        <option value="">Select...</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function AddressFieldset({ legend, address, onChange }: {
  legend: string;
  address: { division?: string; district?: string; upazila?: string; details?: string };
  onChange: (field: string, value: string) => void;
}) {
  const div = (address.division || '') as Division;
  const districtList = div && districts[div] ? districts[div] : [];
  const upazilaList = address.district && upazilas[address.district] ? upazilas[address.district] : [];

  const selectClass = 'w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50';

  return (
    <fieldset className="border rounded-md p-4">
      <legend className="text-sm font-medium px-2">{legend}</legend>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Division</label>
          <select value={address.division || ''} onChange={(e) => onChange('division', e.target.value)} className={selectClass}>
            <option value="">Select Division...</option>
            {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">District</label>
          <select value={address.district || ''} onChange={(e) => onChange('district', e.target.value)} disabled={!div} className={selectClass}>
            <option value="">Select District...</option>
            {districtList.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Upazila</label>
          <select value={address.upazila || ''} onChange={(e) => onChange('upazila', e.target.value)} disabled={!address.district} className={selectClass}>
            <option value="">Select Upazila...</option>
            {upazilaList.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <InputField label="Full Address" value={address.details || ''} onChange={(v) => onChange('details', v)} placeholder="House, Road, Area..." />
      </div>
    </fieldset>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
