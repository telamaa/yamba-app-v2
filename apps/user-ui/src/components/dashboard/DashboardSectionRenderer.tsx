"use client";



import {SectionKey} from "@/app/[locale]/dashboard/dashboard.config";
import {DashboardCopy} from "@/app/[locale]/dashboard/dashboard.copy";
import MyTrips from "@/components/dashboard/sections/MyTrips";
import MyShipments from "@/components/dashboard/sections/MyShipments";
import CreateTrip from "@/components/dashboard/sections/CreateTrip";
import Messages from "@/components/dashboard/sections/Messages";
import Notifications from "@/components/dashboard/sections/Notifications";
import Payments from "@/components/dashboard/sections/Payments";
import WalletSection from "@/components/dashboard/sections/WalletSection";
import BecomeYamber from "@/components/dashboard/sections/BecomeYamber";
import Profile from "@/components/dashboard/sections/Profile";
import Security from "@/components/dashboard/sections/Security";
import SettingsSection from "@/components/dashboard/sections/SettingsSection";
import Help from "@/components/dashboard/sections/Help";
import HomeSection from "@/components/dashboard/sections/Home";

type Props = {
  section: SectionKey;
  copy: DashboardCopy;
  isFr: boolean;
};

export default function DashboardSectionRenderer({ section, copy, isFr }: Props) {
  switch (section) {
    case "home":
      return <HomeSection copy={copy} />;
    case "trips":
      return <MyTrips copy={copy} />;
    case "shipments":
      return <MyShipments copy={copy} />;
    case "create":
      return <CreateTrip copy={copy} />;
    case "messages":
      return <Messages copy={copy} />;
    case "notifications":
      return <Notifications copy={copy} />;
    case "payments":
      return <Payments copy={copy} />;
    case "wallet":
      return <WalletSection copy={copy} />;
    case "profile":
      return <Profile copy={copy} />;
    case "yamber":
      return <BecomeYamber copy={copy} />;
    case "security":
      return <Security copy={copy} />;
    case "settings":
      return <SettingsSection copy={copy} />;
    case "help":
      return <Help copy={copy} isFr={isFr} />;
    default:
      return <HomeSection copy={copy} />;
  }
}
