import { LayoutDashboard, Plus, FileText, Sun, Moon, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "New Project", url: "/upload", icon: Plus },
  { title: "Templates", url: "/templates", icon: FileText },
];

export function AppSidebar() {
  const { theme, setTheme } = useTheme();

  return (
    <Sidebar className="w-16 hover:w-64 transition-all duration-300 group" collapsible="none">
      <SidebarContent>
        <NavLink to="/" className="p-4 flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-bold text-lg">DC</span>
          </div>
          <span className="text-xl font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
            DeepCopy
          </span>
        </NavLink>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      }
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                        {item.title}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  D
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                  Account
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 flex-shrink-0" />
              ) : (
                <Moon className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                Theme
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton>
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                Logout
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
