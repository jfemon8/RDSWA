import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Save, Loader2, Plus, Trash2, GraduationCap, Palette, RotateCcw } from 'lucide-react';
import ImageUpload from '@/components/ui/ImageUpload';
import RichTextEditor from '@/components/ui/RichTextEditor';
import Spinner from '@/components/ui/Spinner';
import { useAuthStore } from '@/stores/authStore';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import { isValidHex } from '@/lib/colorUtils';
import { DEFAULT_BRAND_COLORS } from '@/hooks/useBrandColors';

const TABS = ['general', 'homepage', 'content', 'university', 'organizations', 'legal', 'social', 'academic'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  general: 'General & Branding', homepage: 'Home Page', content: 'About & Content',
  university: 'University', organizations: 'Organizations', legal: 'Legal', social: 'Social Links',
  academic: 'Academic Config',
};

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('general');

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'admin'],
    queryFn: async () => { const { data } = await api.get('/settings'); return data; },
    staleTime: 0,
  });

  if (isLoading) {
    return <Spinner size="md" />;
  }

  const settings = data?.data || {};

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Site Settings</h1>

        {/* Horizontally scrollable tab bar. flex-nowrap keeps everything on
            one row; shrink-0 on each button prevents labels from squeezing;
            -mx + px restores edge padding so the first/last tab don't hug
            the screen edge while scrolling. */}
        <div className="flex flex-nowrap gap-1.5 mb-6 border-b pb-2 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'general' && <GeneralTab settings={settings} />}
        {tab === 'homepage' && <HomepageTab settings={settings} />}
        {tab === 'content' && <ContentTab settings={settings} />}
        {tab === 'university' && <UniversityTab settings={settings} />}
        {tab === 'organizations' && <OrganizationsTab settings={settings} />}
        {tab === 'legal' && <LegalTab settings={settings} />}
        {tab === 'social' && <SocialTab settings={settings} />}
        {tab === 'academic' && <AcademicConfigSection />}
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// General & Branding
// ═══════════════════════════════════════════

function GeneralTab({ settings: s }: { settings: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    siteName: '', siteNameFull: '', siteNameBn: '', siteNameBnFull: '',
    contactEmail: '', contactPhone: '', address: '', foundedYear: 2021,
    logo: '', logoDark: '', footerLogo: '', footerLogoDark: '', favicon: '',
  });

  useEffect(() => {
    setForm({
      siteName: s.siteName || '', siteNameFull: s.siteNameFull || '',
      siteNameBn: s.siteNameBn || '', siteNameBnFull: s.siteNameBnFull || '',
      contactEmail: s.contactEmail || '', contactPhone: s.contactPhone || '',
      address: s.address || '', foundedYear: s.foundedYear || 2021,
      logo: s.logo || '', logoDark: s.logoDark || '',
      footerLogo: s.footerLogo || '', footerLogoDark: s.footerLogoDark || '',
      favicon: s.favicon || '',
    });
  }, [s]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/general', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('General settings saved'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  return (
    <FadeIn direction="up">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Association Name</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Short Name (EN)" value={form.siteName} onChange={(v) => setForm({ ...form, siteName: v })} placeholder="e.g. RDSWA" />
          <Field label="Full Name (EN)" value={form.siteNameFull} onChange={(v) => setForm({ ...form, siteNameFull: v })} placeholder="e.g. Rangpur Divisional Student Welfare Association" />
          <Field label="Short Name (বাংলা)" value={form.siteNameBn} onChange={(v) => setForm({ ...form, siteNameBn: v })} placeholder="e.g. রবিকস" />
          <Field label="Full Name (বাংলা)" value={form.siteNameBnFull} onChange={(v) => setForm({ ...form, siteNameBnFull: v })} placeholder="e.g. রংপুর বিভাগীয় ছাত্র কল্যাণ সমিতি" />
        </div>

        <h2 className="text-lg font-semibold text-foreground pt-2">Contact Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contact Email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} />
          <Field label="Contact Phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
        </div>
        <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        <Field label="Founded Year" value={String(form.foundedYear)} onChange={(v) => setForm({ ...form, foundedYear: parseInt(v) || 2021 })} />

        <h2 className="text-lg font-semibold text-foreground pt-2">Branding & Logos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs text-muted-foreground mb-1">Navbar Logo (Light Mode)</label><ImageUpload value={form.logo} onChange={(url) => setForm({ ...form, logo: url })} folder="branding" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Navbar Logo (Dark Mode)</label><ImageUpload value={form.logoDark} onChange={(url) => setForm({ ...form, logoDark: url })} folder="branding" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Footer Logo (Light Mode)</label><ImageUpload value={form.footerLogo} onChange={(url) => setForm({ ...form, footerLogo: url })} folder="branding" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Footer Logo (Dark Mode)</label><ImageUpload value={form.footerLogoDark} onChange={(url) => setForm({ ...form, footerLogoDark: url })} folder="branding" /></div>
          <div><label className="block text-xs text-muted-foreground mb-1">Favicon</label><ImageUpload value={form.favicon} onChange={(url) => setForm({ ...form, favicon: url })} folder="branding" /></div>
        </div>

        <SaveButton mutation={mutation} />

        <BrandColorsSection settings={s} />
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// Brand Colors — SuperAdmin only
// ═══════════════════════════════════════════

