"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useShellMeta } from "@/components/shell-meta";

type Props = {
  title: string;
  subtitle?: string;
};

export function PageMeta({ title, subtitle }: Props) {
  const { setMeta } = useShellMeta();
  const pathname = usePathname();

  useLayoutEffect(() => {
    setMeta({ title, subtitle, path: pathname ?? "" });
  }, [title, subtitle, pathname, setMeta]);

  return null;
}
