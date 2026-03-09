import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Heart, Loader2, Phone, MapPin } from 'lucide-react';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodDonorsPage() {
  const [bloodGroup, setBloodGroup] = useState('');
  const [district, setDistrict] = useState('');

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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="h-8 w-8 text-red-500" />
        <div>
          <h1 className="text-3xl font-bold">Blood Donors</h1>
          <p className="text-muted-foreground">Find blood donors from our community</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
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
          <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Rangpur"
            className="px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : donors.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No donors found with the selected criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {donors.map((d: any) => (
            <div key={d._id} className="border rounded-lg p-4 bg-background">
              <div className="flex items-center gap-3 mb-3">
                {d.avatar ? (
                  <img src={d.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 font-bold text-sm">
                    {d.bloodGroup}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">{d.name}</p>
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
                  <p className="text-xs">Last donated: {new Date(d.lastDonationDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