function BrandColorsSection({ settings }: { settings: any }) {
  const { user } = useAuthStore();
  const isSuperAdmin = user ? hasMinRole(user.role, UserRole.SUPER_ADMIN) : false;
  const queryClient = useQueryClient();
  const toast = useToast();

  const [colors, setColors] = useState({
    lightPrimary: DEFAULT_BRAND_COLORS.lightPrimary,
    lightSecondary: DEFAULT_BRAND_COLORS.lightSecondary,
    darkPrimary: DEFAULT_BRAND_COLORS.darkPrimary,
    darkSecondary: DEFAULT_BRAND_COLORS.darkSecondary,
  });

  useEffect(() => {
    const bc = settings?.brandColors || {};
    setColors({
      lightPrimary: bc.lightPrimary || DEFAULT_BRAND_COLORS.lightPrimary,
      lightSecondary: bc.lightSecondary || DEFAULT_BRAND_COLORS.lightSecondary,
      darkPrimary: bc.darkPrimary || DEFAULT_BRAND_COLORS.darkPrimary,
      darkSecondary: bc.darkSecondary || DEFAULT_BRAND_COLORS.darkSecondary,
    });
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/brand-colors', { brandColors: colors }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Brand colors saved — preview is live');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save colors'),
  });

  const resetToDefaults = () => setColors({ ...DEFAULT_BRAND_COLORS });

  // Non-SuperAdmin users see the section as read-only with an explanation.
  const readOnly = !isSuperAdmin;

  const allValid = Object.values(colors).every(isValidHex);

  return (
    <FadeIn direction="up" delay={0.1}>
      <div className="mt-10 pt-8 border-t space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Brand Colors</h2>
          {readOnly && (
            <span className="ml-auto text-xs text-muted-foreground italic">Super Admin only</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          These colors drive the primary / secondary buttons, links, tags, and accent surfaces across the whole website. Pick from the swatch or paste a 6-digit hex (e.g. <code className="px-1 rounded bg-muted">#008f57</code>). Empty values fall back to the brand defaults.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorField
            label="Light Mode — Primary"
            value={colors.lightPrimary}
            onChange={(v) => setColors({ ...colors, lightPrimary: v })}
            disabled={readOnly}
          />
          <ColorField
            label="Light Mode — Secondary"
            value={colors.lightSecondary}
            onChange={(v) => setColors({ ...colors, lightSecondary: v })}
            disabled={readOnly}
          />
          <ColorField
            label="Dark Mode — Primary"
            value={colors.darkPrimary}
            onChange={(v) => setColors({ ...colors, darkPrimary: v })}
            disabled={readOnly}
          />
          <ColorField
            label="Dark Mode — Secondary"
            value={colors.darkSecondary}
            onChange={(v) => setColors({ ...colors, darkSecondary: v })}
            disabled={readOnly}
          />
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => mutation.mutate()}
              disabled={!allValid || mutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Brand Colors
            </motion.button>
            <button
              type="button"
              onClick={resetToDefaults}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-md hover:bg-accent text-sm text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
            </button>
            {!allValid && (
              <span className="text-xs text-destructive">One or more values aren't valid 6-digit hex codes.</span>
            )}
          </div>
        )}
      </div>
    </FadeIn>
  );
}

