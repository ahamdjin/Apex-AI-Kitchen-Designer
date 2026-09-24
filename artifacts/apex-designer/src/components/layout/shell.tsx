import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Ruler, Archive, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Designer", icon: Ruler },
    { href: "/catalog", label: "Catalog", icon: Archive },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center font-bold text-lg font-mono">
            A
          </div>
          <span className="font-semibold text-lg tracking-tight">Apex Kitchens</span>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          className="md:hidden p-2 -mr-2 text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden border-b bg-card">
          <nav className="flex flex-col p-4 gap-4">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 text-base font-medium p-2",
                    isActive ? "text-primary bg-primary/5" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
