import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from '@/lib/queryKeys';
import { Save, Loader2, Plus, Trash2 } from 'lucide-react';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });

  const [form, setForm] = useState({
    siteName: '', contactEmail: '', contactPhone: '', address: '',
    foundedYear: 2021,
    aboutContent: '', missionContent: '', visionContent: '',
    objectivesContent: '', historyContent: '',
    homePageContent: {
      heroTitle: '', heroTitleGradient: '', heroBadgeText: '',
      heroSubtitle: '', heroImage: '', heroTagline: '',
      rotatingWords: [] as string[],
      introText: '', featuresHeading: '', featuresSubheading: '',
      features: [] as Array<{ title: string; description: string }>,
      servicesHeading: '',
      services: [] as Array<{ title: string; description: string; link: string }>,
      ctaTitle: '', ctaButtonText: '',
    },
    universityInfo: { overview: '', history: '', campusInfo: '', admissionInfo: '', contactInfo: '' },
    faq: [] as Array<{ question: string; answer: string }>,
    privacyPolicy: [] as Array<{ title: string; content: string }>,
    termsConditions: [] as Array<{ title: string; content: string }>,
    socialLinks: { facebook: '', youtube: '', linkedin: '' },
    paymentGateway: {
      bkash: { number: '', isActive: false },
      nagad: { number: '', isActive: false },
      rocket: { number: '', isActive: false },
    },
  });

  useEffect(() => {
    if (data?.data) {
      const s = data.data;
      setForm({
        siteName: s.siteName || '',
        contactEmail: s.contactEmail || '',
        contactPhone: s.contactPhone || '',
        address: s.address || '',
        aboutContent: s.aboutContent || '',
        missionContent: s.missionContent || '',
        visionContent: s.visionContent || '',
        objectivesContent: s.objectivesContent || '',
        historyContent: s.historyContent || '',
        foundedYear: s.foundedYear || 2021,
        homePageContent: {
          heroTitle: s.homePageContent?.heroTitle || '',
          heroTitleGradient: s.homePageContent?.heroTitleGradient || '',
          heroBadgeText: s.homePageContent?.heroBadgeText || '',
          heroSubtitle: s.homePageContent?.heroSubtitle || '',
          heroImage: s.homePageContent?.heroImage || '',
          heroTagline: s.homePageContent?.heroTagline || '',
          rotatingWords: s.homePageContent?.rotatingWords || [],
          introText: s.homePageContent?.introText || '',
          featuresHeading: s.homePageContent?.featuresHeading || '',
          featuresSubheading: s.homePageContent?.featuresSubheading || '',
          features: s.homePageContent?.features || [],
          servicesHeading: s.homePageContent?.servicesHeading || '',
          services: s.homePageContent?.services || [],
          ctaTitle: s.homePageContent?.ctaTitle || '',
          ctaButtonText: s.homePageContent?.ctaButtonText || '',
        },
        universityInfo: {
          overview: s.universityInfo?.overview || '',
          history: s.universityInfo?.history || '',
          campusInfo: s.universityInfo?.campusInfo || '',
          admissionInfo: s.universityInfo?.admissionInfo || '',
          contactInfo: s.universityInfo?.contactInfo || '',
        },
        faq: s.faq || [],
        privacyPolicy: s.privacyPolicy || [],
        termsConditions: s.termsConditions || [],
        socialLinks: s.socialLinks || { facebook: '', youtube: '', linkedin: '' },
        paymentGateway: s.paymentGateway || {
          bkash: { number: '', isActive: false },
          nagad: { number: '', isActive: false },
          rocket: { number: '', isActive: false },
        },
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/settings', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }); toast.success('Settings saved successfully'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to save settings'); },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <FadeIn direction="up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Site Settings</h1>

        <form noValidate onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
          {/* General */}
          <FadeIn direction="up" delay={0}>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">General</h2>
              <div className="space-y-3">
                <Field label="Site Name" value={form.siteName} onChange={(v) => setForm({ ...form, siteName: v })} />
                <Field label="Contact Email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} />
                <Field label="Contact Phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
                <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              </div>
            </section>
          </FadeIn>

          {/* Content */}
          <FadeIn direction="up" delay={0.1}>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Content</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">About Content</label>
                  <textarea value={form.aboutContent} onChange={(e) => setForm({ ...form, aboutContent: e.target.value })} rows={4}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Mission</label>
                  <textarea value={form.missionContent} onChange={(e) => setForm({ ...form, missionContent: e.target.value })} rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Vision</label>
                  <textarea value={form.visionContent} onChange={(e) => setForm({ ...form, visionContent: e.target.value })} rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Objectives</label>
                  <textarea value={form.objectivesContent} onChange={(e) => setForm({ ...form, objectivesContent: e.target.value })} rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">History</label>
                  <textarea value={form.historyContent} onChange={(e) => setForm({ ...form, historyContent: e.target.value })} rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
              </div>
            </section>
          </FadeIn>

          {/* Homepage Content */}
          <FadeIn direction="up" delay={0.15}>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Homepage Content</h2>
              <div className="space-y-3">
                <Field label="Founded Year" value={String(form.foundedYear)}
                  onChange={(v) => setForm({ ...form, foundedYear: parseInt(v) || 2021 })} />
                <Field label="Hero Badge Text" value={form.homePageContent.heroBadgeText}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, heroBadgeText: v } })} />
                <Field label="Hero Title (Line 1)" value={form.homePageContent.heroTitle}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, heroTitle: v } })} />
                <Field label="Hero Title Gradient (Line 2)" value={form.homePageContent.heroTitleGradient}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, heroTitleGradient: v } })} />
                <Field label="Hero Subtitle" value={form.homePageContent.heroSubtitle}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, heroSubtitle: v } })} />
                <Field label="Hero Tagline (before rotating words)" value={form.homePageContent.heroTagline}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, heroTagline: v } })} />
                <Field label="Rotating Words (comma-separated)" value={form.homePageContent.rotatingWords.join(', ')}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, rotatingWords: v.split(',').map(w => w.trim()).filter(Boolean) } })} />
                <Field label="Hero Image URL" value={form.homePageContent.heroImage}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, heroImage: v } })} />
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Intro / CTA Text</label>
                  <textarea value={form.homePageContent.introText} onChange={(e) => setForm({ ...form, homePageContent: { ...form.homePageContent, introText: e.target.value } })} rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <Field label="CTA Title (gradient text)" value={form.homePageContent.ctaTitle}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, ctaTitle: v } })} />
                <Field label="CTA Button Text" value={form.homePageContent.ctaButtonText}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, ctaButtonText: v } })} />
                <Field label="Features Heading" value={form.homePageContent.featuresHeading}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, featuresHeading: v } })} />
                <Field label="Features Subheading" value={form.homePageContent.featuresSubheading}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, featuresSubheading: v } })} />
                <Field label="Services Heading" value={form.homePageContent.servicesHeading}
                  onChange={(v) => setForm({ ...form, homePageContent: { ...form.homePageContent, servicesHeading: v } })} />

                {/* Features */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Features (What We Offer)</label>
                    <button type="button"
                      onClick={() => setForm({ ...form, homePageContent: { ...form.homePageContent, features: [...form.homePageContent.features, { title: '', description: '' }] } })}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20">
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  {form.homePageContent.features.map((f, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative mb-2">
                      <button type="button" onClick={() => { const features = form.homePageContent.features.filter((_, idx) => idx !== i); setForm({ ...form, homePageContent: { ...form.homePageContent, features } }); }}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <input value={f.title} placeholder="Title"
                        onChange={(e) => { const features = [...form.homePageContent.features]; features[i] = { ...features[i], title: e.target.value }; setForm({ ...form, homePageContent: { ...form.homePageContent, features } }); }}
                        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                      <textarea value={f.description} placeholder="Description" rows={2}
                        onChange={(e) => { const features = [...form.homePageContent.features]; features[i] = { ...features[i], description: e.target.value }; setForm({ ...form, homePageContent: { ...form.homePageContent, features } }); }}
                        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                    </motion.div>
                  ))}
                </div>

                {/* Services */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Services (Everything You Need)</label>
                    <button type="button"
                      onClick={() => setForm({ ...form, homePageContent: { ...form.homePageContent, services: [...form.homePageContent.services, { title: '', description: '', link: '' }] } })}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20">
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  {form.homePageContent.services.map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative mb-2">
                      <button type="button" onClick={() => { const services = form.homePageContent.services.filter((_, idx) => idx !== i); setForm({ ...form, homePageContent: { ...form.homePageContent, services } }); }}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <input value={s.title} placeholder="Title"
                        onChange={(e) => { const services = [...form.homePageContent.services]; services[i] = { ...services[i], title: e.target.value }; setForm({ ...form, homePageContent: { ...form.homePageContent, services } }); }}
                        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                      <textarea value={s.description} placeholder="Description" rows={2}
                        onChange={(e) => { const services = [...form.homePageContent.services]; services[i] = { ...services[i], description: e.target.value }; setForm({ ...form, homePageContent: { ...form.homePageContent, services } }); }}
                        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                      <input value={s.link} placeholder="Link (e.g. /blood-donors)"
                        onChange={(e) => { const services = [...form.homePageContent.services]; services[i] = { ...services[i], link: e.target.value }; setForm({ ...form, homePageContent: { ...form.homePageContent, services } }); }}
                        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          </FadeIn>

          {/* University Info */}
          <FadeIn direction="up" delay={0.18}>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">University Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Overview</label>
                  <textarea value={form.universityInfo.overview} onChange={(e) => setForm({ ...form, universityInfo: { ...form.universityInfo, overview: e.target.value } })} rows={4}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">History</label>
                  <textarea value={form.universityInfo.history} onChange={(e) => setForm({ ...form, universityInfo: { ...form.universityInfo, history: e.target.value } })} rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Campus Info</label>
                  <textarea value={form.universityInfo.campusInfo} onChange={(e) => setForm({ ...form, universityInfo: { ...form.universityInfo, campusInfo: e.target.value } })} rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Admission Info</label>
                  <textarea value={form.universityInfo.admissionInfo} onChange={(e) => setForm({ ...form, universityInfo: { ...form.universityInfo, admissionInfo: e.target.value } })} rows={3}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <Field label="Contact Info" value={form.universityInfo.contactInfo}
                  onChange={(v) => setForm({ ...form, universityInfo: { ...form.universityInfo, contactInfo: v } })} />
              </div>
            </section>
          </FadeIn>

          {/* FAQ */}
          <FadeIn direction="up" delay={0.22}>
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">FAQ Items</h2>
                <button type="button"
                  onClick={() => setForm({ ...form, faq: [...form.faq, { question: '', answer: '' }] })}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20">
                  <Plus className="h-3 w-3" /> Add FAQ
                </button>
              </div>
              <div className="space-y-3">
                {form.faq.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative">
                    <button type="button" onClick={() => setForm({ ...form, faq: form.faq.filter((_, idx) => idx !== i) })}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <input value={item.question} placeholder="Question"
                      onChange={(e) => { const faq = [...form.faq]; faq[i] = { ...faq[i], question: e.target.value }; setForm({ ...form, faq }); }}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                    <textarea value={item.answer} placeholder="Answer" rows={2}
                      onChange={(e) => { const faq = [...form.faq]; faq[i] = { ...faq[i], answer: e.target.value }; setForm({ ...form, faq }); }}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  </motion.div>
                ))}
                {form.faq.length === 0 && <p className="text-sm text-muted-foreground">No FAQ items. Click "Add FAQ" to create one.</p>}
              </div>
            </section>
          </FadeIn>

          {/* Privacy Policy */}
          <FadeIn direction="up" delay={0.26}>
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">Privacy Policy Sections</h2>
                <button type="button"
                  onClick={() => setForm({ ...form, privacyPolicy: [...form.privacyPolicy, { title: '', content: '' }] })}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20">
                  <Plus className="h-3 w-3" /> Add Section
                </button>
              </div>
              <div className="space-y-3">
                {form.privacyPolicy.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative">
                    <button type="button" onClick={() => setForm({ ...form, privacyPolicy: form.privacyPolicy.filter((_, idx) => idx !== i) })}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <input value={item.title} placeholder="Section Title"
                      onChange={(e) => { const pp = [...form.privacyPolicy]; pp[i] = { ...pp[i], title: e.target.value }; setForm({ ...form, privacyPolicy: pp }); }}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                    <textarea value={item.content} placeholder="Section Content" rows={3}
                      onChange={(e) => { const pp = [...form.privacyPolicy]; pp[i] = { ...pp[i], content: e.target.value }; setForm({ ...form, privacyPolicy: pp }); }}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  </motion.div>
                ))}
                {form.privacyPolicy.length === 0 && <p className="text-sm text-muted-foreground">No sections. Click "Add Section" to create one.</p>}
              </div>
            </section>
          </FadeIn>

          {/* Terms & Conditions */}
          <FadeIn direction="up" delay={0.3}>
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">Terms & Conditions Sections</h2>
                <button type="button"
                  onClick={() => setForm({ ...form, termsConditions: [...form.termsConditions, { title: '', content: '' }] })}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20">
                  <Plus className="h-3 w-3" /> Add Section
                </button>
              </div>
              <div className="space-y-3">
                {form.termsConditions.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border rounded-lg p-3 space-y-2 relative">
                    <button type="button" onClick={() => setForm({ ...form, termsConditions: form.termsConditions.filter((_, idx) => idx !== i) })}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <input value={item.title} placeholder="Section Title"
                      onChange={(e) => { const tc = [...form.termsConditions]; tc[i] = { ...tc[i], title: e.target.value }; setForm({ ...form, termsConditions: tc }); }}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                    <textarea value={item.content} placeholder="Section Content" rows={3}
                      onChange={(e) => { const tc = [...form.termsConditions]; tc[i] = { ...tc[i], content: e.target.value }; setForm({ ...form, termsConditions: tc }); }}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  </motion.div>
                ))}
                {form.termsConditions.length === 0 && <p className="text-sm text-muted-foreground">No sections. Click "Add Section" to create one.</p>}
              </div>
            </section>
          </FadeIn>

          {/* Social Links */}
          <FadeIn direction="up" delay={0.38}>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Social Links</h2>
              <div className="space-y-3">
                <Field label="Facebook" value={form.socialLinks.facebook}
                  onChange={(v) => setForm({ ...form, socialLinks: { ...form.socialLinks, facebook: v } })} />
                <Field label="YouTube" value={form.socialLinks.youtube}
                  onChange={(v) => setForm({ ...form, socialLinks: { ...form.socialLinks, youtube: v } })} />
                <Field label="LinkedIn" value={form.socialLinks.linkedin}
                  onChange={(v) => setForm({ ...form, socialLinks: { ...form.socialLinks, linkedin: v } })} />
              </div>
            </section>
          </FadeIn>

          {/* Payment Gateway */}
          <FadeIn direction="up" delay={0.45}>
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Payment Gateway</h2>
              {(['bkash', 'nagad', 'rocket'] as const).map((method) => (
                <div key={method} className="flex items-center gap-3 mb-3">
                  <label className="flex items-center gap-2 text-sm w-20 capitalize text-foreground">
                    <input type="checkbox" checked={form.paymentGateway[method]?.isActive || false}
                      onChange={(e) => setForm({
                        ...form,
                        paymentGateway: { ...form.paymentGateway, [method]: { ...form.paymentGateway[method], isActive: e.target.checked } },
                      })} />
                    {method}
                  </label>
                  <input placeholder="Number" value={form.paymentGateway[method]?.number || ''}
                    onChange={(e) => setForm({
                      ...form,
                      paymentGateway: { ...form.paymentGateway, [method]: { ...form.paymentGateway[method], number: e.target.value } },
                    })}
                    className="flex-1 px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
              ))}
            </section>
          </FadeIn>

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
        </form>
      </div>
    </FadeIn>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
    </div>
  );
}
