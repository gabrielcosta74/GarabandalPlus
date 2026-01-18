"use client";

import { cn } from "../../lib/utils";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface MembershipModalTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    className?: string;
}

export default function MembershipModalTrigger({ children, className, ...props }: MembershipModalTriggerProps) {
    return (
        <button
            className={cn("cursor-pointer", className)}
            {...props}
        >
            {children}
        </button>
    );
}
