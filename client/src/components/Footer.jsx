import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <Link to="/" className="brand">
          <img src="/logos/atlas-agency-horizontal.png" alt="Atlas Agency" height="48" />
        </Link>
        <p style={{ margin: 0 }}>
          Mobilização digital com cuidado, clareza e presença territorial.
        </p>
      </div>
    </footer>
  );
}
