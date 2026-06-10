/**
 * Bottom tab bar for phones. The sidebar is hidden below the md breakpoint,
 * which previously left mobile with no navigation at all. All sections fit
 * via horizontal scroll; safe-area padding keeps it clear of the iPhone
 * home indicator when installed as a PWA.
 */
import { NavLink } from 'react-router-dom';
import Icon from '../components/Icon';
import { NAV_ITEMS } from './SideNav';

export default function MobileNav() {
  return (
    <nav className="cc-mobile-nav md:hidden" aria-label="Sections">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            ['cc-mobile-nav-link', isActive ? 'is-active' : ''].join(' ')
          }
        >
          <Icon name={item.icon} className="cc-mobile-nav-icon" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
