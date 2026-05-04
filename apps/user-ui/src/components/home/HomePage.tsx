"use client";

import HeroSection from "@/components/home/HeroSection";
import PillarsSection from "@/components/home/PillarsSection";
import LiveMapSection from "@/components/home/LiveMapSection";
import JourneySection from "@/components/home/JourneySection";
import PricingSection from "@/components/home/PricingSection";
import ReviewsTickerSection from "@/components/home/ReviewsTickerSection";
import FinalCtaSection from "@/components/home/FinalCtaSection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <PillarsSection />
      <LiveMapSection />
      <JourneySection />
      <PricingSection />
      <ReviewsTickerSection />
      <FinalCtaSection />
    </>
  );
}
