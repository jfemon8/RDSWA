import MemberDirectoryPage from './MemberDirectoryPage';

export default function AlumniPage() {
  return (
    <MemberDirectoryPage
      title="Honorable Alumnis"
      description="Browse RDSWA alumni — graduates from Rangpur Division at University of Barishal."
      flagFilter="isAlumni"
      emptyLabel="alumni"
    />
  );
}
