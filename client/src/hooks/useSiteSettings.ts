import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export interface SiteSettings {
  siteName: string;
  siteNameFull?: string;
  siteNameBn?: string;
  siteNameBnFull?: string;
  logo?: string;
  logoDark?: string;
  footerLogo?: string;
  footerLogoDark?: string;
  favicon?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  brandColors?: {
    lightPrimary?: string;
    lightSecondary?: string;
    darkPrimary?: string;
    darkSecondary?: string;
  };
  socialLinks?: {
    facebook?: string;
    youtube?: string;
    linkedin?: string;
    twitter?: string;
    androidApp?: string;
    iosApp?: string;
    windowsApp?: string;
    macosApp?: string;
    linuxApp?: string;
  };
  universityInfo?: {
    name?: string;
    logo?: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
  };
  [key: string]: any;
}

export function useSiteSettings() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return { settings: (data?.data || null) as SiteSettings | null, isLoading };
}
