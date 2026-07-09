import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const normalized = status === "pending_approval" ? "scheduled" : status;

  const getStatusColor = () => {
    switch (normalized) {
      case "scheduled":
        return "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20";
      case "qa_received":
        return "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20";
      case "in_development":
        return "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20";
      case "approved":
        return "bg-green-500/10 text-green-700 hover:bg-green-500/20";
      case "rejected":
        return "bg-red-500/10 text-red-700 hover:bg-red-500/20";
      case "converted_to_production":
        return "bg-purple-500/10 text-purple-700 hover:bg-purple-500/20";
      case "in_progress":
        return "bg-gray-500/10 text-gray-700 hover:bg-gray-500/20";
      case "sent_for_testing":
        return "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20";
      case "feedback_received":
        return "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 hover:bg-gray-500/20";
    }
  };

  const getStatusLabel = () => {
    switch (normalized) {
      case "scheduled":
        return "Scheduled";
      case "qa_received":
        return "QA Received";
      case "in_development":
        return "In Development";
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      case "converted_to_production":
        return "Converted to Production";
      case "in_progress":
        return "In Progress";
      case "sent_for_testing":
        return "Sent for Testing";
      case "feedback_received":
        return "Feedback Received";
      default:
        return normalized;
    }
  };

  return (
    <Badge className={getStatusColor()}>
      {getStatusLabel()}
    </Badge>
  );
};