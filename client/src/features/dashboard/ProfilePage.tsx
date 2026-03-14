import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Save, Loader2, Plus, Trash2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { divisions, districts, upazilas, type Division } from '@/data/bdGeo';
import { useToast } from '@/components/ui/Toast';
import { extractFieldErrors } from '@/lib/formErrors';

interface AcademicConfig {
  batches: string[];
  sessions: string[];
  faculties: Array<{ name: string; departments: string[] }>;
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'personal' | 'academic' | 'professional' | 'social'>('personal');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: academicData } = useQuery({
    queryKey: ['settings', 'academic-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/academic-config');
      return data.data as AcademicConfig;
    },
    staleTime: 10 * 60 * 1000,
  });

  const ac = academicData || { batches: [], sessions: [], faculties: [] };

  const [form, setForm] = useState({
    name: user?.name || '',
    nameBn: user?.nameBn || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
    gender: user?.gender || '',
    bloodGroup: user?.bloodGroup || '',
    isBloodDonor: user?.isBloodDonor || false,
    presentAddress: user?.presentAddress || { division: '', district: '', upazila: '', details: '' },
    permanentAddress: user?.permanentAddress || { division: '', district: '', upazila: '', details: '' },
    studentId: user?.studentId || '',
    registrationNumber: (user as any)?.registrationNumber || '',
    batch: user?.batch ? String(user.batch) : '',
    session: user?.session || '',
    department: user?.department || '',
    faculty: user?.faculty || '',
    facebook: user?.facebook || '',
    linkedin: user?.linkedin || '',
    website: user?.website || '',
    skills: user?.skills?.join(', ') || '',
    profession: user?.profession || '',
    earningSource: user?.earningSource || '',
    jobHistory: user?.jobHistory || [],
    businessInfo: user?.businessInfo || [],
    profileVisibility: user?.profileVisibility || {
      phone: false, email: false, dateOfBirth: true, nid: false,
      presentAddress: false, permanentAddress: false, bloodGroup: true,
      studentId: true, registrationNumber: false, facebook: true, linkedin: true,
    },
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
      navigate('/dashboard/profile');
    },
    onError: (err: any) => {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
        // Auto-switch to the tab containing the first error field
        const firstKey = Object.keys(fieldErrors)[0];
        const personalFields = ['name', 'nameBn', 'phone', 'dateOfBirth', 'gender', 'bloodGroup', 'presentAddress', 'permanentAddress'];
        const academicFields = ['studentId', 'registrationNumber', 'batch', 'session', 'faculty', 'department'];
        const professionalFields = ['profession', 'earningSource', 'skills'];
        if (personalFields.some((f) => firstKey.startsWith(f))) setActiveTab('personal');
        else if (academicFields.includes(firstKey)) setActiveTab('academic');
        else if (professionalFields.includes(firstKey)) setActiveTab('professional');
        else setActiveTab('social');
      } else {
        toast.error(err?.response?.data?.message || 'Failed to update profile');
      }
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
    else delete payload.batch;
    // Strip empty strings and null values; also clean address objects with all-empty fields
    for (const key of Object.keys(payload)) {
      if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
        delete payload[key];
      } else if (typeof payload[key] === 'object' && !Array.isArray(payload[key]) && key !== 'profileVisibility') {
        const obj = payload[key];
        const allEmpty = Object.values(obj).every((v) => v === '' || v === null || v === undefined);
        if (allEmpty) delete payload[key];
      }
    }
    updateMutation.mutate(payload);
  };

  const set = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));
  const setNested = (parent: string, field: string, value: string) =>
    setForm((prev) => ({ ...prev, [parent]: { ...(prev as any)[parent], [field]: value } }));
  const setVisibility = (field: string, value: boolean) =>
    setForm((prev) => ({ ...prev, profileVisibility: { ...prev.profileVisibility, [field]: value } }));

  // Get departments for selected faculty
  const selectedFacultyObj = ac.faculties.find((f) => f.name === form.faculty);
  const departmentOptions = selectedFacultyObj?.departments || [];

  const tabs = [
    { key: 'personal', label: 'Personal' },
    { key: 'academic', label: 'Academic' },
    { key: 'professional', label: 'Professional' },
    { key: 'social', label: 'Social' },
  ] as const;

  return (
    <div className="container mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard/profile" className="p-2 hover:bg-accent rounded-md transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Edit Profile</h1>
      </div>

      <div className="flex gap-2 mb-6 border-b relative overflow-x-auto">
        {tabs.map((tab) => (
          <motion.button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
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
              <InputField label="Name (Bangla)" value={form.nameBn} onChange={(v) => { set('nameBn', v); setErrors((prev) => { const { nameBn, ...rest } = prev; return rest; }); }} placeholder="বাংলায় নাম" error={errors.nameBn} />
              <VisibilityField label="Phone" isPublic={form.profileVisibility.phone ?? false} onToggle={(v) => setVisibility('phone', v)}>
                <InputField label="Phone" value={form.phone} onChange={(v) => { set('phone', v); setErrors((prev) => { const { phone, ...rest } = prev; return rest; }); }} error={errors.phone} />
              </VisibilityField>
              <VisibilityField label="Date of Birth" isPublic={form.profileVisibility.dateOfBirth ?? true} onToggle={(v) => setVisibility('dateOfBirth', v)}>
                <InputField label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => { set('dateOfBirth', v); setErrors((prev) => { const { dateOfBirth, ...rest } = prev; return rest; }); }} error={errors.dateOfBirth} />
              </VisibilityField>
              <SelectField label="Gender" value={form.gender} onChange={(v) => { set('gender', v); setErrors((prev) => { const { gender, ...rest } = prev; return rest; }); }} options={[{ label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }]} error={errors.gender} />
              <VisibilityField label="Blood Group" isPublic={form.profileVisibility.bloodGroup ?? true} onToggle={(v) => setVisibility('bloodGroup', v)}>
                <SelectField label="Blood Group" value={form.bloodGroup} onChange={(v) => { set('bloodGroup', v); setErrors((prev) => { const { bloodGroup, ...rest } = prev; return rest; }); }} options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => ({ label: v, value: v }))} error={errors.bloodGroup} />
              </VisibilityField>
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
              <VisibilityField label="Student ID/Roll" isPublic={form.profileVisibility.studentId ?? true} onToggle={(v) => setVisibility('studentId', v)}>
                <InputField label="Student ID / Roll Number" value={form.studentId} onChange={(v) => { set('studentId', v); setErrors((prev) => { const { studentId, ...rest } = prev; return rest; }); }} error={errors.studentId} />
              </VisibilityField>
              <VisibilityField label="Registration Number" isPublic={form.profileVisibility.registrationNumber ?? false} onToggle={(v) => setVisibility('registrationNumber', v)}>
                <InputField label="Registration Number" value={form.registrationNumber} onChange={(v) => { set('registrationNumber', v); setErrors((prev) => { const { registrationNumber, ...rest } = prev; return rest; }); }} error={errors.registrationNumber} />
              </VisibilityField>
              <SelectField
                label="University Batch"
                value={form.batch}
                onChange={(v) => set('batch', v)}
                options={ac.batches.map((b) => ({ label: b, value: String(ac.batches.indexOf(b) + 1) }))}
              />
              <SelectField
                label="Session"
                value={form.session}
                onChange={(v) => set('session', v)}
                options={ac.sessions.map((s) => ({ label: s, value: s }))}
              />
              <SelectField
                label="Faculty"
                value={form.faculty}
                onChange={(v) => { set('faculty', v); set('department', ''); }}
                options={ac.faculties.map((f) => ({ label: f.name, value: f.name }))}
              />
              <SelectField
                label="Department"
                value={form.department}
                onChange={(v) => set('department', v)}
                options={departmentOptions.map((d) => ({ label: d, value: d }))}
                disabled={!form.faculty}
              />
            </div>
          </FadeIn>
        )}

        {activeTab === 'professional' && (
          <FadeIn direction="up" duration={0.4}>
            <div className="space-y-6">
              <InputField label="Profession" value={form.profession} onChange={(v) => { set('profession', v); setErrors((prev) => { const { profession, ...rest } = prev; return rest; }); }} placeholder="e.g. Software Engineer, Teacher" error={errors.profession} />
              <InputField label="Earning Source" value={form.earningSource} onChange={(v) => { set('earningSource', v); setErrors((prev) => { const { earningSource, ...rest } = prev; return rest; }); }} placeholder="e.g. Job, Freelancing, Business" error={errors.earningSource} />
              <InputField label="Skills (comma separated)" value={form.skills} onChange={(v) => { set('skills', v); setErrors((prev) => { const { skills, ...rest } = prev; return rest; }); }} placeholder="e.g. JavaScript, React, Node.js" error={errors.skills} />

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
              <VisibilityField label="Facebook" isPublic={form.profileVisibility.facebook ?? true} onToggle={(v) => setVisibility('facebook', v)}>
                <InputField label="Facebook" value={form.facebook} onChange={(v) => { set('facebook', v); setErrors((prev) => { const { facebook, ...rest } = prev; return rest; }); }} placeholder="https://facebook.com/..." error={errors.facebook} />
              </VisibilityField>
              <VisibilityField label="LinkedIn" isPublic={form.profileVisibility.linkedin ?? true} onToggle={(v) => setVisibility('linkedin', v)}>
                <InputField label="LinkedIn" value={form.linkedin} onChange={(v) => { set('linkedin', v); setErrors((prev) => { const { linkedin, ...rest } = prev; return rest; }); }} placeholder="https://linkedin.com/in/..." error={errors.linkedin} />
              </VisibilityField>
              <InputField label="Website" value={form.website} onChange={(v) => { set('website', v); setErrors((prev) => { const { website, ...rest } = prev; return rest; }); }} placeholder="https://..." error={errors.website} />
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

function SelectField({ label, value, onChange, options, disabled, error }: {
  label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; disabled?: boolean; error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 ${error ? 'border-red-500' : ''}`}>
        <option value="">Select...</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <FieldError message={error} />
    </div>
  );
}

function VisibilityField({ label, isPublic, onToggle, children }: {
  label: string; isPublic: boolean; onToggle: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <button
        type="button"
        onClick={() => onToggle(!isPublic)}
        className={`absolute top-0 right-0 flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
          isPublic ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-muted-foreground hover:bg-accent'
        }`}
        title={isPublic ? `${label} is visible to others` : `${label} is hidden from others`}
      >
        {isPublic ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{isPublic ? 'Public' : 'Private'}</span>
      </button>
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
          <label className="block text-sm font-medium mb-1">Area</label>
          <select value={address.upazila || ''} onChange={(e) => onChange('upazila', e.target.value)} disabled={!address.district} className={selectClass}>
            <option value="">Select Area...</option>
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
