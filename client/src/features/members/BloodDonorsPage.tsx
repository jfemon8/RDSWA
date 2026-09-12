import { useState, useEffect } from 'react';
import { CardListSkeleton } from '@/components/ui/Skeleton';
import { MAX_GC_TIME } from '@/lib/queryPersister';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useIsRestoring } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Droplets, Phone, MapPin, User, X, UserPlus, Filter } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import DistrictPicker from '@/components/ui/DistrictPicker';
import SEO from '@/components/SEO';
import EmptyState from '@/components/ui/EmptyState';
import Promo from '@/components/promo/Promo';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Offline-persistence options mirroring BusSchedulePage, where `networkMode: 'offlineFirst'` lets Workbox answer on cold offline launches. */
const DONORS_OFFLINE_OPTS = {
  meta: { persist: true } as const,
  gcTime: MAX_GC_TIME,
  staleTime: 60 * 60 * 1000,
  refetchOnReconnect: true as const,
  networkMode: 'offlineFirst' as const,
};

export default function BloodDonorsPage() {
  const [bloodGroup, setBloodGroup] = useState('');
  const [presentDistrict, setPresentDistrict] = useState('');
  const prefetchClient = useQueryClient();
  const isRestoring = useIsRestoring();

  const filters: Record<string, string> = {};
  if (bloodGroup) filters.bloodGroup = bloodGroup;
  if (presentDistrict) filters.presentDistrict = presentDistrict;

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: queryKeys.users.bloodDonors(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/users/blood-donors?${params}`);
      return data;
    },
    ...DONORS_OFFLINE_OPTS,
  });

  // True while the persister restores from IndexedDB, so no skeleton flashes over data about to arrive.
  const isLoading = queryLoading && !isRestoring && !data;

  // The unfiltered list and each blood group are warmed on the first visit, while the 512 district combinations are left to fill in as they are used.
  useEffect(() => {
    const warm = (key: readonly unknown[], url: string) =>
      prefetchClient.prefetchQuery({
        queryKey: [...key],
        queryFn: async () => (await api.get(url)).data,
        ...DONORS_OFFLINE_OPTS,
      }).catch(() => { /* ignore */ });

    warm(queryKeys.users.bloodDonors({}), '/users/blood-donors?');
    for (const bg of bloodGroups) {
      warm(queryKeys.users.bloodDonors({ bloodGroup: bg }), `/users/blood-donors?bloodGroup=${encodeURIComponent(bg)}`);
    }
  }, [prefetchClient]);

  const donors = data?.data || [];
  const clearFilters = () => { setBloodGroup(''); setPresentDistrict(''); };
  const hasFilters = !!bloodGroup || !!presentDistrict;

  return (
    <div className="container mx-auto py-8">
      <SEO
        title="Blood Donor List: University of Barishal Rangpur Students"
        description="Find verified blood donors from RDSWA: students of University of Barishal from Rangpur Division. Filter by blood group (A+, A−, B+, B−, AB+, AB−, O+, O−) and district. Direct contact for emergency blood needs in Barishal, Rangpur, Dhaka and across Bangladesh."
        keywords="blood donor list Bangladesh, blood donor Barishal, blood donor Rangpur, BU blood donor, ববি ব্লাড ডোনার, রক্তদাতা, emergency blood Bangladesh, A+ blood donor, B+ blood donor, O+ blood donor, RDSWA blood, University of Barishal blood donor"
      />

      <div className="flex items-center gap-3 mb-6">
        <FadeIn delay={0} direction="left">
          <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <Droplets className="h-6 w-6 text-red-500" />
          </div>
        </FadeIn>
        <div>
          <BlurText
            text="Blood Donors"
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-0"
            delay={80}
            animateBy="words"
            direction="bottom"
          />
          <FadeIn delay={0.3} direction="up">
            <p className="text-muted-foreground text-sm sm:text-base">Find blood donors from our community</p>
          </FadeIn>
        </div>
      </div>

      <FadeIn delay={0.2} direction="up">
        <div className="mb-6 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="h-4 w-4 text-primary" /> Filters
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Blood Group</label>
              <div className="relative">
                <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 border rounded-lg bg-background text-sm text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all hover:border-primary/50 cursor-pointer"
                >
                  <option value="">All Groups</option>
                  {bloodGroups.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
                <ChevronIcon />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Present District</label>
              <DistrictPicker value={presentDistrict} onChange={setPresentDistrict} />
            </div>
          </div>
        </div>
      </FadeIn>

      {isLoading ? (
        <CardListSkeleton />
      ) : donors.length === 0 ? (
        <EmptyState
          icon={Droplets}
          title="No Donors Found"
          description={hasFilters
            ? 'No blood donors match your filters. Try a different blood group or district, or clear filters to see all donors.'
            : 'No blood donors are listed yet. Anyone with an account can mark themselves as a donor from their profile to appear here.'}
          primary={hasFilters
            ? { label: 'Clear Filters', icon: X, onClick: clearFilters }
            : { label: 'Become a Donor', icon: UserPlus, to: '/dashboard/profile/edit' }}
          hint="Enable “Available as Blood Donor” on your profile to help someone in an emergency."
        />
      ) : (
        <div className="grid grid-equal grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {donors.map((d: any, index: number) => (
            <FadeIn key={d._id} delay={0.05 * index} direction="up">
              <div className="border rounded-xl p-4 bg-card h-full flex flex-col hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  {d.avatar ? (
                    <img src={d.avatar} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                      {d.bloodGroup}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/members/${d._id}`}
                      className="font-medium truncate flex items-center gap-1 text-foreground hover:text-primary hover:underline transition-colors"
                    >
                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{d.name}</span>
                    </Link>
                    <span className="inline-block px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded mt-0.5">
                      {d.bloodGroup}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    {(d.presentAddress?.district || d.presentAddress?.division) && (
                      <div className="flex items-start gap-1.5 min-w-0 flex-1">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Current Location</p>
                          <p className="text-foreground/90 truncate">
                            {[d.presentAddress?.district, d.presentAddress?.division].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>
                    )}
                    {d.phone && (
                      <div className="flex items-start gap-1.5 shrink-0">
                        <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Phone</p>
                          <a href={`tel:${d.phone}`} className="text-primary hover:underline whitespace-nowrap">{d.phone}</a>
                        </div>
                      </div>
                    )}
                  </div>
                  {d.lastDonationDate && (
                    <p className="text-xs pt-2 mt-2 border-t">Last donated: {formatDate(d.lastDonationDate)}</p>
                  )}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}

      {/* Bottom-only multiplex, keeping this health-emergency lookup promo-free until the reader has already seen the donor list. */}
      {donors.length > 0 && (
        <div className="mt-10 empty:hidden">
          <Promo kind="multiplex" minHeight={300} />
        </div>
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
      fill="none"
      viewBox="0 0 20 20"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
    </svg>
  );
}
