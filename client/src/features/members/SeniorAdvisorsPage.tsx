import MemberDirectoryPage from './MemberDirectoryPage';

export default function SeniorAdvisorsPage() {
  return (
    <MemberDirectoryPage
      title="Senior Advisors"
      description="Browse RDSWA senior advisors — senior mentors appointed by the administration."
      flagFilter="isSeniorAdvisor"
      emptyLabel="senior advisors"
    />
  );
}
