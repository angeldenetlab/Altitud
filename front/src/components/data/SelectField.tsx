"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SelectItemOption,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Atajo sobre el Select compuesto: se usa mucho en los filtros y formularios.
 */
export function SelectField({
  value,
  onChange,
  items,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  items: SelectItemOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(String(next ?? ""))}
      items={items}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
