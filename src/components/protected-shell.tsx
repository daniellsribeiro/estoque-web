"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

type MenuItem = { label: string; href: string; icon: LucideIcon };

export function ProtectedShell({ title, subtitle, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let canceled = false;
    const validate = async () => {
      try {
        const profile = await apiFetch<{ name?: string }>("/auth/me");
        if (!canceled) setUserName(profile?.name ?? null);
      } catch {
        if (!canceled) router.replace("/login");
      } finally {
        if (!canceled) setCheckingAuth(false);
      }
    };
    void validate();
    return () => {
      canceled = true;
    };
  }, [router]);

  useEffect(() => {
    const handleUnauthorized = () => router.replace("/login");
    window.addEventListener("api-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("api-unauthorized", handleUnauthorized);
  }, [router]);

  const menu = useMemo<MenuItem[]>(
    () => [
      { label: "Dashboard", href: "/painel", icon: LayoutDashboard },
      { label: "Produtos", href: "/produtos", icon: Package },
      { label: "Estoque", href: "/estoque", icon: Boxes },
      { label: "Compras", href: "/compras", icon: ShoppingCart },
      { label: "Gastos", href: "/gastos", icon: Receipt },
      { label: "Vendas", href: "/vendas", icon: ShoppingBag },
      { label: "Clientes", href: "/clientes", icon: Users },
      { label: "Fornecedores", href: "/fornecedores", icon: Truck },
      { label: "Cart\u00f5es", href: "/pagamentos", icon: CreditCard },
      { label: "Configura\u00e7\u00f5es", href: "/config", icon: Settings },
    ],
    [],
  );

  const handleLogout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
    }
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div
            className="
              flex items-center gap-2 px-2 pr-12
              group-data-[state=collapsed]/sidebar:px-0
              group-data-[state=collapsed]/sidebar:pr-0
              group-data-[state=collapsed]/sidebar:justify-center
            "
          >
            {/* Logo completo quando expandido */}
            <Image
              src="/images/logo-heluzza.png"
              alt="Heluzza Acessorios"
              width={160}
              height={48}
              className="h-10 w-auto object-contain group-data-[state=collapsed]/sidebar:hidden"
              priority
            />
            {/* Versão enxuta quando colapsado */}
            <Image
              src="/images/h-transparente.png"
              alt="Heluzza Acessorios"
              width={48}
              height={48}
              className="hidden h-8 w-8 object-contain group-data-[state=collapsed]/sidebar:block"
              priority
            />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegacao</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menu.map((item) => {
                  const active = pathname?.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link href={item.href} title={item.label} aria-current={active ? "page" : undefined}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {userName && (
            <div className="px-2 pb-1 text-xs text-sidebar-foreground/70 group-data-[state=collapsed]/sidebar:hidden">
              Ola, {userName}
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}




