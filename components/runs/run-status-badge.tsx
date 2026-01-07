import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Clock, Ban } from "lucide-react";

interface RunStatusBadgeProps {
  status: string;
}

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const config: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline";
      icon: React.ReactNode;
      label: string;
    }
  > = {
    QUEUED: {
      variant: "outline",
      icon: <Clock className="h-3 w-3 mr-1" />,
      label: "Queued",
    },
    RUNNING: {
      variant: "secondary",
      icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />,
      label: "Running",
    },
    SUCCEEDED: {
      variant: "default",
      icon: <CheckCircle className="h-3 w-3 mr-1" />,
      label: "Succeeded",
    },
    FAILED: {
      variant: "destructive",
      icon: <XCircle className="h-3 w-3 mr-1" />,
      label: "Failed",
    },
    CANCELLED: {
      variant: "outline",
      icon: <Ban className="h-3 w-3 mr-1" />,
      label: "Cancelled",
    },
  };

  const { variant, icon, label } = config[status] || config.QUEUED;

  return (
    <Badge variant={variant} className="text-xs">
      {icon}
      {label}
    </Badge>
  );
}
