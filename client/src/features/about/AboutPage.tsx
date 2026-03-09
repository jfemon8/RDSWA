import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Users, Target, Eye, BookOpen } from 'lucide-react';

export default function AboutPage() {
  const { data } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });

  const settings = data?.data;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">About RDSWA</h1>

      {settings?.aboutContent ? (
        <div className="prose dark:prose-invert max-w-none mb-12" dangerouslySetInnerHTML={{ __html: settings.aboutContent }} />
      ) : (
        <p className="text-muted-foreground mb-12">
          Rangpur Divisional Student Welfare Association (RDSWA) is a student welfare organization at Barishal University,
          dedicated to supporting students from the Rangpur Division.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <InfoCard
          icon={<Target className="h-6 w-6" />}
          title="Our Mission"
          content={settings?.missionContent || 'To promote welfare, unity, and academic excellence among students from Rangpur Division studying at Barishal University.'}
        />
        <InfoCard
          icon={<Eye className="h-6 w-6" />}
          title="Our Vision"
          content={settings?.visionContent || 'A connected community where every student from Rangpur Division thrives academically, professionally, and socially.'}
        />
        <InfoCard
          icon={<BookOpen className="h-6 w-6" />}
          title="Objectives"
          content={settings?.objectivesContent || 'Foster brotherhood, organize cultural and educational events, provide academic support, and build a strong alumni network.'}
        />
        <InfoCard
          icon={<Users className="h-6 w-6" />}
          title="History"
          content={settings?.historyContent || 'Founded by students from Rangpur Division to create a supportive community and preserve regional culture at Barishal University.'}
        />
      </div>

      {settings?.contactEmail && (
        <div className="border rounded-lg p-6 bg-background">
          <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            {settings.contactEmail && <p>Email: <a href={`mailto:${settings.contactEmail}`} className="text-primary hover:underline">{settings.contactEmail}</a></p>}
            {settings.contactPhone && <p>Phone: {settings.contactPhone}</p>}
            {settings.address && <p>Address: {settings.address}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, title, content }: { icon: React.ReactNode; title: string; content: string }) {
  return (
    <div className="border rounded-lg p-6 bg-background">
      <div className="flex items-center gap-3 mb-3 text-primary">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{content}</p>
    </div>
  );
}
