import type { Metadata } from "next";
import { DemoDashboard } from "@/components/demo/DemoDashboard";

export const metadata: Metadata = {
  title: "Demo dashboard — SmartBooking",
};

export default function DemoPage() {
  return <DemoDashboard />;
}
