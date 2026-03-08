"use client";

import { useEffect, useState } from "react";
import Header from "./Header";
import HeaderSkeleton from "./HeaderSkeleton";

export default function AppHeader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 900);

    return () => clearTimeout(timer);
  }, []);

  return loading ? <HeaderSkeleton /> : <Header />;
}
