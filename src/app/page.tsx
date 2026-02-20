"use client";

import { useEffect } from "react";
import { getSession } from "@/lib/auth";

export default function Home() {
  useEffect(() => {
    const s = getSession();
    window.location.href = s ? "/dashboard" : "/login";
  }, []);

  return null;
}