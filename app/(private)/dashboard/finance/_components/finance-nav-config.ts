import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  type IconProps,
  PieChart,
  CardReceive,
  Bill,
  ClockCircle,
  UsersGroupRounded,
  CardSend,
  Buildings2,
  Buildings,
  Wallet,
  CalendarMark,
  MoneyBag,
} from "@solar-icons/react";

type SolarIcon = ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>>;

export interface FinanceNavItem {
  name: string;
  href: string;
  icon: SolarIcon;
  /** Nested children render as an indented, collapsible group. */
  children?: FinanceNavItem[];
}

/**
 * Internal navigation for the Finance area (secondary sidebar).
 * All items currently gate on the same `finance-ar:view` permission, which is
 * already enforced once at `finance/layout.tsx` — so we don't re-check per item.
 */
export const FINANCE_NAV: FinanceNavItem[] = [
  {
    name: "Overview",
    href: "/dashboard/finance",
    icon: PieChart,
  },
  {
    name: "Accounts Receivable",
    href: "/dashboard/finance/accounts-receivable",
    icon: CardReceive,
    children: [
      { name: "Termin", href: "/dashboard/finance/accounts-receivable/termin", icon: Bill },
      { name: "Aging", href: "/dashboard/finance/accounts-receivable/aging", icon: ClockCircle },
      { name: "Client", href: "/dashboard/finance/accounts-receivable/client", icon: UsersGroupRounded },
    ],
  },
  {
    name: "Accounts Payable",
    href: "/dashboard/finance/accounts-payable",
    icon: CardSend,
    children: [
      { name: "Outstanding", href: "/dashboard/finance/accounts-payable/outstanding", icon: Wallet },
      { name: "Event", href: "/dashboard/finance/accounts-payable/event", icon: CalendarMark },
      { name: "Expense", href: "/dashboard/finance/accounts-payable/expense", icon: MoneyBag },
      { name: "Rekening Vendor", href: "/dashboard/finance/accounts-payable/rekening-vendor", icon: Buildings2 },
      { name: "Rekening Venue", href: "/dashboard/finance/accounts-payable/rekening-venue", icon: Buildings },
    ],
  },
];
