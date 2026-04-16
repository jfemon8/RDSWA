import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Droplets, Phone, MapPin, User } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import { districts } from '@/data/bdGeo';
import SEO from '@/components/SEO';
import Spinner from '@/components/ui/Spinner';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodDonorsPage() {
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');

  const allDistricts = useMemo(() => {
    const all = Object.values(districts).flat();
    return [...new Set(all)].sort((a, b) => a.localeCompare(b));
  }, []);

  const filters: Record<string, string> = {};
  if (bloodGroup) filters.bloodGroup = bloodGroup;
  if (district) filters.district = district;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.bloodDonors(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/users/blood-donors?${params}`);
      return data;
    },
  });

  const donors = data?.data || [];

  return (
    <div className="container mx-auto py-8">
      <SEO title="Blood Donors" description="Find blood donors from the RDSWA community — search by blood group and district." />
      <div className="flex items-center gap-3 mb-6">
        <FadeIn delay={0} direction="left">
          <Droplets className="h-8 w-8 text-red-500" />
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
            <p className="text-muted-foreground">Find blood donors from our community</p>
          </FadeIn>
        </div>
      </div>

      {/* Filters */}
      <FadeIn delay={0.2} direction="up">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Blood Group</label>
            <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="">All Groups</option>
              {bloodGroups.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">District</label>
            <select value={district} onChange={(e) => setDistrict(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="">All Districts</option>
              {allDistricts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </FadeIn>

      {isLoading ? (
        <Spinner size="md" />
      ) : donors.length === 0 ? (
        <FadeIn delay={0.1} direction="up">
          <div className="text-center py-12">
            <Droplets className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No donors found with the selected criteria</p>
          </div>
        </FadeIn>
      ) : (
        <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {donors.map((d: any, index: number) => (
            <FadeIn key={d._id} delay={0.05 * index} direction="up">
              <div
                className="border rounded-lg p-4 bg-card"
              >
                <div className="flex items-center gap-3 mb-3">
                  {d.avatar ? (
                    <img src={d.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 font-bold text-sm">
                      {d.bloodGroup}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-primary shrink-0" /> {d.name}
                    </p>
                    <span className="inline-block px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                      {d.bloodGroup}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {d.homeDistrict && (
                    <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {d.homeDistrict}</p>
                  )}
                  {d.phone && (
                    <p className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      <a href={`tel:${d.phone}`} className="text-primary hover:underline">{d.phone}</a>
                    </p>
                  )}
                  {d.lastDonationDate && (
                    <p className="text-xs">Last donated: {formatDate(d.lastDonationDate)}</p>
                  )}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
