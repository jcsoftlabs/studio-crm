import { Role } from '@prisma/client';
import {
  BarChart3,
  CalendarDays,
  Heart,
  Home,
  Package,
  Settings,
  Scissors,
  Users,
  UserRound,
  Wallet,
} from 'lucide-react';

const ALL: Role[] = [Role.OWNER, Role.RECEPTION, Role.STYLIST];

export const NAV_ITEMS = [
  { key: 'dashboard', href: '/', icon: Home, roles: ALL, primary: true },
  { key: 'agenda', href: '/agenda', icon: CalendarDays, roles: ALL, primary: true },
  { key: 'clients', href: '/clients', icon: Users, roles: ALL, primary: true },
  { key: 'caisse', href: '/caisse', icon: Wallet, roles: [Role.OWNER, Role.RECEPTION], primary: true },
  { key: 'services', href: '/services', icon: Scissors, roles: [Role.OWNER, Role.RECEPTION], primary: false },
  { key: 'stock', href: '/stock', icon: Package, roles: [Role.OWNER, Role.RECEPTION], primary: false },
  { key: 'fidelite', href: '/fidelite', icon: Heart, roles: [Role.OWNER, Role.RECEPTION], primary: false },
  { key: 'staff', href: '/staff', icon: UserRound, roles: [Role.OWNER], primary: false },
  { key: 'rapports', href: '/rapports', icon: BarChart3, roles: [Role.OWNER], primary: false },
  { key: 'parametres', href: '/parametres', icon: Settings, roles: [Role.OWNER], primary: false },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => (item.roles as readonly Role[]).includes(role));
}
