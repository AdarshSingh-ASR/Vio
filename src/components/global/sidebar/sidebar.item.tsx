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
        "flex flex-row items-center gap-2 px-3 py-1.5 rounded-md transition-colors duration-150",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group",
        selected ? "text-primary bg-sidebar-accent/50" : "text-sidebar-foreground",
        isNote && "pl-6",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center w-5 h-5 transition-colors duration-150 flex-shrink-0",
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
