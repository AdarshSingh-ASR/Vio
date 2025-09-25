import React from "react";
import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";
type Props = {
  state: boolean;
  className?: string;
  children: React.ReactNode;
  color?: string;
};

export const Loader = ({ state, className, children, color }: Props) => {
  return state ? (
    <div className={cn(className)}>
      <Spinner color={color} />
    </div>
  ) : (
    <>{children}</>
  );
};
