import Link from "next/link";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  title: string;
  href: string;
  icon?: React.ReactNode;
  selected?: boolean;
  isNote?: boolean;
  className?: string;
}

export const SidebarItem = ({
  title,
  href,
  icon,
  selected = false,
  isNote = false,
  className,
}: SidebarItemProps) => {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "flex min-h-9 items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors duration-150",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group",
        selected ? "text-primary bg-sidebar-accent/50" : "text-sidebar-foreground",
        isNote && "pl-6",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-150",
            selected ? "text-primary" : "text-sidebar-foreground",
            "group-hover:text-sidebar-accent-foreground"
          )}
        >
          {icon}
        </div>
      )}
      <span
        className={cn(
          "text-sm transition-colors duration-150 truncate",
          selected ? "text-primary font-medium" : "text-sidebar-foreground",
          "group-hover:text-sidebar-accent-foreground"
        )}
      >
        {title}
      </span>
    </Link>
  );
};
