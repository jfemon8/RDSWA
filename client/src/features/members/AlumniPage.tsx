import MemberDirectoryPage from './MemberDirectoryPage';

export default function AlumniPage() {
  return (
    <MemberDirectoryPage
      title="Alumni"
      description="Browse RDSWA alumni — graduates from Rangpur Division at University of Barishal."
      flagFilter="isAlumni"
      emptyLabel="alumni"
    />
  );
}
