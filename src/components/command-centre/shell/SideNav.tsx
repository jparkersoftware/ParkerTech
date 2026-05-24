import { NavLink } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';

const NAV_ITEMS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/clients', label: 'Clients', icon: 'users' },
  { to: '/projects', label: 'Projects', icon: 'briefcase' },
  { to: '/quotes', label: 'Quotes', icon: 'pound' },
  { to: '/invoices', label: 'Invoices', icon: 'receipt' },
  { to: '/expenses', label: 'Expenses', icon: 'wallet' },
  { to: '/correspondence', label: 'Correspondence', icon: 'message' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
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
          <Icon name={item.icon} className="cc-nav-icon" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
