import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/inbox', label: 'Inbox' },
  { to: '/clients', label: 'Clients' },
  { to: '/projects', label: 'Projects' },
  { to: '/quotes', label: 'Quotes' },
  { to: '/correspondence', label: 'Correspondence' },
  { to: '/settings', label: 'Settings' },
];

export default function SideNav() {
  return (
    <nav className="flex flex-col gap-1 p-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            ['cc-nav-link', isActive ? 'is-active' : ''].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
