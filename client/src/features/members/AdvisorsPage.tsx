import MemberDirectoryPage from './MemberDirectoryPage';

export default function AdvisorsPage() {
  return (
    <MemberDirectoryPage
      title="Honorable Advisors"
      description="RDSWA Advisors at the University of Barishal — former committee leaders and appointed advisors guiding the Rangpur Divisional Student Welfare Association. RDSWA উপদেষ্টাবৃন্দ।"
      flagFilter="isAdvisor"
      emptyLabel="advisors"
    />
  );
}
