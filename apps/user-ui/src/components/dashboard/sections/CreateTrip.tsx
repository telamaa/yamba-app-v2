"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {DashboardCopy} from "@/app/dashboard/dashboard.copy";
import SectionHeader from "@/components/dashboard/SectionHeader";
import {EmptyState} from "@/components/dashboard/DashboardUI";


export default function CreateTrip({ copy }: { copy: DashboardCopy }) {
  const router = useRouter();

  return (
    <>
      <SectionHeader title={copy.create.title} subtitle={copy.create.sub} />
      <EmptyState
        icon={Plus}
        title={copy.newTrip}
        description={copy.newTripDesc}
        actionLabel={copy.createTrip}
        onAction={() => router.push("/trips/create")}
      />
    </>
  );
}
