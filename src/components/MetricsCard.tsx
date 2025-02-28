import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string;
  change?: {
    value: string;
    percentage: string;
    isPositive: boolean;
  };
  className?: string;
}

export function MetricsCard({ title, value, change, className }: MetricsCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex flex-col space-y-1.5">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-semibold">{value}</p>
            {change && (
              <div className={cn(
                "flex items-center text-xs font-medium",
                change.isPositive ? "text-green-500" : "text-red-500"
              )}>
                <span className="flex items-center">
                  {change.isPositive ? (
                    <ArrowUpIcon className="mr-1 h-3 w-3" />
                  ) : (
                    <ArrowDownIcon className="mr-1 h-3 w-3" />
                  )}
                  {change.value}
                </span>
                <span className="ml-1 text-muted-foreground">({change.percentage})</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 