function ColorField({
  label, value, onChange, disabled,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const valid = isValidHex(value);
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        {/* Native swatch — standard, accessible, no third-party picker lib needed. */}
        <input
          type="color"
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={`${label} color picker`}
          className="h-10 w-14 rounded-md border cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 p-0.5 bg-background"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          disabled={disabled}
          placeholder="#008f57"
          className={`flex-1 px-3 py-2 border rounded-md bg-card text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 ${!valid && value ? 'border-destructive' : ''}`}
        />
      </div>
      {!valid && value && (
        <p className="text-[11px] text-destructive mt-1">Must be #RRGGBB format</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Home Page
// ═══════════════════════════════════════════

function HomepageTab({ settings: s }: { settings: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    heroTitle: '', heroTitleGradient: '', heroBadgeText: '', heroSubtitle: '',
    heroImage: '', heroTagline: '', rotatingWords: [] as string[],
    introText: '', featuresHeading: '', featuresSubheading: '',
    features: [] as Array<{ title: string; description: string }>,
    servicesHeading: '',
    services: [] as Array<{ title: string; description: string; link: string }>,
    ctaTitle: '', ctaButtonText: '',
  });

  useEffect(() => {
    const h = s.homePageContent || {};
    setForm({
      heroTitle: h.heroTitle || '', heroTitleGradient: h.heroTitleGradient || '',
      heroBadgeText: h.heroBadgeText || '', heroSubtitle: h.heroSubtitle || '',
      heroImage: h.heroImage || '', heroTagline: h.heroTagline || '',
      rotatingWords: h.rotatingWords || [],
      introText: h.introText || '', featuresHeading: h.featuresHeading || '',
      featuresSubheading: h.featuresSubheading || '',
      features: h.features || [], servicesHeading: h.servicesHeading || '',
      services: h.services || [], ctaTitle: h.ctaTitle || '', ctaButtonText: h.ctaButtonText || '',
    });
  }, [s]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/homepage', { homePageContent: form }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Homepage saved'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  return (
    <FadeIn direction="up">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Hero Section</h2>
        <Field label="Badge Text" value={form.heroBadgeText} onChange={(v) => setForm({ ...form, heroBadgeText: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Hero Title (Line 1)" value={form.heroTitle} onChange={(v) => setForm({ ...form, heroTitle: v })} />
          <Field label="Hero Title Gradient (Line 2)" value={form.heroTitleGradient} onChange={(v) => setForm({ ...form, heroTitleGradient: v })} />
        </div>
        <Field label="Hero Subtitle" value={form.heroSubtitle} onChange={(v) => setForm({ ...form, heroSubtitle: v })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tagline (before rotating words)" value={form.heroTagline} onChange={(v) => setForm({ ...form, heroTagline: v })} />
          <Field label="Rotating Words (comma-separated)" value={form.rotatingWords.join(', ')} onChange={(v) => setForm({ ...form, rotatingWords: v.split(',').map(w => w.trim()).filter(Boolean) })} />
        </div>
        <ImageUpload value={form.heroImage} onChange={(url) => setForm({ ...form, heroImage: url })} folder="settings" label="Hero Image" />

        <h2 className="text-lg font-semibold text-foreground pt-2">CTA Section</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="CTA Title" value={form.ctaTitle} onChange={(v) => setForm({ ...form, ctaTitle: v })} />
          <Field label="CTA Button Text" value={form.ctaButtonText} onChange={(v) => setForm({ ...form, ctaButtonText: v })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Intro / CTA Text</label>
          <textarea value={form.introText} onChange={(e) => setForm({ ...form, introText: e.target.value })} rows={3}
            className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
        </div>

        <h2 className="text-lg font-semibold text-foreground pt-2">Features (What We Offer)</h2>
        <Field label="Features Heading" value={form.featuresHeading} onChange={(v) => setForm({ ...form, featuresHeading: v })} />
        <Field label="Features Subheading" value={form.featuresSubheading} onChange={(v) => setForm({ ...form, featuresSubheading: v })} />
        <ArrayEditor items={form.features} fields={['title', 'description']}
          onChange={(features) => setForm({ ...form, features })}
          onAdd={() => setForm({ ...form, features: [...form.features, { title: '', description: '' }] })} label="Feature" />

        <h2 className="text-lg font-semibold text-foreground pt-2">Services (Everything You Need)</h2>
        <Field label="Services Heading" value={form.servicesHeading} onChange={(v) => setForm({ ...form, servicesHeading: v })} />
        <ArrayEditor items={form.services} fields={['title', 'description', 'link']}
          onChange={(services) => setForm({ ...form, services })}
          onAdd={() => setForm({ ...form, services: [...form.services, { title: '', description: '', link: '' }] })} label="Service" />

        <SaveButton mutation={mutation} />
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// About & Content
// ═══════════════════════════════════════════

function ContentTab({ settings: s }: { settings: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    aboutContent: '', missionContent: '', visionContent: '', objectivesContent: '', historyContent: '',
  });

  useEffect(() => {
    setForm({
      aboutContent: s.aboutContent || '', missionContent: s.missionContent || '',
      visionContent: s.visionContent || '', objectivesContent: s.objectivesContent || '',
      historyContent: s.historyContent || '',
    });
  }, [s]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/about', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Content saved'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  return (
    <FadeIn direction="up">
      <div className="space-y-4">
        <RichField label="About Content" value={form.aboutContent} onChange={(v) => setForm({ ...form, aboutContent: v })} placeholder="About the association..." />
        <RichField label="Mission" value={form.missionContent} onChange={(v) => setForm({ ...form, missionContent: v })} placeholder="Mission statement..." />
        <RichField label="Vision" value={form.visionContent} onChange={(v) => setForm({ ...form, visionContent: v })} placeholder="Vision statement..." />
        <RichField label="Objectives" value={form.objectivesContent} onChange={(v) => setForm({ ...form, objectivesContent: v })} placeholder="Objectives..." />
        <RichField label="History" value={form.historyContent} onChange={(v) => setForm({ ...form, historyContent: v })} placeholder="Organization history..." />
        <SaveButton mutation={mutation} />
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// University
// ═══════════════════════════════════════════

function UniversityTab({ settings: s }: { settings: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '', logo: '', email: '', phone: '', website: '', address: '',
    overview: '', history: '', campusInfo: '', admissionInfo: '',
    mapEmbedUrl: '',
  });

  useEffect(() => {
    const u = s.universityInfo || {};
    setForm({
      name: u.name || '', logo: u.logo || '', email: u.email || '', phone: u.phone || '',
      website: u.website || '', address: u.address || '', overview: u.overview || '',
      history: u.history || '', campusInfo: u.campusInfo || '', admissionInfo: u.admissionInfo || '',
      mapEmbedUrl: u.mapEmbedUrl || '',
    });
  }, [s]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/university', { universityInfo: form }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('University info saved'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  const u = (field: string, value: any) => setForm({ ...form, [field]: value });

  return (
    <FadeIn direction="up">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><GraduationCap className="h-5 w-5" /> University Details</h2>
        <Field label="University Name" value={form.name} onChange={(v) => u('name', v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Email" value={form.email} onChange={(v) => u('email', v)} />
          <Field label="Phone" value={form.phone} onChange={(v) => u('phone', v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Website" value={form.website} onChange={(v) => u('website', v)} />
          <Field label="Address" value={form.address} onChange={(v) => u('address', v)} />
        </div>
        <div><label className="block text-sm font-medium text-foreground mb-1">Logo</label><ImageUpload value={form.logo} onChange={(url) => u('logo', url)} folder="university" /></div>

        <h2 className="text-lg font-semibold text-foreground pt-2">Content</h2>
        <RichField label="Overview" value={form.overview} onChange={(v) => u('overview', v)} placeholder="University overview..." />
        <RichField label="History" value={form.history} onChange={(v) => u('history', v)} placeholder="University history..." />
        <RichField label="Campus Info" value={form.campusInfo} onChange={(v) => u('campusInfo', v)} placeholder="Campus information..." />
        <RichField label="Admission Info" value={form.admissionInfo} onChange={(v) => u('admissionInfo', v)} placeholder="Admission information..." />

        <h2 className="text-lg font-semibold text-foreground pt-2">Google Map Location</h2>
        <Field label="Google Maps Embed URL" value={form.mapEmbedUrl} onChange={(v) => u('mapEmbedUrl', v)} placeholder="https://www.google.com/maps/embed?pb=..." />
        <p className="text-xs text-muted-foreground -mt-2">Google Maps &gt; Share &gt; Embed a map &gt; Copy the src URL from the iframe code</p>

        <SaveButton mutation={mutation} />
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// Organizations
// ═══════════════════════════════════════════

function OrganizationsTab({ settings: s }: { settings: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [orgs, setOrgs] = useState<Array<{ name: string; description: string; website: string; logo: string }>>([]);

  useEffect(() => {
    setOrgs((s.otherOrganizations || []).map((o: any) => ({ name: o.name || '', description: o.description || '', website: o.website || '', logo: o.logo || '' })));
  }, [s]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/organizations', { otherOrganizations: orgs }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Organizations saved'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  return (
    <FadeIn direction="up">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Other Organizations</h2>
          <button type="button" onClick={() => setOrgs([...orgs, { name: '', description: '', website: '', logo: '' }])}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {orgs.map((org, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative">
            <button type="button" onClick={() => setOrgs(orgs.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
            <input value={org.name} placeholder="Organization Name" onChange={(e) => { const o = [...orgs]; o[i] = { ...o[i], name: e.target.value }; setOrgs(o); }} className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
            <RichTextEditor value={org.description} onChange={(v) => { const o = [...orgs]; o[i] = { ...o[i], description: v }; setOrgs(o); }} placeholder="Description..." minHeight="80px" />
            <input value={org.website} placeholder="Website URL" onChange={(e) => { const o = [...orgs]; o[i] = { ...o[i], website: e.target.value }; setOrgs(o); }} className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
            <input value={org.logo} placeholder="Logo URL" onChange={(e) => { const o = [...orgs]; o[i] = { ...o[i], logo: e.target.value }; setOrgs(o); }} className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
          </motion.div>
        ))}
        {orgs.length === 0 && <p className="text-sm text-muted-foreground">No organizations yet.</p>}
        <SaveButton mutation={mutation} />
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// Legal (FAQ + Privacy + Terms)
// ═══════════════════════════════════════════

function LegalTab({ settings: s }: { settings: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [faq, setFaq] = useState<Array<{ question: string; answer: string }>>([]);
  const [privacy, setPrivacy] = useState<Array<{ title: string; content: string }>>([]);
  const [terms, setTerms] = useState<Array<{ title: string; content: string }>>([]);

  useEffect(() => {
    setFaq(s.faq || []);
    setPrivacy(s.privacyPolicy || []);
    setTerms(s.termsConditions || []);
  }, [s]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/legal', { faq, privacyPolicy: privacy, termsConditions: terms }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Legal content saved'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  return (
    <FadeIn direction="up">
      <div className="space-y-6">
        {/* FAQ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">FAQ</h2>
            <button type="button" onClick={() => setFaq([...faq, { question: '', answer: '' }])}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20"><Plus className="h-3 w-3" /> Add</button>
          </div>
          {faq.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative mb-2">
              <button type="button" onClick={() => setFaq(faq.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              <input value={item.question} placeholder="Question" onChange={(e) => { const f = [...faq]; f[i] = { ...f[i], question: e.target.value }; setFaq(f); }} className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
              <RichTextEditor value={item.answer} onChange={(v) => { const f = [...faq]; f[i] = { ...f[i], answer: v }; setFaq(f); }} placeholder="Answer..." minHeight="80px" />
            </motion.div>
          ))}
          {faq.length === 0 && <p className="text-sm text-muted-foreground">No FAQ items.</p>}
        </div>

        {/* Privacy Policy */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Privacy Policy</h2>
            <button type="button" onClick={() => setPrivacy([...privacy, { title: '', content: '' }])}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20"><Plus className="h-3 w-3" /> Add Section</button>
          </div>
          {privacy.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative mb-2">
              <button type="button" onClick={() => setPrivacy(privacy.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              <input value={item.title} placeholder="Section Title" onChange={(e) => { const p = [...privacy]; p[i] = { ...p[i], title: e.target.value }; setPrivacy(p); }} className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
              <RichTextEditor value={item.content} onChange={(v) => { const p = [...privacy]; p[i] = { ...p[i], content: v }; setPrivacy(p); }} placeholder="Section content..." minHeight="100px" />
            </motion.div>
          ))}
          {privacy.length === 0 && <p className="text-sm text-muted-foreground">No sections.</p>}
        </div>

        {/* Terms */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Terms & Conditions</h2>
            <button type="button" onClick={() => setTerms([...terms, { title: '', content: '' }])}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20"><Plus className="h-3 w-3" /> Add Section</button>
          </div>
          {terms.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative mb-2">
              <button type="button" onClick={() => setTerms(terms.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              <input value={item.title} placeholder="Section Title" onChange={(e) => { const t = [...terms]; t[i] = { ...t[i], title: e.target.value }; setTerms(t); }} className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
              <RichTextEditor value={item.content} onChange={(v) => { const t = [...terms]; t[i] = { ...t[i], content: v }; setTerms(t); }} placeholder="Section content..." minHeight="100px" />
            </motion.div>
          ))}
          {terms.length === 0 && <p className="text-sm text-muted-foreground">No sections.</p>}
        </div>

        <SaveButton mutation={mutation} />
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// Social Links
// ═══════════════════════════════════════════

function SocialTab({ settings: s }: { settings: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    facebook: '', youtube: '', linkedin: '', twitter: '',
    androidApp: '', iosApp: '', windowsApp: '', macosApp: '', linuxApp: '',
  });

  useEffect(() => {
    const sl = s.socialLinks || {};
    setForm({
      facebook: sl.facebook || '', youtube: sl.youtube || '',
      linkedin: sl.linkedin || '', twitter: sl.twitter || '',
      androidApp: sl.androidApp || '', iosApp: sl.iosApp || '',
      windowsApp: sl.windowsApp || '', macosApp: sl.macosApp || '',
      linuxApp: sl.linuxApp || '',
    });
  }, [s]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/social', { socialLinks: form }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Social links saved'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  return (
    <FadeIn direction="up">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Social Profiles</h2>
        <Field label="Facebook" value={form.facebook} onChange={(v) => setForm({ ...form, facebook: v })} placeholder="https://facebook.com/..." />
        <Field label="YouTube" value={form.youtube} onChange={(v) => setForm({ ...form, youtube: v })} placeholder="https://youtube.com/..." />
        <Field label="LinkedIn" value={form.linkedin} onChange={(v) => setForm({ ...form, linkedin: v })} placeholder="https://linkedin.com/..." />
        <Field label="Twitter / X" value={form.twitter} onChange={(v) => setForm({ ...form, twitter: v })} placeholder="https://x.com/..." />

        <h2 className="text-lg font-semibold text-foreground pt-4">App Download Links</h2>
        <p className="text-sm text-muted-foreground -mt-2">
          Leave blank to hide that platform's download button in the footer.
        </p>
        <Field label="Android (Play Store)" value={form.androidApp} onChange={(v) => setForm({ ...form, androidApp: v })} placeholder="https://play.google.com/store/apps/details?id=..." />
        <Field label="iOS (App Store)" value={form.iosApp} onChange={(v) => setForm({ ...form, iosApp: v })} placeholder="https://apps.apple.com/app/id..." />
        <Field label="Windows (Microsoft Store)" value={form.windowsApp} onChange={(v) => setForm({ ...form, windowsApp: v })} placeholder="https://apps.microsoft.com/detail/..." />
        <Field label="macOS (Mac App Store)" value={form.macosApp} onChange={(v) => setForm({ ...form, macosApp: v })} placeholder="https://apps.apple.com/app/mac/id..." />
        <Field label="Linux (direct / Snap / Flathub)" value={form.linuxApp} onChange={(v) => setForm({ ...form, linuxApp: v })} placeholder="https://snapcraft.io/... or https://flathub.org/apps/..." />

        <SaveButton mutation={mutation} />
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// Academic Config (separate section, existing)
// ═══════════════════════════════════════════

function AcademicConfigSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: acData, isLoading } = useQuery({
    queryKey: ['settings', 'academic-config'],
    queryFn: async () => { const { data } = await api.get('/settings/academic-config'); return data.data as { batches: string[]; sessions: string[]; faculties: Array<{ name: string; departments: string[] }> }; },
  });

  const [batches, setBatches] = useState('');
  const [sessions, setSessions] = useState('');
  const [faculties, setFaculties] = useState<Array<{ name: string; departments: string[] }>>([]);

  useEffect(() => {
    if (acData) {
      setBatches(acData.batches?.join(', ') || '');
      setSessions(acData.sessions?.join(', ') || '');
      setFaculties(acData.faculties || []);
    }
  }, [acData]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/academic-config', {
      batches: batches.split(',').map((b) => b.trim()).filter(Boolean),
      sessions: sessions.split(',').map((s) => s.trim()).filter(Boolean),
      faculties,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings', 'academic-config'] }); toast.success('Academic config saved'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <FadeIn direction="up" delay={0.1}>
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Academic Config</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Manage dropdown values for batch, session, faculty, and department used in user profiles.</p>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Batches (comma-separated)</label>
          <input value={batches} onChange={(e) => setBatches(e.target.value)} placeholder="1st, 2nd, 3rd, ..."
            className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Sessions (comma-separated)</label>
          <input value={sessions} onChange={(e) => setSessions(e.target.value)} placeholder="2010-11, 2011-12, ..."
            className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">Faculties & Departments</label>
            <button type="button" onClick={() => setFaculties([...faculties, { name: '', departments: [] }])}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20"><Plus className="h-3 w-3" /> Add Faculty</button>
          </div>
          <AnimatePresence>
            {faculties.map((fac, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="border rounded-lg p-4 space-y-3 relative mb-3">
                <button type="button" onClick={() => setFaculties(faculties.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Faculty Name</label>
                  <input value={fac.name} placeholder="e.g. Faculty of Science" onChange={(e) => { const f = [...faculties]; f[i] = { ...f[i], name: e.target.value }; setFaculties(f); }}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Departments (comma-separated)</label>
                  <textarea value={fac.departments.join(', ')} placeholder="Mathematics, Physics, ..." rows={2}
                    onChange={(e) => { const f = [...faculties]; f[i] = { ...f[i], departments: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) }; setFaculties(f); }}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {faculties.length === 0 && <p className="text-sm text-muted-foreground">No faculties.</p>}
        </div>
        <SaveButton mutation={mutation} label="Save Academic Config" />
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════
// Shared UI components
// ═══════════════════════════════════════════

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
    </div>
  );
}

function RichField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <RichTextEditor value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function SaveButton({ mutation, label = 'Save' }: { mutation: { mutate: () => void; isPending: boolean }; label?: string }) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 mt-4"
    >
      {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {label}
    </motion.button>
  );
}

function ArrayEditor({ items, fields, onChange, onAdd, label }: {
  items: any[]; fields: string[]; onChange: (items: any[]) => void; onAdd: () => void; label: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">{label}s</span>
        <button type="button" onClick={onAdd} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20"><Plus className="h-3 w-3" /> Add</button>
      </div>
      {items.map((item, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative mb-2">
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
          {fields.map((f) => (
            f === 'description' ? (
              <textarea key={f} value={item[f] || ''} placeholder={f.charAt(0).toUpperCase() + f.slice(1)} rows={2}
                onChange={(e) => { const arr = [...items]; arr[i] = { ...arr[i], [f]: e.target.value }; onChange(arr); }}
                className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
            ) : (
              <input key={f} value={item[f] || ''} placeholder={f === 'link' ? 'Link (e.g. /blood-donors)' : f.charAt(0).toUpperCase() + f.slice(1)}
                onChange={(e) => { const arr = [...items]; arr[i] = { ...arr[i], [f]: e.target.value }; onChange(arr); }}
                className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
            )
          ))}
        </motion.div>
      ))}
    </div>
  );
}
