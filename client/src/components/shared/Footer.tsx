import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-bold text-primary mb-3">RDSWA</h3>
            <p className="text-sm text-muted-foreground">
              Rangpur Divisional Student Welfare Association, Barishal University.
              Connecting students from Rangpur Division.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground">About Us</Link></li>
              <li><Link to="/committee" className="hover:text-foreground">Committee</Link></li>
              <li><Link to="/events" className="hover:text-foreground">Events</Link></li>
              <li><Link to="/notices" className="hover:text-foreground">Notices</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/bus-schedule" className="hover:text-foreground">Bus Schedule</Link></li>
              <li><Link to="/gallery" className="hover:text-foreground">Gallery</Link></li>
              <li><Link to="/donations" className="hover:text-foreground">Donations</Link></li>
              <li><Link to="/documents" className="hover:text-foreground">Documents</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Barishal University Campus</li>
              <li>Barishal, Bangladesh</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} RDSWA. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
