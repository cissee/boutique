import type { ComponentType, SVGProps } from "react";
import {
  ChartIcon,
  ClockIcon,
  HomeIcon,
  MenuIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import type { Messages } from "@/i18n";

export type NavKey = keyof Messages["nav"];

export type NavItem = {
  href: string;
  labelKey: NavKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const dashboardItem: NavItem = { href: "/dashboard", labelKey: "dashboard", icon: HomeIcon };
export const customersItem: NavItem = { href: "/customers", labelKey: "customers", icon: UsersIcon };
export const addDebtItem: NavItem = { href: "/debts/new", labelKey: "addDebt", icon: PlusIcon };
export const repaymentsItem: NavItem = { href: "/repayments/new", labelKey: "repayments", icon: WalletIcon };
export const historyItem: NavItem = { href: "/history", labelKey: "history", icon: ClockIcon };
export const reportsItem: NavItem = { href: "/reports", labelKey: "reports", icon: ChartIcon };
export const settingsItem: NavItem = { href: "/settings", labelKey: "settings", icon: SettingsIcon };
export const moreItem: NavItem = { href: "/more", labelKey: "more", icon: MenuIcon };

/** Barre latérale (écrans larges) : toutes les sections. */
export const sideNavItems: NavItem[] = [
  dashboardItem,
  customersItem,
  repaymentsItem,
  historyItem,
  reportsItem,
  settingsItem,
];

/** Sections regroupées sous « Plus » sur mobile. */
export const moreNavItems: NavItem[] = [historyItem, reportsItem, settingsItem];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
