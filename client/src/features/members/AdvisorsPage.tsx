import MemberDirectoryPage from './MemberDirectoryPage';

export default function AdvisorsPage() {
  return (
    <MemberDirectoryPage
      title="Advisors"
      description="Browse RDSWA advisors — ex-committee leaders and appointed advisors."
      flagFilter="isAdvisor"
      emptyLabel="advisors"
    />
  );
}
